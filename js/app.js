/**
 * Cota do Climão — Orquestração + UI (Estação Costeira)
 * Resiliência R1:
 * - Ingestão via window.ClimAPI.fetchAll() com Promise.allSettled e degradação graciosa
 * - Fallback inteligente de cache para dias subsequentes (Resolvedor de 16 dias)
 * - Safe index lookups protegendo contra divergência de fusos (indexOf(hoy) === -1)
 * - Nível 'indisponivel' explícito para dados ausentes (sem falsa máscara de 'bom')
 * - Preservação dos IDs: #d1, #d2, #fake-score, #traffic-card, #factor-list, #conn-banner
 */
(function () {
  'use strict';

  const HOJE = () => localDateStr(new Date());

  function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function fmtHora(ts) {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtData(ts) {
    return new Date(ts).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  let persona = 'geral';

  // ─── Model transform: API → maps por fator ─────────────────────────────────
  function buildDaily(daily, hourly, aq, marine) {
    const hoy = HOJE();
    let idx = Array.isArray(daily?.time) ? daily.time.indexOf(hoy) : -1;
    // Resiliência R1: se não encontrar o dia exato, usa o primeiro dia da janela projetada
    if (idx === -1 && Array.isArray(daily?.time) && daily.time.length > 0) {
      idx = 0;
    }

    // Offset horário para dias projetados (+1d..+15d)
    const hourlyOffset = (idx >= 0 && Array.isArray(hourly?.time) && hourly.time.length >= (idx + 1) * 24)
      ? idx * 24
      : 0;

    const pickHourly = (arr, at = 12) => {
      if (!Array.isArray(arr) || !arr.length) return null;
      const pos = hourlyOffset + at;
      if (pos < arr.length && arr[pos] != null && !isNaN(arr[pos])) return arr[pos];
      return arr[Math.min(at, arr.length - 1)];
    };

    const avgHourly = (arr, from = 8, to = 12) => {
      if (!Array.isArray(arr) || !arr.length) return null;
      let start = hourlyOffset + from;
      let end = hourlyOffset + to;
      if (start >= arr.length) {
        start = from;
        end = to;
      }
      const sel = arr.slice(start, end).filter((x) => typeof x === 'number' && !isNaN(x));
      if (!sel.length) return null;
      return sel.reduce((a, b) => a + b, 0) / sel.length;
    };

    const slice24 = (arr) => {
      if (!Array.isArray(arr) || !arr.length) return [];
      let start = hourlyOffset;
      if (start + 24 > arr.length) start = 0;
      return arr.slice(start, start + 24).filter((v) => typeof v === 'number' && !isNaN(v));
    };

    const getDailyAt = (arr, fallback = null) => {
      if (Array.isArray(arr) && idx >= 0 && idx < arr.length && arr[idx] != null && !isNaN(arr[idx])) {
        return arr[idx];
      }
      return fallback;
    };

    const hourlyHum = slice24(hourly?.relative_humidity_2m);
    const hourlyUv = slice24(hourly?.uv_index);
    const hourlyWind = slice24(hourly?.wind_speed_10m);

    const maps = {
      temperature: getDailyAt(daily?.temperature_2m_max, avgHourly(hourly?.temperature_2m, 11, 15)),
      humidityMax: getDailyAt(
        daily?.relative_humidity_2m_max,
        hourlyHum.length ? Math.max(...hourlyHum) : null
      ),
      uvMax: getDailyAt(
        daily?.uv_index_max,
        hourlyUv.length ? Math.max(...hourlyUv) : null
      ),
      windMax: getDailyAt(
        daily?.wind_speed_10m_max,
        hourlyWind.length ? Math.max(...hourlyWind) : null
      ),
      gustMax: getDailyAt(daily?.wind_gusts_10m_max, null),
      rainProbMax: getDailyAt(daily?.precipitation_probability_max, null),
      rainSum: getDailyAt(daily?.precipitation_sum, null),
      wetBulb: avgHourly(hourly?.wet_bulb_temperature_2m, 10, 14) ?? pickHourly(hourly?.wet_bulb_temperature_2m, 12),
      solar: avgHourly(hourly?.shortwave_radiation, 9, 15) ?? 0,
      cloud: avgHourly(hourly?.cloud_cover, 9, 15) ?? 0,
      windAtNoon: avgHourly(hourly?.wind_speed_10m, 10, 14) ?? null,
      soil: avgHourly(hourly?.soil_moisture_0_to_10cm, 0, 24),
    };

    if (maps.windAtNoon == null) {
      maps.windAtNoon = maps.windMax;
    }

    // WBGT outdoor (ISO 7933) - Liljegren corrigido
    maps.wbgt = (maps.temperature != null)
      ? window.ClimCalc.wBGT({
          wetBulb: maps.wetBulb ?? (maps.temperature - 2),
          temperature: maps.temperature,
          solarRadiation: maps.solar ?? 0,
          windSpeed: (maps.windAtNoon ?? 10) / 3.6,
          cloudCover: (maps.cloud ?? 0) / 100,
        })
      : null;

    // AQI (degradação graciosa caso Air Quality tenha falhado)
    const aqiOut = window.ClimCalc.aqiIndex(aq?.hourly);
    maps.aqi = aqiOut ? aqiOut.aqi : null;
    maps.aqiDetalhe = aqiOut ? aqiOut.compos : null;

    // Mar (para pescador - degradação graciosa se Marine falhar)
    maps.mar = null;
    const marineOffset = (idx >= 0 && Array.isArray(marine?.hourly?.time) && marine.hourly.time.length >= (idx + 1) * 24)
      ? idx * 24
      : 0;
    if (marine?.hourly?.wave_height && Array.isArray(marine.hourly.wave_height)) {
      let mStart = marineOffset;
      if (mStart + 24 > marine.hourly.wave_height.length) mStart = 0;
      const validWaves = marine.hourly.wave_height.slice(mStart, mStart + 24).filter(v => typeof v === 'number' && !isNaN(v));
      if (validWaves.length > 0) {
        const maxWave = Math.max(...validWaves);
        const validPeriods = Array.isArray(marine.hourly.wave_period)
          ? marine.hourly.wave_period.slice(mStart, mStart + 24).filter(v => typeof v === 'number' && !isNaN(v))
          : [];
        const period = validPeriods.length > 0 ? Math.max(...validPeriods) : 6;
        const validSst = Array.isArray(marine.hourly.sea_surface_temperature)
          ? marine.hourly.sea_surface_temperature.slice(mStart, mStart + 24).filter(v => typeof v === 'number' && !isNaN(v))
          : [];
        const sst = validSst.length > 0
          ? Math.round(validSst.reduce((a, b) => a + b, 0) / validSst.length * 10) / 10
          : null;
        maps.mar = { altura: maxWave, period: Math.round(period), sst };
      }
    }

    return maps;
  }

  function buildFatores(maps) {
    return window.ClimFactors.FACTORS.map((f) => {
      let valor;
      let extra = {};
      try {
        if (f.id === 'calor') {
          valor = maps.wbgt;
          extra.wetBulb = maps.wetBulb;
        } else if (f.id === 'sol') {
          valor = maps.uvMax;
        } else if (f.id === 'vento') {
          valor = maps.windMax;
        } else if (f.id === 'umidade') {
          valor = maps.humidityMax;
        } else if (f.id === 'ar') {
          valor = maps.aqi;
        } else if (f.id === 'chuva') {
          valor = maps.rainProbMax;
          extra.rainSum = maps.rainSum;
        }

        valor = (typeof valor === 'number' && !isNaN(valor) && isFinite(valor))
          ? window.ClimCalc.round(valor, 1)
          : null;

        let nivel = null;
        if (valor != null) {
          nivel = f.nivel(valor, { ...maps, ...extra });
        } else {
          // Resiliência R1: dados ausentes recebem estado explícito 'indisponivel'
          nivel = { nivel: 'indisponivel', rotulo: 'Indisponível' };
        }
        return { ...f, valor, nivel, ...extra };
      } catch (_) {
        return { ...f, valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } };
      }
    });
  }

  /**
   * Cálculo de risco com redistribuição proporcional de pesos
   * Evita a distorção onde dados nulos/indisponíveis pontuavam 10 ('bom').
   */
  function calcularRiscoSeguro(fatoresCalculados, elninoAtivo) {
    const pesos = elninoAtivo ? window.ClimFactors.PESOS.elnino : window.ClimFactors.PESOS.normal;
    let soma = 0;
    let total = 0;
    const detalhe = {};

    const pontosMap = (typeof window !== 'undefined' && window.ClimRisk && window.ClimRisk.PONTOS)
      ? window.ClimRisk.PONTOS
      : { bom: 10, atencao: 35, alerta: 60, perigo: 82, emergencia: 95 };

    for (const f of fatoresCalculados) {
      const p = pesos[f.id];
      if (p == null) continue;

      const lvl = f.nivel?.nivel;
      // Se indisponível ou sem valor, não soma nem no total nem na soma ponderada (redistribui peso)
      if (!lvl || lvl === 'indisponivel' || f.valor == null) {
        detalhe[f.id] = { pts: null, peso: p, nivel: 'indisponivel' };
        continue;
      }

      const pts = pontosMap[lvl] != null ? pontosMap[lvl] : 35;
      soma += pts * p;
      total += p;
      detalhe[f.id] = { pts, peso: p, nivel: lvl };
    }

    const score = total > 0 ? Math.round(soma / total) : 0;
    const nivel =
      total === 0 ? { nivel: 'indisponivel', rotulo: 'Dados insuficientes' } :
      score < 20 ? { nivel: 'bom', rotulo: 'Clima bem tranquilo hoje' } :
      score < 40 ? { nivel: 'atencao', rotulo: 'Dá pra se virar com cuidado' } :
      score < 60 ? { nivel: 'alerta', rotulo: 'Preocupação média — fique atento' } :
      score < 80 ? { nivel: 'perigo', rotulo: 'Preocupação alta — evite excessos' } :
      { nivel: 'emergencia', rotulo: 'Preocupação máxima — redobre o cuidado' };

    return { score, nivel, detalhe, pesos, modoElNino: !!elninoAtivo };
  }

  // ─── Engine Split-Flap ──────────────────────────────────────────────────
  const flapCurr = { d1: '0', d2: '0' };
  let audioCtx = null;

  function clack() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (_) {}
  }

  function flipDigit(id, next) {
    next = String(next);
    const el = document.getElementById(id);
    if (!el) return;

    const sTop = el.querySelector('.static-top span');
    const sBot = el.querySelector('.static-bottom span');
    const fFront = el.querySelector('.flap-front span');
    const fBack = el.querySelector('.flap-back span');

    if (sTop) sTop.innerText = next;
    if (fBack) fBack.innerText = next;
    if (sBot) sBot.innerText = flapCurr[id];
    if (fFront) fFront.innerText = flapCurr[id];

    if (flapCurr[id] === next) return;

    el.classList.remove('flip');
    void el.offsetWidth;
    el.classList.add('flip');
    clack();
    setTimeout(() => {
      el.classList.remove('flip');
      if (sBot) sBot.innerText = next;
      if (fFront) fFront.innerText = next;
      flapCurr[id] = next;
    }, 520);
  }

  function fmtNum(val, dec = 1, fallback = '--') {
    if (val == null) return fallback;
    const n = Number(val);
    return (typeof n === 'number' && Number.isFinite(n)) ? n.toFixed(dec) : fallback;
  }

  function setScore(n) {
    if (n == null || isNaN(n)) {
      flipDigit('d1', '-');
      flipDigit('d2', '-');
      const fake = document.getElementById('fake-score');
      if (fake) fake.textContent = '--';
      return;
    }
    const safeNum = Math.max(0, Math.min(99, Math.round(Number(n))));
    const str = String(safeNum).padStart(2, '0');
    flipDigit('d1', str[0]);
    flipDigit('d2', str[1]);
    const fake = document.getElementById('fake-score');
    if (fake) fake.textContent = str;
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  function render(fatores, risco, maps, enino, meta) {
    const appMain = document.getElementById('app-main');
    if (appMain) appMain.setAttribute('data-state', 'ready');

    // Banner offline / cache
    const offline = !meta.online;
    const connBanner = document.getElementById('conn-banner');
    if (connBanner) {
      connBanner.hidden = !offline;
      if (offline) {
        connBanner.textContent =
          `⚠ DADOS DE ${fmtData(meta.staleAt || Date.now()).toUpperCase()} (EM CACHE) — CONECTE-SE PARA REVALIDAR`;
      }
    }

    // Preocupação → split-flap + label
    if (risco.nivel?.nivel === 'indisponivel' || risco.score == null) {
      flipDigit('d1', '-');
      flipDigit('d2', '-');
      const fake = document.getElementById('fake-score');
      if (fake) fake.textContent = '--';
    } else {
      setScore(risco.score);
    }
    const scoreLabel = document.getElementById('score-label');
    if (scoreLabel) {
      scoreLabel.textContent = risco.nivel.rotulo;
      scoreLabel.style.borderBottomColor =
        risco.nivel.nivel === 'perigo' || risco.nivel.nivel === 'emergencia' ? 'var(--c-perigo)' : '';
    }

    // Atualiza a classe de fundo do cartão imediatamente (evita descompasso com MutationObserver)
    const card = document.getElementById('traffic-card');
    if (card && risco && risco.nivel) {
      card.className = `traffic-light-card bg-${risco.nivel.nivel}`;
    }

    // Carimbo de estado (em risco alto)
    const stampRow = document.getElementById('stamp-row');
    if (stampRow) {
      stampRow.innerHTML = '';
      if (risco.nivel.nivel === 'perigo' || risco.nivel.nivel === 'emergencia') {
        const st = document.createElement('div');
        st.className = 'stamp';
        st.textContent = risco.nivel.nivel === 'emergencia' ? '! ATENÇÃO MÁXIMA !' : '! ATENÇÃO !';
        stampRow.appendChild(st);
        setTimeout(() => st.classList.add('show'), 80);
      }
    }

    // Status header
    const statusLabel = document.getElementById('status-label');
    const statusIndicator = document.querySelector('.status-dot, .status-indicator');
    if (statusLabel) {
      statusLabel.textContent = offline ? 'MODO: DADOS ARMAZENADOS' : 'MEDIÇÃO ATIVA';
    }
    if (statusIndicator) {
      statusIndicator.style.background = offline ? 'var(--c-atencao)' : 'var(--c-bom)';
    }

    // Fatores (6 cotas)
    const box = document.getElementById('factor-list');
    if (box) {
      box.innerHTML = '';
      fatores.forEach((f) => {
        const lvl = f.nivel ? f.nivel.nivel : 'indisponivel';
        const fmt = f.valor != null ? f.valor : '—';
        const unid = f.unidade || '';

        let microText = '';
        if (lvl === 'indisponivel') {
          microText = `Leitura meteorológica temporariamente indisponível.`;
        } else if (f.id === 'calor') {
          const wb = fmtNum(f.wetBulb ?? maps.wetBulb, 1, '--');
          const tmp = fmtNum(maps.temperature, 1, '--');
          microText = `Bulbo Úmido a <strong>${wb}°C</strong> (limite vital de resfriamento). Temperatura do ar a ${tmp}°C.`;
          if (enino && enino.ativo && enino.anomalia != null) {
            const anom = fmtNum(enino.anomalia, 1, null);
            if (anom != null) {
              microText += ` <em>Anomalia oceânica (+${anom}°C) injetando energia extrema.</em>`;
            }
          }
        } else if (f.id === 'ar') {
          microText = `Saturação <strong>PM2.5</strong> (fumaça e poeira fina). ${lvl === 'bom' ? 'Qualidade respiratória segura.' : 'Cuidado: partículas penetram profundamente nos alvéolos pulmonares.'}`;
        } else if (f.id === 'chuva') {
          microText = `Probabilidade computada pela dinâmica costeira. Acúmulo hidrológico de <strong>~${f.rainSum ?? maps.rainSum ?? 0}mm</strong> previsto.`;
        } else if (f.id === 'vento') {
          const bf = window.ClimCalc.beaufort(f.valor);
          microText = `Norma Beaufort <strong>BF${bf.n}</strong>. ${maps.gustMax ? 'Ondas de rajada mapeadas batendo <strong>' + Math.round(maps.gustMax) + ' km/h</strong>.' : 'Sem picos agressivos de ventania.'}`;
        } else if (f.id === 'sol') {
          microText = `Escala de Radiação WHO. ${f.valor >= 6 ? 'Risco alto: radiação UV danifica tecido celular em menos de 30 min sem proteção.' : 'Feixes de radiação filtrados de forma segura.'}`;
        } else if (f.id === 'umidade') {
          microText = `Massa de vapor atmosférico. ${(f.valor >= 80) ? 'Ar saturado impede resfriamento pelo suor, provocando mormaço intenso.' : (f.valor <= 40 ? 'Baixa umidade resseca mucosas e vias respiratórias.' : 'Fração de vapor em faixa equilibrada.')}`;
        }

        const el = document.createElement('article');
        el.className = `factor level-${lvl}`;
        const dioramaHTML = window.ClimDioramas ? window.ClimDioramas.get(f.id, f.valor, lvl) : '';
        el.innerHTML = `
          <div class="factor-top">
            <div class="factor-name">${f.icona || ''}${f.nome}</div>
            <div class="factor-gauge level-${lvl}">${(f.nivel?.rotulo || '—').toUpperCase()}</div>
          </div>
          ${dioramaHTML}
          <div class="factor-value ${f.valor == null ? 'value-none' : ''}">${fmt}<small>${unid}</small></div>
          <div class="factor-micro">${microText}</div>
        `;
        box.appendChild(el);
      });
    }

    // Recomendações (Microcopy)
    const recBox = document.getElementById('rec-list');
    if (recBox && window.ClimRecs) {
      const recs = window.ClimRecs.recomendacoes(fatores, persona, enino);
      recBox.innerHTML = recs.map((r) => `<li>${r}</li>`).join('');
    }

    // El Niño card
    const enBox = document.getElementById('el-nino');
    if (enBox) {
      if (enino && enino.ativo) {
        enBox.hidden = false;
        const el = enBox.querySelector('.en-valor');
        if (el) {
          const anomFmt = fmtNum(enino.anomalia, 1, null);
          el.textContent = `ATIVO // ANOMALIA ${anomFmt != null ? anomFmt + '°C' : '—'} · ${enino.fonte || ''}`;
        }
      } else {
        enBox.hidden = true;
      }
    }

    // Stress acumulado
    renderStress();

    // Mar (pescador)
    const marBox = document.getElementById('mar-info');
    if (marBox) {
      if (persona === 'pescador' && maps.mar) {
        marBox.hidden = false;
        const altFmt = fmtNum(maps.mar.altura, 1, '—');
        const sstFmt = fmtNum(maps.mar.sst, 1, null);
        marBox.textContent = `🌊 MAR: ONDAS ATÉ ${altFmt}M · PERÍODO ~${Math.round(maps.mar.period || 6)}S${sstFmt != null ? ` · MAR ${sstFmt}°C` : ''}`;
      } else {
        marBox.hidden = true;
      }
    }

    // Sinais extras: solo, enxurrada, etc.
    renderIndicadores(maps, meta);

    // Timestamp
    const up = document.getElementById('updated-at');
    if (up) {
      up.textContent = 'ATUALIZADO ' + fmtHora(meta.updatedAt || Date.now());
    }
  }

  async function renderStress() {
    try {
      const days = await window.ClimStorage.getAll(window.ClimStorage.STORES.weather);
      const wbgtHist = [];
      for (const row of days) {
        const wbgt = row.data && row.data.maps && row.data.maps.wbgt;
        if (wbgt != null && !isNaN(wbgt)) wbgtHist.push(wbgt);
      }
      wbgtHist.sort((a, b) => a - b);
      const box = document.getElementById('stress-box');
      if (!box) return;
      if (wbgtHist.length >= 2) {
        const consec = window.ClimCalc.stressAcumulado(wbgtHist.slice(-7));
        box.hidden = false;
        box.innerHTML = consec >= 2
          ? `📈 STRESS TÉRMICO ACUMULADO: <b>${consec}</b> DIAS SEGUIDOS COM WBGT ≥27.8°C — SEU CORPO JÁ ESTÁ CANSADO DO CALOR.`
          : `📈 ÚLTIMOS ${wbgtHist.length} DIAS REGISTRADOS — SEM FADIGA TÉRMICA ACUMULADA.`;
      } else {
        box.hidden = true;
      }
    } catch (_) { /* ignore */ }
  }

  function renderIndicadores(maps, meta) {
    const sec = document.getElementById('indicadores');
    if (!sec) return;
    const itens = [];

    if (maps.soil != null) {
      const soloPct = maps.soil * 100;
      const status = soloPct < 20 ? 'Seca crítica — solo muito seco' : soloPct < 35 ? 'Seca leve' : 'Solo úmido';
      itens.push(`💧 Umidade do solo: ${Math.round(soloPct)}% · ${status}`);
    }
    if (maps.rainProbMax != null && maps.rainProbMax > 60) {
      itens.push(`🌧️ Chuva concentrada pode chegar (${Math.round(maps.rainProbMax)}% / ~${maps.rainSum ?? 0}mm) — enxurrada local possível.`);
    }
    if (meta.elNinoAtivo) {
      itens.push('🔥 El Niño + seca = atenção redobrada a focos de calor. Não faça queimadas.');
    }

    const box = document.getElementById('indicadores-list');
    if (box) {
      box.innerHTML = itens.map((t) => `<li>${t}</li>`).join('') || '<li>Nenhum alerta secundário hoje.</li>';
    }
    sec.hidden = !itens.length;
  }

  // ─── Main Bootstrap ────────────────────────────────────────────────────────
  async function bootstrap() {
    let meta = { online: true, updatedAt: Date.now(), staleAt: null, elNinoAtivo: false, enino: null };

    let data = null;

    try {
      // 1. Tenta ingestão resiliente via ClimAPI.fetchAll()
      const netRes = await window.ClimAPI.fetchAll();

      if (netRes && netRes.forecast) {
        data = {
          forecast: netRes.forecast,
          air: netRes.airQuality,
          marine: netRes.marine,
          enino: netRes.elnino,
        };
        meta.online = true;
        meta.updatedAt = netRes.status?.timestamp || Date.now();
        meta.elNinoAtivo = !!(netRes.elnino && netRes.elnino.ativo);
        meta.enino = netRes.elnino || null;
      }
    } catch (apiErr) {
      // Erro na requisição tratada silenciosamente para acionar o cache
    }

    // 2. Fallback para cache se não houver dados online de forecast
    if (!data || !data.forecast || !data.forecast.daily) {
      let cachedRaw = null;
      try {
        cachedRaw = await window.ClimStorage.loadWeatherDay(HOJE());
        if (!cachedRaw || !cachedRaw.data) {
          cachedRaw = await window.ClimStorage.loadLatestWeather();
        }
      } catch (cacheErr) {
        console.warn('Erro ao acessar storage de cache:', cacheErr);
        cachedRaw = null;
      }

      const candidate = cachedRaw?.data?.data ? cachedRaw.data.data : cachedRaw?.data;
      if (candidate && candidate.forecast && candidate.forecast.daily) {
        data = candidate;
        meta.online = false;
        meta.staleAt = cachedRaw.savedAt || Date.now();
        meta.elNinoAtivo = !!(data.enino && data.enino.ativo);
        meta.enino = data.enino || null;
      } else {
        renderSafeEmptyState('SEM CONEXÃO E SEM REGISTRO — ABRA O APP ONLINE AO MENOS UMA VEZ');
        return;
      }
    }

    try {
      const maps = buildDaily(data.forecast.daily, data.forecast.hourly, data.air, data.marine);

      // Se estiver online, persiste o estado no storage
      if (meta.online) {
        try {
          await window.ClimStorage.saveWeatherDay(HOJE(), { data, maps, savedAt: meta.updatedAt });
        } catch (_) {}
      }

      const fatores = buildFatores(maps);
      const risco = calcularRiscoSeguro(fatores, meta.elNinoAtivo);
      render(fatores, risco, maps, meta.enino, meta);

      window.ClimCurrent = { maps, fatores, risco, meta, enino: meta.enino };
    } catch (renderErr) {
      console.error('Erro na renderização:', renderErr);
      renderSafeEmptyState('ERRO AO PROCESSAR DADOS METEOROLÓGICOS — MODO SEGURO ATIVADO');
    }
  }

  function renderSafeEmptyState(msg) {
    const appMain = document.getElementById('app-main');
    if (appMain) appMain.setAttribute('data-state', 'ready');

    const statusLabel = document.getElementById('status-label');
    const statusIndicator = document.querySelector('.status-dot, .status-indicator');
    if (statusLabel) statusLabel.textContent = 'SEM CONEXÃO // SEM REGISTRO';
    if (statusIndicator) statusIndicator.style.background = 'var(--c-perigo, #991B1B)';

    flipDigit('d1', '-');
    flipDigit('d2', '-');

    const fake = document.getElementById('fake-score');
    if (fake) fake.textContent = '--';
    const scoreLabel = document.getElementById('score-label');
    if (scoreLabel) scoreLabel.textContent = 'DADOS INDISPONÍVEIS';

    const card = document.getElementById('traffic-card');
    if (card) {
      card.className = 'traffic-light-card bg-indisponivel';
    }

    const tips = document.getElementById('quick-tips');
    if (tips) {
      tips.innerHTML = '⚠️ <strong>SEM SINAL:</strong> Não há registros locais salvos nem conexão de rede ativa. Conecte-se à internet para sincronizar a estação.';
    }

    const errBox = document.getElementById('err-box');
    if (errBox) {
      errBox.hidden = false;
      errBox.textContent = msg || 'SEM CONEXÃO E SEM REGISTRO — ABRA O APP ONLINE AO MENOS UMA VEZ';
    }

    const recBox = document.getElementById('rec-list');
    if (recBox) {
      recBox.innerHTML = `
        <li>📡 Conecte-se à internet para sincronizar os sensores meteorológicos.</li>
        <li>⚠️ Em caso de tempo severo na costa, consulte a Defesa Civil ou a Capitania dos Portos.</li>
      `;
    }

    const box = document.getElementById('factor-list');
    if (box && window.ClimFactors && window.ClimFactors.FACTORS) {
      box.innerHTML = '';
      window.ClimFactors.FACTORS.forEach((f) => {
        const el = document.createElement('article');
        el.className = 'factor level-indisponivel';
        el.innerHTML = `
          <div class="factor-top">
            <div class="factor-name">${f.icona || ''}${f.nome}</div>
            <div class="factor-gauge level-indisponivel">INDISPONÍVEL</div>
          </div>
          <div class="factor-value value-none">—<small>${f.unidade || ''}</small></div>
          <div class="factor-micro">Aguardando sincronização de rede para aferição.</div>
        `;
        box.appendChild(el);
      });
    }
  }

  // Persona switch (preserva dados de El Niño ao trocar de persona)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-persona]');
    if (!btn) return;
    persona = btn.dataset.persona;
    document.querySelectorAll('[data-persona]').forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    if (window.ClimCurrent) {
      render(
        window.ClimCurrent.fatores,
        window.ClimCurrent.risco,
        window.ClimCurrent.maps,
        window.ClimCurrent.enino || null,
        window.ClimCurrent.meta
      );
    }
  });

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
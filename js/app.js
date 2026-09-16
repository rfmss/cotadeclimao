/**
 * Cota do Climão — Orquestração + UI (Estação Costeira)
 * Fluxo: fetch(IndexedDB-first + revalidação em background) → cálculos → render
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

  let cached = null;
  let persona = 'geral';

  // ─── Model transform: API → maps por fator ─────────────────────────────────
  function buildDaily(daily, hourly, aq, marine) {
    const hoy = HOJE();
    const idx = daily.time.indexOf(hoy);

    const pickHourly = (arr, at = 12) => {
      if (!arr || !arr.length) return null;
      return arr[Math.min(at, arr.length - 1)];
    };

    const avgHourly = (arr, from = 8, to = 12) => {
      if (!arr) return null;
      const sel = arr.slice(from, to).filter((x) => x != null);
      if (!sel.length) return null;
      return sel.reduce((a, b) => a + b, 0) / sel.length;
    };

    const maps = {
      temperature: daily.temperature_2m_max[idx],
      humidityMax: daily.relative_humidity_2m_max ? daily.relative_humidity_2m_max[idx] : hourly?.relative_humidity_2m ? Math.max(...hourly.relative_humidity_2m.slice(0, 24)) : null,
      uvMax: daily.uv_index_max ? daily.uv_index_max[idx] : null,
      windMax: daily.wind_speed_10m_max ? daily.wind_speed_10m_max[idx] : hourly?.wind_speed_10m ? Math.max(...hourly.wind_speed_10m.slice(0, 24)) : null,
      gustMax: daily.wind_gusts_10m_max ? daily.wind_gusts_10m_max[idx] : null,
      rainProbMax: daily.precipitation_probability_max ? daily.precipitation_probability_max[idx] : null,
      rainSum: daily.precipitation_sum ? daily.precipitation_sum[idx] : null,
      wetBulb: avgHourly(hourly?.wet_bulb_temperature_2m, 10, 14) || pickHourly(hourly?.wet_bulb_temperature_2m, 12),
      solar: avgHourly(hourly?.shortwave_radiation, 9, 15) || 0,
      cloud: avgHourly(hourly?.cloud_cover, 9, 15) || 0,
      windAtNoon: avgHourly(hourly?.wind_speed_10m, 10, 14) || maps.windMax,
      soil: avgHourly(hourly?.soil_moisture_0_to_10cm, 0, 24),
    };

    // WBGT outdoor (ISO 7933)
    maps.wbgt = window.ClimCalc.wBGT({
      wetBulb: maps.wetBulb ?? maps.temperature - 2,
      temperature: maps.temperature,
      solarRadiation: maps.solar,
      windSpeed: (maps.windAtNoon ?? 10) / 3.6,
      cloudCover: (maps.cloud ?? 0) / 100,
    });

    // AQI
    const aqiOut = window.ClimCalc.aqiIndex(aq?.hourly);
    maps.aqi = aqiOut ? aqiOut.aqi : null;
    maps.aqiDetalhe = aqiOut ? aqiOut.compos : null;

    // Mar (para pescador)
    maps.mar = null;
    if (marine?.hourly?.wave_height) {
      const max = Math.max(...marine.hourly.wave_height.slice(0, 24));
      const period = Math.max(...(marine.hourly.wave_period || [2]));
      const sst = marine.hourly.sea_surface_temperature
        ? Math.round(marine.hourly.sea_surface_temperature.slice(0, 24).reduce((a, b) => a + b, 0) / 24 * 10) / 10
        : null;
      maps.mar = { altura: max, period: Math.round(period), sst };
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
        } else if (f.id === 'sol') valor = maps.uvMax;
        else if (f.id === 'vento') valor = maps.windMax;
        else if (f.id === 'umidade') valor = maps.humidityMax;
        else if (f.id === 'ar') valor = maps.aqi;
        else if (f.id === 'chuva') { valor = maps.rainProbMax; extra.rainSum = maps.rainSum; }
        valor = (typeof valor === 'number' && isFinite(valor)) ? window.ClimCalc.round(valor, 1) : null;

        let nivel = null;
        if (valor != null) {
          nivel = f.nivel(valor, { ...maps, ...extra });
        } else {
          nivel = { nivel: 'bom', rotulo: 'Sem dados' };
        }
        return { ...f, valor, nivel, ...extra };
      } catch (e) {
        return { ...f, valor: valor ?? null, nivel: { nivel: 'bom', rotulo: 'Sem dados' } };
      }
    });
  }

  // ─── Engine Split-Flap (motor mecânico adaptado) ──────────────────────────
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
    if (flapCurr[id] === next) return;
    const el = document.getElementById(id);
    if (!el) return;
    const sTop = el.querySelector('.static-top span');
    const sBot = el.querySelector('.static-bottom span');
    const fFront = el.querySelector('.flap-front span');
    const fBack = el.querySelector('.flap-back span');
    sTop.innerText = next;
    fBack.innerText = next;
    sBot.innerText = flapCurr[id];
    fFront.innerText = flapCurr[id];
    el.classList.remove('flip');
    void el.offsetWidth;
    el.classList.add('flip');
    clack();
    setTimeout(() => {
      el.classList.remove('flip');
      sBot.innerText = next;
      fFront.innerText = next;
      flapCurr[id] = next;
    }, 520);
  }

  function setScore(n) {
    const str = String(Math.max(0, Math.min(99, Math.round(n)))).padStart(2, '0');
    flipDigit('d1', str[0]);
    flipDigit('d2', str[1]);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const SCALE_IDEAL = { calor: 28, sol: 6, vento: 38, umidade: 80, ar: 40, chuva: 30 };
  const SCALE_LABEL = { sol: 'UV', umidade: '%', ar: 'IDX' };

  function scalePct(f) {
    const max = f.escala || 100;
    const v = f.valor;
    if (v == null) return null;
    return Math.max(0, Math.min(100, (v / max) * 100));
  }
  function scaleIdealPct(f) {
    const max = f.escala || 100;
    const ideal = SCALE_IDEAL[f.id] != null ? SCALE_IDEAL[f.id] : max * 0.5;
    return Math.max(0, Math.min(100, (ideal / max) * 100));
  }

  function render(fatores, risco, maps, enino, meta) {
    document.getElementById('app-main').setAttribute('data-state', 'ready');

    // Banner offline / stale
    const offline = !meta.online;
    document.getElementById('conn-banner').hidden = !offline;
    if (offline) {
      document.getElementById('conn-banner').textContent =
        `⚠ DADOS DE ${fmtData(meta.staleAt || Date.now()).toUpperCase()} — CONECTE-SE PARA REVALIDAR`;
    }

    // Preocupação → split-flap + label
    setScore(risco.score);
    document.getElementById('score-label').textContent = risco.nivel.rotulo;
    document.getElementById('score-label').style.borderBottomColor =
      risco.nivel.nivel === 'perigo' || risco.nivel.nivel === 'emergencia' ? 'var(--l-perigo)' : '';

    // Carimbo de estado (só em risco alto)
    const stampRow = document.getElementById('stamp-row');
    stampRow.innerHTML = '';
    if (risco.nivel.nivel === 'perigo' || risco.nivel.nivel === 'emergencia') {
      const st = document.createElement('div');
      st.className = 'stamp';
      st.textContent = risco.nivel.nivel === 'emergencia' ? '! ATENÇÃO MÁXIMA !' : '! ATENÇÃO !';
      stampRow.appendChild(st);
      setTimeout(() => st.classList.add('show'), 80);
    }

    // Status header
    const statusLabel = document.getElementById('status-label');
    if (offline) {
      statusLabel.textContent = 'MODO: DADOS ARMAZENADOS';
      document.querySelector('.status-dot, .status-indicator').style.background = 'var(--l-atencao)';
    } else {
      statusLabel.textContent = 'MEDIÇÃO ATIVA';
      document.querySelector('.status-indicator').style.background = 'var(--l-bom)';
    }

    // Fatores
    const box = document.getElementById('factor-list');
    box.innerHTML = '';
    fatores.forEach((f, i) => {
      const idNum = String(i + 1).padStart(2, '0');
      const pct = scalePct(f);
      const idealPct = scaleIdealPct(f);
      const lvl = f.nivel ? f.nivel.nivel : 'bom';
      const fmt = f.valor != null ? f.valor : '—';
      const unid = f.unidade || '';
      const idealLabel = f.ideal;

      const el = document.createElement('article');
      el.className = 'factor';
      el.innerHTML = `
        <div class="factor-top">
          <span class="factor-id">${idNum}</span>
          <div class="factor-name">${f.icona}${f.nome}</div>
          <div class="factor-gauge level-${lvl}"><span class="dot"></span>${(f.nivel?.rotulo || '—').toUpperCase()}</div>
        </div>
        <div class="factor-value ${f.valor == null ? 'value-none' : ''}">${fmt}<small>${unid}</small></div>
        <div class="ruler">
          <div class="ruler-track"></div>
          <div class="ruler-ticks"></div>
          <div class="ruler-scale"><span>0</span><span>${SCALE_LABEL[f.id] || (f.escala || 100)}</span></div>
          <div class="ruler-ideal" style="left:${idealPct}%"></div>
          <div class="ruler-needle level-${lvl}" style="left:${pct == null ? 0 : pct}%"></div>
        </div>
        <div class="factor-foot">
          <span>${f.alvo}</span>
          <span>ideal: ${idealLabel}</span>
        </div>
      `;
      box.appendChild(el);
    });

    // Recomendações
    const recBox = document.getElementById('rec-list');
    const recs = window.ClimRecs.recomendacoes(fatores, persona, enino);
    recBox.innerHTML = recs.map((r) => `<li>${r}</li>`).join('');

    // El Niño
    const enBox = document.getElementById('el-nino');
    if (enino && enino.ativo) {
      enBox.hidden = false;
      const el = enBox.querySelector('.en-valor');
      el.textContent = `MUITO FORTE // ANOMALIA ${enino.anomalia != null ? enino.anomalia.toFixed(1) + '°C' : '—'} · ${enino.fonte || ''}`;
    } else {
      enBox.hidden = true;
    }

    // Stress acumulado
    renderStress();

    // Mar (pescador)
    const marBox = document.getElementById('mar-info');
    if (persona === 'pescador' && maps.mar) {
      marBox.hidden = false;
      marBox.textContent = `🌊 MAR: ONDAS ATÉ ${maps.mar.altura.toFixed(1)}M · PERÍODO ~${maps.mar.period}S${maps.mar.sst != null ? ` · MAR ${maps.mar.sst}°C` : ''}`;
    } else {
      marBox.hidden = true;
    }

    // Sinais extras: seca / queimadas / enxurrada
    renderIndicadores(maps, meta);

    // Timestamp
    const up = document.getElementById('updated-at');
    up.textContent = 'ATUALIZADO ' + fmtHora(meta.updatedAt || Date.now());
  }

  async function renderStress() {
    try {
      const days = await window.ClimStorage.getAll(window.ClimStorage.STORES.weather);
      const wbgtHist = [];
      for (const row of days) {
        const wbgt = row.data && row.data.maps && row.data.maps.wbgt;
        if (wbgt != null) wbgtHist.push(wbgt);
      }
      wbgtHist.sort((a, b) => a - b);
      const box = document.getElementById('stress-box');
      if (wbgtHist.length && wbgtHist.length >= 2) {
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
    box.innerHTML = itens.map((t) => `<li>${t}</li>`).join('') || '<li>Nenhum alerta secundário hoje.</li>';
    sec.hidden = !itens.length;
  }

  // ─── Main ──────────────────────────────────────────────────────────────────
  async function bootstrap() {
    let meta = { online: true, updatedAt: Date.now(), staleAt: null, elNinoAtivo: false };

    const cachedRaw = await window.ClimStorage.loadWeatherDay(HOJE());

    let data;
    try {
      const [f, aq, marine, enino] = await Promise.all([
        window.ClimAPI.fetchForecast(),
        window.ClimAPI.fetchAirQuality(),
        window.ClimAPI.fetchMarine(),
        window.ClimAPI.fetchElNino(),
      ]);
      data = { forecast: f, air: aq, marine, enino };
      meta.online = true;
      meta.updatedAt = Date.now();
      meta.elNinoAtivo = !!(enino && enino.ativo);
      meta.enino = enino || null;
      await window.ClimStorage.saveWeatherDay(HOJE(), { data, maps: null });
    } catch (err) {
      if (cachedRaw && cachedRaw.data) {
        data = cachedRaw.data;
        meta.online = false;
        meta.staleAt = cachedRaw.savedAt;
        meta.elNinoAtivo = !!(data.enino && data.enino.ativo);
      } else {
        document.getElementById('err-box').hidden = false;
        document.getElementById('err-box').textContent = 'SEM CONEXÃO E SEM REGISTRO — ABRA O APP ONLINE AO MENOS UMA VEZ';
        document.getElementById('app-main').setAttribute('data-state', 'ready');
        return;
      }
    }

    const maps = buildDaily(data.forecast.daily, data.forecast.hourly, data.air, data.marine);
    await window.ClimStorage.saveWeatherDay(HOJE(), { data, maps, savedAt: Date.now() });

    const fatores = buildFatores(maps);
    const risco = window.ClimRisk.calcular(fatores, meta.elNinoAtivo);
    render(fatores, risco, maps, (data.enino && data.enino.ativo) ? data.enino : null, meta);

    window.ClimCurrent = { maps, fatores, risco, meta };
  }

  // Persona switch
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-persona]');
    if (!btn) return;
    persona = btn.dataset.persona;
    document.querySelectorAll('[data-persona]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (window.ClimCurrent) {
      render(window.ClimCurrent.fatores, window.ClimCurrent.risco, window.ClimCurrent.maps, null, window.ClimCurrent.meta);
    }
  });

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
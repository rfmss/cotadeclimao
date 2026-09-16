/**
 * Cota do Climão — Orquestração + UI
 * Fluxo: fetch(ÍndexedDB-first com revalidação em background) → cálculos → render
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
          const n = f.nivel(valor, { ...maps, ...extra });
          nivel = n;
        } else {
          nivel = { nivel: 'bom', rotulo: 'Sem dados' };
        }
        return { ...f, valor, nivel, ...extra };
      } catch (e) {
        return { ...f, valor: valor ?? null, nivel: { nivel: 'bom', rotulo: 'Sem dados' } };
      }
    });
  }

  // ─── Loading / render ─────────────────────────────────────────────────────
  function showLoading() {
    document.getElementById('app-main').setAttribute('data-state', 'loading');
  }

  function render(fatores, risco, maps, enino, meta) {
    document.getElementById('app-main').setAttribute('data-state', 'ready');

    // Status / banner offline
    const offline = !meta.online;
    document.getElementById('conn-banner').hidden = !offline;
    if (offline) {
      document.getElementById('conn-banner').innerHTML =
        `⚠️ Dados de ${fmtData(meta.staleAt || Date.now())} — Conecte-se para atualizar`;
    }

    // Preocupação
    const elScore = document.getElementById('score-value');
    elScore.textContent = risco.score;
    elScore.className = 'score-value level-' + risco.nivel.nivel;
    document.getElementById('score-label').textContent = risco.nivel.rotulo;
    document.getElementById('score-bar-inner').className = 'level-' + risco.nivel.nivel;
    document.getElementById('score-bar-inner').style.width = risco.score + '%';

    // Fatores
    const box = document.getElementById('factor-list');
    box.innerHTML = '';
    for (const f of fatores) {
      const ideal = f.ideal;
      const fmt = f.valor != null ? f.valor : '—';
      const unid = f.alvo === 'UV Index' ? '' : f.unidade;
      const barClass = 'level-' + (f.nivel?.nivel || 'bom');

      const el = document.createElement('article');
      el.className = 'factor';
      el.innerHTML = `
        <header>
          <span class="factor-ico" aria-hidden="true">${f.icona}</span>
          <h3>${f.nome}</h3>
          <span class="factor-gauge ${barClass}">${f.nivel?.rotulo || ''}</span>
        </header>
        <div class="blood">
          <div class="blood-ideal" style="left:${idealPct(f.id)}%"></div>
          <div class="blood-bar ${barClass}" style="width:${valorPct(f)}%"></div>
        </div>
        <footer>
          <span class="blood-value">${fmt} ${unid}</span>
          <span class="factor-ideal">ideal: ${ideal}</span>
        </footer>
      `;
      box.appendChild(el);
    }

    // Persona select
    // (mantém valor selecionado)

    // Recomendações
    const recBox = document.getElementById('rec-list');
    const recs = window.ClimRecs.recomendacoes(fatores, persona, enino);
    recBox.innerHTML = recs.map((r) => `<li>${r}</li>`).join('');

    // El Niño panel
    const enBox = document.getElementById('el-nino');
    if (enino && enino.ativo) {
      enBox.hidden = false;
      enBox.querySelector('.en-valor').textContent =
        `Muito Forte (anomalia ${enino.anomalia != null ? enino.anomalia.toFixed(1) : '—'}°C) · ${enino.fonte || ''}`;
    } else {
      enBox.hidden = true;
    }

    // Stress acumulado (usando histórico do cache)
    renderStress();

    // Marinfo para pescador
    const marBox = document.getElementById('mar-info');
    if (persona === 'pescador' && maps.mar) {
      marBox.hidden = false;
      marBox.innerHTML = `🌊 Mar: ondas até ${maps.mar.altura.toFixed(1)}m (período ~${maps.mar.period}s) · mar ${maps.mar.sst != null ? maps.mar.sst + '°C' : 'sem temp'}`;
    } else {
      marBox.hidden = true;
    }

    // Ambientes extras: seca/queimadas (indicadores)
    renderIndicadores(maps, meta);

    // Timestamp
    document.getElementById('updated-at').textContent = 'Atualizado ' + fmtHora(meta.updatedAt || Date.now());
  }

  function idealPct(id) {
    const map = { calor: 40, sol: 30, vento: 45, umidade: 50, ar: 30, chuva: 30 };
    return map[id] ?? 40;
  }
  function valorPct(f) {
    if (f.valor == null) return 0;
    const map = { calor: 100, sol: 100, vento: 100, umidade: 100, ar: 100, chuva: 70 };
    return Math.max(4, Math.min(100, (f.valor / (f.id === 'chuva' ? 100 : map[f.id] ?? 100)) * 100));
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
      if (wbgtHist.length) {
        const consec = window.ClimCalc.stressAcumulado(wbgtHist.slice(-7));
        box.hidden = false;
        box.innerHTML = consec >= 2
          ? `📈 Stress térmico acumulado: <b>${consec}</b> dia(s) seguidos com WBGT ≥ 27.8°C — seu corpo já está cansado do calor.`
          : `📈 Últimos ${wbgtHist.length} dias registrados — sem fadiga térmica acumulada.`;
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
      const status = soloPct < 20 ? '🟠 Seca crítica — solo muito seco' : soloPct < 35 ? '🟡 Seca leve' : '🟢 Solo úmido';
      itens.push(`💧 Umidade do solo: ${Math.round(soloPct)}% · ${status}`);
    }
    if (maps.rainSum != null && maps.rainProbMax != null && maps.rainProbMax > 60) {
      itens.push(`🌧️ Chuva concentrada pode chegar (${Math.round(maps.rainProbMax)}% / ~${maps.rainSum}mm) — enxurrada local é possível.`);
    }
    if (meta.elNinoAtivo) {
      itens.push('🔥 El Niño + seca = atenção redobrada a focos de calor. Não faça queimadas.');
    }

    const box = document.getElementById('indicadores-list');
    box.innerHTML = itens.map((t) => `<li>${t}</li>`).join('') || '<li>Nenhum alerta secundário hoje.</li>';
    sec.hidden = false;
  }

  // ─── Main -----------------------------------------------------------------
  async function bootstrap() {
    let meta = { online: true, updatedAt: Date.now(), staleAt: null, elNinoAtivo: false };

    const cachedRaw = await window.ClimStorage.loadWeatherDay(HOJE());

    // tenta API
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
      if (!enino) meta.enino = null;
      else meta.enino = enino;

      await window.ClimStorage.saveWeatherDay(HOJE(), { data, maps: null });
    } catch (err) {
      if (cachedRaw && cachedRaw.data) {
        data = cachedRaw.data;
        meta.online = false;
        meta.staleAt = cachedRaw.savedAt;
        meta.elNinoAtivo = !!(data.enino && data.enino.ativo);
      } else {
        showLoading();
        document.getElementById('err-box').hidden = false;
        document.getElementById('err-box').textContent = 'Sem conexão e sem cache. Abra o app online ao menos uma vez.';
        return;
      }
    }

    const maps = buildDaily(data.forecast.daily, data.forecast.hourly, data.air, data.marine);
    // guarda maps no cache (para stress)
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
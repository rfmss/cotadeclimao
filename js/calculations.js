/**
 * Cota do Climão — Cálculos Científicos
 * WBGT outdoor (ISO 7933), AQI (WHO 2021), Beaufort, Bulbo Úmido
 * Referência: NIOSH 2016, OSHA, WHO 2021
 */
(function () {
  'use strict';

  const CONFIG = {
    LAT: -19.52,
    LON: -39.78,
  };

  // ─── WBGT Outdoor (ISO 7933) ─────────────────────────────────────────────
  // WBGT = 0.7*WB + 0.2*GT + 0.1*DB
  // GT (globe temp) aproximada por Liljegren (2008) simplificada.
  // wb é a temperatura de bulbo úmido natural (vem da API como wet_bulb_temperature_2m,
  // aproximação de bulbo úmido psicrométrico — usamos fator de correção + radiação solar).

  function wBGT({ wetBulb, temperature, solarRadiation, windSpeed, cloudCover }) {
    const T = temperature;
    const WB = wetBulb;
    const R = solarRadiation || 0; // W/m²
    const V = Math.max(windSpeed, 0.1); // m/s (2m derivado)

    // Globe temperature estimada (Liljegren simplificada)
    const GT = T + (R > 0 ? Math.min(18, R / 60 * (1 - 0.5 * Math.min(cloudCover, 1) * 0)) : 0) +
               (R > 0 ? Math.min(15, R / 80) : 0);

    const wbgt = (0.7 * WB) + (0.2 * GT) + (0.1 * T);
    return round(wbgt, 1);
  }

  // ─── Bulbo Úmido (aviso direto) ───────────────────────────────────────────
  function bulboUmido(naturalWB) {
    if (naturalWB < 25) return { nivel: 'bom', rotulo: 'Confortável' };
    if (naturalWB < 27.8) return { nivel: 'atencao', rotulo: 'Cuidado' };
    if (naturalWB < 29) return { nivel: 'alerta', rotulo: 'Alerta' };
    if (naturalWB < 31) return { nivel: 'perigo', rotulo: 'Perigo' };
    return { nivel: 'emergencia', rotulo: 'Emergência' };
  }

  // ─── AQI compacto pela lógica WHO 2021 (usa subíndices, pega o máximo) ─────
  // Valores limites de referência (µg/m³)
  const AQ_LIMITS = {
    pm2_5:  { vad: 15,  vhr: 5   },
    pm10:   { vad: 45,  vhr: 15  },
    o3:     { vad: 100, vhr: 60  },   // máx 8h
    no2:    { vad: 25,  vhr: 10  },
  };

  function aqiComponent(value, pol) {
    if (value == null || isNaN(value)) return null;
    const { vad } = AQ_LIMITS[pol] || { vad: 50 };
    // simples índice normalizado 0-100 vs limite WHO 24h/8h
    const ratio = value / vad;
    return Math.max(0, Math.min(100, Math.round(ratio * 50)));
  }

  function aqiIndex(hourly) {
    const p = hourly && hourly.length ? hourly[0] : null;
    if (!p) return null;
    const comps = [
      aqiComponent(p.pm2_5, 'pm2_5'),
      aqiComponent(p.pm10, 'pm10'),
      aqiComponent(p.ozone || p.o3, 'o3'),
      aqiComponent(p.nitrogen_dioxide || p.no2, 'no2'),
    ].filter((x) => x != null);
    if (!comps.length) return null;
    const idx = Math.max(...comps);
    const nivel =
      idx < 20 ? 'bom' :
      idx < 40 ? 'atencao' :
      idx < 60 ? 'alerta' : 'perigo';
    return { aqi: idx, compos: comps, nivel };
  }

  // ─── Escala de Beaufort (vento em km/h) ───────────────────────────────────
  function beaufort(kmh) {
    if (kmh < 1) return { n: 0, rotulo: 'Calmaria' };
    if (kmh < 12) return { n: 1, rotulo: 'Brisa leve' };
    if (kmh < 20) return { n: 2, rotulo: 'Brisa suave' };
    if (kmh < 29) return { n: 3, rotulo: 'Brisa fraca' };
    if (kmh < 39) return { n: 4, rotulo: 'Brisa moderada' };
    if (kmh < 50) return { n: 5, rotulo: 'Vento fresco' };
    if (kmh < 62) return { n: 6, rotulo: 'Vento forte' };
    if (kmh < 75) return { n: 7, rotulo: 'Ventania' };
    if (kmh < 89) return { n: 8, rotulo: 'Ventania forte' };
    if (kmh < 103) return { n: 9, rotulo: 'Ventania violenta' };
    if (kmh < 118) return { n: 10, rotulo: 'Tempestade' };
    return { n: 11, rotulo: 'Tempestade violenta' };
  }

  function ventoNivel(kmh) {
    const b = beaufort(kmh);
    if (b.n <= 3) return 'bom';
    if (b.n <= 5) return 'atencao';
    if (b.n <= 7) return 'alerta';
    return 'perigo';
  }

  // ─── UV Index (WHO) ───────────────────────────────────────────────────────
  function uvNivel(uv) {
    if (uv < 3) return { nivel: 'bom', rotulo: 'Baixo', tempo: 'Sem restrição' };
    if (uv < 6) return { nivel: 'atencao', rotulo: 'Moderado', tempo: '~40 min' };
    if (uv < 8) return { nivel: 'alerta', rotulo: 'Alto', tempo: '~20 min' };
    if (uv < 11) return { nivel: 'perigo', rotulo: 'Muito alto', tempo: '~10 min' };
    return { nivel: 'emergencia', rotulo: 'Extremo', tempo: 'Evitar' };
  }

  // ─── Chuva (probabilidade) ────────────────────────────────────────────────
  function chuvaNivel(prob, mm) {
    if (mm != null && mm > 50) return { nivel: 'perigo', rotulo: 'Risco de alagamento' };
    if (prob < 30) return { nivel: 'bom', rotulo: 'Chuva não vem hoje' };
    if (prob < 60) return { nivel: 'atencao', rotulo: 'Chance leve' };
    if (prob < 80) return { nivel: 'alerta', rotulo: 'Chuva moderada' };
    return { nivel: 'perigo', rotulo: 'Chuva pesada' };
  }

  // ─── Stress Térmico Acumulado (consecutivos WBGT > 27.8) ─────────────────
  function stressAcumulado(wbgtHistory) {
    let consecutivos = 0;
    for (let i = wbgtHistory.length - 1; i >= 0; i--) {
      if (wbgtHistory[i] >= 27.8) consecutivos++;
      else break;
    }
    return consecutivos;
  }

  // ─── Helper ───────────────────────────────────────────────────────────────
  function round(x, d = 0) {
    const p = Math.pow(10, d);
    return Math.round(x * p) / p;
  }

  // Expose
  window.ClimCalc = {
    wBGT,
    bulboUmido,
    aqiIndex,
    beaufort,
    ventoNivel,
    uvNivel,
    chuvaNivel,
    stressAcumulado,
    AQ_LIMITS,
    CONFIG,
    round,
  };
})();
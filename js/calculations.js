/**
 * Cota do Climão — Cálculos Científicos
 * WBGT outdoor (ISO 7933), AQI (WHO 2021), Beaufort, Bulbo Úmido
 * Referência: NIOSH 2016, OSHA, WHO 2021
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.ClimCalc = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CONFIG = {
    LAT: -19.52,
    LON: -39.78,
  };

  // ─── WBGT Outdoor (ISO 7933) ─────────────────────────────────────────────
  // WBGT = 0.7*WB + 0.2*GT + 0.1*DB
  // GT (globe temp) aproximada por Liljegren (2008) simplificada.
  // Correção R1: Remoção do bug '* 0' que anulava a atenuação por cobertura de nuvens.

  function wBGT(params = {}) {
    const { wetBulb, temperature, solarRadiation, windSpeed, cloudCover } = params;
    if (temperature == null || Number.isNaN(Number(temperature))) return null;

    const T = Number(temperature);
    const WB = (wetBulb != null && !Number.isNaN(Number(wetBulb))) ? Number(wetBulb) : T - 2;
    const R = (solarRadiation != null && !Number.isNaN(Number(solarRadiation))) ? Math.max(0, Number(solarRadiation)) : 0; // W/m²
    const V = (windSpeed != null && !Number.isNaN(Number(windSpeed))) ? Math.max(Number(windSpeed), 0.1) : 1.0; // m/s

    // Normaliza cloudCover para 0..1
    let cc = 0;
    if (cloudCover != null && !Number.isNaN(Number(cloudCover))) {
      const numCC = Number(cloudCover);
      cc = numCC > 1 ? numCC / 100 : numCC;
      cc = Math.max(0, Math.min(1, cc));
    }

    // Globe temperature estimada (Liljegren simplificada com atenuação de nuvens ativa)
    const GT = T + (R > 0 ? Math.min(18, (R / 60) * (1 - 0.5 * cc)) : 0) +
               (R > 0 ? Math.min(15, R / 80) : 0);

    const wbgt = (0.7 * WB) + (0.2 * GT) + (0.1 * T);
    return round(wbgt, 1);
  }

  // ─── Bulbo Úmido (aviso direto) ───────────────────────────────────────────
  function bulboUmido(naturalWB) {
    if (naturalWB == null || Number.isNaN(Number(naturalWB))) {
      return { nivel: 'indisponivel', rotulo: 'Indisponível' };
    }
    const wb = Number(naturalWB);
    if (wb < 25) return { nivel: 'bom', rotulo: 'Confortável' };
    if (wb < 27.8) return { nivel: 'atencao', rotulo: 'Cuidado' };
    if (wb < 29) return { nivel: 'alerta', rotulo: 'Alerta' };
    if (wb < 31) return { nivel: 'perigo', rotulo: 'Perigo' };
    return { nivel: 'emergencia', rotulo: 'Emergência' };
  }

  // ─── AQI compacto pela lógica WHO 2021 (usa subíndices, pega o máximo) ─────
  const AQ_LIMITS = {
    pm2_5:  { vad: 15,  vhr: 5   },
    pm10:   { vad: 45,  vhr: 15  },
    o3:     { vad: 100, vhr: 60  },   // máx 8h
    no2:    { vad: 25,  vhr: 10  },
  };

  function aqiComponent(value, pol) {
    if (value == null || Number.isNaN(Number(value))) return null;
    const { vad } = AQ_LIMITS[pol] || { vad: 50 };
    const ratio = Number(value) / vad;
    return Math.max(0, Math.min(100, Math.round(ratio * 50)));
  }

  function aqiIndex(hourly) {
    if (!hourly) return null;
    let points = hourly;
    if (!Array.isArray(hourly)) {
      const n = (hourly.time && hourly.time.length) || 0;
      points = [];
      for (let i = 0; i < n; i++) {
        const p = {};
        for (const k of ['pm2_5', 'pm10', 'ozone', 'o3', 'nitrogen_dioxide', 'no2']) {
          if (Array.isArray(hourly[k])) p[k] = hourly[k][i];
        }
        points.push(p);
      }
      if (!points.length) return null;
    }
    const dayspan = points.slice(0, 12);
    const peak = (key) => {
      let v = null;
      for (const h of dayspan) {
        const val = h[key];
        if (val != null && !Number.isNaN(Number(val))) {
          const numVal = Number(val);
          v = v == null ? numVal : Math.max(v, numVal);
        }
      }
      return v;
    };
    const comps = [
      aqiComponent(peak('pm2_5'), 'pm2_5'),
      aqiComponent(peak('pm10'), 'pm10'),
      aqiComponent(peak('ozone') ?? peak('o3'), 'o3'),
      aqiComponent(peak('nitrogen_dioxide') ?? peak('no2'), 'no2'),
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
    if (kmh == null || Number.isNaN(Number(kmh))) {
      return { n: 0, rotulo: 'Indisponível' };
    }
    const v = Number(kmh);
    if (v < 1) return { n: 0, rotulo: 'Calmaria' };
    if (v < 12) return { n: 1, rotulo: 'Brisa leve' };
    if (v < 20) return { n: 2, rotulo: 'Brisa suave' };
    if (v < 29) return { n: 3, rotulo: 'Brisa fraca' };
    if (v < 39) return { n: 4, rotulo: 'Brisa moderada' };
    if (v < 50) return { n: 5, rotulo: 'Vento fresco' };
    if (v < 62) return { n: 6, rotulo: 'Vento forte' };
    if (v < 75) return { n: 7, rotulo: 'Ventania' };
    if (v < 89) return { n: 8, rotulo: 'Ventania forte' };
    if (v < 103) return { n: 9, rotulo: 'Ventania violenta' };
    if (v < 118) return { n: 10, rotulo: 'Tempestade' };
    return { n: 11, rotulo: 'Tempestade violenta' };
  }

  function ventoNivel(kmh) {
    if (kmh == null || Number.isNaN(Number(kmh))) return 'indisponivel';
    const b = beaufort(kmh);
    if (b.n <= 3) return 'bom';
    if (b.n <= 5) return 'atencao';
    if (b.n <= 7) return 'alerta';
    return 'perigo';
  }

  // ─── UV Index (WHO) ───────────────────────────────────────────────────────
  function uvNivel(uv) {
    if (uv == null || Number.isNaN(Number(uv))) {
      return { nivel: 'indisponivel', rotulo: 'Indisponível', tempo: '—' };
    }
    const val = Number(uv);
    if (val < 3) return { nivel: 'bom', rotulo: 'Baixo', tempo: 'Sem restrição' };
    if (val < 6) return { nivel: 'atencao', rotulo: 'Moderado', tempo: '~40 min' };
    if (val < 8) return { nivel: 'alerta', rotulo: 'Alto', tempo: '~20 min' };
    if (val < 11) return { nivel: 'perigo', rotulo: 'Muito alto', tempo: '~10 min' };
    return { nivel: 'emergencia', rotulo: 'Extremo', tempo: 'Evitar' };
  }

  // ─── Chuva (probabilidade) ────────────────────────────────────────────────
  function chuvaNivel(prob, mm) {
    if (prob == null || Number.isNaN(Number(prob))) {
      return { nivel: 'indisponivel', rotulo: 'Indisponível' };
    }
    const p = Number(prob);
    const m = (mm != null && !Number.isNaN(Number(mm))) ? Number(mm) : null;
    if (m != null && m > 50) return { nivel: 'perigo', rotulo: 'Risco de alagamento' };
    if (p < 30) return { nivel: 'bom', rotulo: 'Chuva não vem hoje' };
    if (p < 60) return { nivel: 'atencao', rotulo: 'Chance leve' };
    if (p < 80) return { nivel: 'alerta', rotulo: 'Chuva moderada' };
    return { nivel: 'perigo', rotulo: 'Chuva pesada' };
  }

  // ─── Stress Térmico Acumulado (consecutivos WBGT > 27.8) ─────────────────
  function stressAcumulado(wbgtHistory) {
    if (!Array.isArray(wbgtHistory)) return 0;
    let consecutivos = 0;
    for (let i = wbgtHistory.length - 1; i >= 0; i--) {
      const val = Number(wbgtHistory[i]);
      if (!Number.isNaN(val) && val >= 27.8) consecutivos++;
      else break;
    }
    return consecutivos;
  }

  // ─── Helper ───────────────────────────────────────────────────────────────
  function round(x, d = 0) {
    if (x == null || Number.isNaN(Number(x))) return null;
    const p = Math.pow(10, d);
    return Math.round(Number(x) * p) / p;
  }

  return {
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
});
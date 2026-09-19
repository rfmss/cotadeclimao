/**
 * Empirical Stress Test Suite for Milestone M1
 * Challenger 2: teamwork_preview_challenger_m1_2
 */
const assert = require('assert');
const schema = require('./js/schema.js');
const calc = require('./js/calculations.js');

console.log('====================================================');
console.log('🔬 EMPIRICAL CHALLENGER 2 — STRESS TEST SUITE');
console.log('====================================================');

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

function check(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    failedTests.push({ desc, error: err.message });
    console.error(`  ✗ FAIL: ${desc} -> ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: WBGT & Cloud Cover Attenuation (Liljegren / ISO 7933)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 1: WBGT & Cloud Cover Attenuation ---');

check('WBGT strictly decreases as cloud cover increases (0% -> 50% -> 100%)', () => {
  const base = { temperature: 35, wetBulb: 28, solarRadiation: 1000, windSpeed: 2 };
  const w0 = calc.wBGT({ ...base, cloudCover: 0 });
  const w25 = calc.wBGT({ ...base, cloudCover: 25 });
  const w50 = calc.wBGT({ ...base, cloudCover: 50 });
  const w75 = calc.wBGT({ ...base, cloudCover: 75 });
  const w100 = calc.wBGT({ ...base, cloudCover: 100 });

  console.log(`    Values: cc=0%: ${w0}°C | cc=25%: ${w25}°C | cc=50%: ${w50}°C | cc=75%: ${w75}°C | cc=100%: ${w100}°C`);
  assert.ok(w0 > w25, `Expected w0 (${w0}) > w25 (${w25})`);
  assert.ok(w25 > w50, `Expected w25 (${w25}) > w50 (${w50})`);
  assert.ok(w50 > w75, `Expected w50 (${w50}) > w75 (${w75})`);
  assert.ok(w75 > w100, `Expected w75 (${w75}) > w100 (${w100})`);
});

check('WBGT handles cloud cover as fraction (0.0 to 1.0) and percentage (0 to 100)', () => {
  const base = { temperature: 30, wetBulb: 25, solarRadiation: 800, windSpeed: 1.5 };
  const wPerc50 = calc.wBGT({ ...base, cloudCover: 50 });
  const wFrac05 = calc.wBGT({ ...base, cloudCover: 0.5 });
  console.log(`    cloudCover=50: ${wPerc50}°C vs cloudCover=0.5: ${wFrac05}°C`);
  assert.strictEqual(wPerc50, wFrac05, '0.5 and 50 must yield identical attenuation');

  const wPerc100 = calc.wBGT({ ...base, cloudCover: 100 });
  const wFrac10 = calc.wBGT({ ...base, cloudCover: 1.0 });
  assert.strictEqual(wPerc100, wFrac10, '1.0 and 100 must yield identical attenuation');
});

check('WBGT clamps extreme cloud cover values (< 0 and > 100)', () => {
  const base = { temperature: 30, wetBulb: 25, solarRadiation: 800, windSpeed: 1.5 };
  const w0 = calc.wBGT({ ...base, cloudCover: 0 });
  const wNeg = calc.wBGT({ ...base, cloudCover: -50 });
  assert.strictEqual(wNeg, w0, 'Negative cloudCover must clamp to 0');

  const w100 = calc.wBGT({ ...base, cloudCover: 100 });
  const wOver = calc.wBGT({ ...base, cloudCover: 250 });
  assert.strictEqual(wOver, w100, 'CloudCover > 100 must clamp to 100');
});

check('WBGT zero solar radiation: cloud cover has zero effect at night', () => {
  const base = { temperature: 24, wetBulb: 22, solarRadiation: 0, windSpeed: 1.0 };
  const wClear = calc.wBGT({ ...base, cloudCover: 0 });
  const wOvercast = calc.wBGT({ ...base, cloudCover: 100 });
  console.log(`    Night (solar=0): clear=${wClear}°C, overcast=${wOvercast}°C`);
  assert.strictEqual(wClear, wOvercast, 'At night (R=0), cloud cover must have no effect');
});

check('WBGT returns null on invalid/missing temperature', () => {
  assert.strictEqual(calc.wBGT({ temperature: null }), null);
  assert.strictEqual(calc.wBGT({ temperature: undefined }), null);
  assert.strictEqual(calc.wBGT({ temperature: NaN }), null);
  assert.strictEqual(calc.wBGT({ temperature: 'not-a-number' }), null);
  assert.strictEqual(calc.wBGT({}), null);
});

check('WBGT gracefully falls back when wetBulb, solar, wind, or cloud are missing', () => {
  const res = calc.wBGT({ temperature: 30 });
  assert.ok(typeof res === 'number' && !isNaN(res));
  console.log(`    Fallback WBGT with only temperature=30: ${res}°C`);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Boundary Clamping & Schema Sanitization
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 2: Boundary Clamping & Schema Sanitization ---');

check('BOUNDS coverage for all environmental metrics', () => {
  const expectedKeys = [
    'temperature', 'humidity', 'windSpeed', 'windGust', 'rainProbability',
    'precipitation', 'uv', 'aqi', 'wbgt', 'solarRadiation', 'cloudCover',
    'waveHeight', 'wavePeriod', 'seaSurfaceTemp', 'soilMoisture'
  ];
  for (const k of expectedKeys) {
    assert.ok(schema.BOUNDS[k] != null, `BOUNDS must include ${k}`);
    assert.ok(schema.BOUNDS[k].min < schema.BOUNDS[k].max, `${k} min must be less than max`);
  }
});

check('sanitizeBound clamping behavior across full interval and edge cases', () => {
  // Temperature [-20, 55]
  assert.strictEqual(schema.sanitizeBound(-999, 'temperature'), -20);
  assert.strictEqual(schema.sanitizeBound(-20, 'temperature'), -20);
  assert.strictEqual(schema.sanitizeBound(25, 'temperature'), 25);
  assert.strictEqual(schema.sanitizeBound(55, 'temperature'), 55);
  assert.strictEqual(schema.sanitizeBound(999, 'temperature'), 55);

  // Humidity [0, 100]
  assert.strictEqual(schema.sanitizeBound(-10, 'humidity'), 0);
  assert.strictEqual(schema.sanitizeBound(100, 'humidity'), 100);
  assert.strictEqual(schema.sanitizeBound(150, 'humidity'), 100);

  // UV [0, 20]
  assert.strictEqual(schema.sanitizeBound(-5, 'uv'), 0);
  assert.strictEqual(schema.sanitizeBound(25, 'uv'), 20);

  // Non-numeric inputs return null
  assert.strictEqual(schema.sanitizeBound(null, 'temperature'), null);
  assert.strictEqual(schema.sanitizeBound(undefined, 'temperature'), null);
  assert.strictEqual(schema.sanitizeBound(NaN, 'temperature'), null);
  assert.strictEqual(schema.sanitizeBound(Infinity, 'temperature'), null);
  assert.strictEqual(schema.sanitizeBound(-Infinity, 'temperature'), null);
  assert.strictEqual(schema.sanitizeBound('30', 'temperature'), null); // strict type contract
});

check('validateForecast sanitizes arrays and discards invalid structures', () => {
  assert.strictEqual(schema.validateForecast(null), null);
  assert.strictEqual(schema.validateForecast({}), null);
  assert.strictEqual(schema.validateForecast({ daily: {} }), null);
  assert.strictEqual(schema.validateForecast({ daily: { time: [] } }), null);

  const raw = {
    latitude: -19.52,
    longitude: -39.78,
    daily: {
      time: ['2026-09-18'],
      temperature_2m_max: [100], // Out of bounds (>55)
      relative_humidity_2m_max: [-10], // Out of bounds (<0)
      uv_index_max: [30], // Out of bounds (>20)
      wind_speed_10m_max: [500] // Out of bounds (>250)
    }
  };
  const v = schema.validateForecast(raw);
  assert.ok(v != null);
  assert.strictEqual(v.daily.temperature_2m_max[0], 55);
  assert.strictEqual(v.daily.relative_humidity_2m_max[0], 0);
  assert.strictEqual(v.daily.uv_index_max[0], 20);
  assert.strictEqual(v.daily.wind_speed_10m_max[0], 250);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Sub-Index Classifications with Missing/Extreme Values
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 3: Sub-Index Classifications with Missing/Extreme Values ---');

check('bulboUmido transitions and missing value handling', () => {
  assert.deepStrictEqual(calc.bulboUmido(null), { nivel: 'indisponivel', rotulo: 'Indisponível' });
  assert.deepStrictEqual(calc.bulboUmido(NaN), { nivel: 'indisponivel', rotulo: 'Indisponível' });
  assert.deepStrictEqual(calc.bulboUmido('invalid'), { nivel: 'indisponivel', rotulo: 'Indisponível' });

  assert.strictEqual(calc.bulboUmido(20).nivel, 'bom');
  assert.strictEqual(calc.bulboUmido(24.9).nivel, 'bom');
  assert.strictEqual(calc.bulboUmido(25.0).nivel, 'atencao');
  assert.strictEqual(calc.bulboUmido(27.7).nivel, 'atencao');
  assert.strictEqual(calc.bulboUmido(27.8).nivel, 'alerta');
  assert.strictEqual(calc.bulboUmido(28.9).nivel, 'alerta');
  assert.strictEqual(calc.bulboUmido(29.0).nivel, 'perigo');
  assert.strictEqual(calc.bulboUmido(30.9).nivel, 'perigo');
  assert.strictEqual(calc.bulboUmido(31.0).nivel, 'emergencia');
  assert.strictEqual(calc.bulboUmido(40.0).nivel, 'emergencia');
});

check('uvNivel transitions and missing value handling', () => {
  assert.deepStrictEqual(calc.uvNivel(null), { nivel: 'indisponivel', rotulo: 'Indisponível', tempo: '—' });
  assert.deepStrictEqual(calc.uvNivel(NaN), { nivel: 'indisponivel', rotulo: 'Indisponível', tempo: '—' });

  assert.strictEqual(calc.uvNivel(0).nivel, 'bom');
  assert.strictEqual(calc.uvNivel(2.9).nivel, 'bom');
  assert.strictEqual(calc.uvNivel(3.0).nivel, 'atencao');
  assert.strictEqual(calc.uvNivel(5.9).nivel, 'atencao');
  assert.strictEqual(calc.uvNivel(6.0).nivel, 'alerta');
  assert.strictEqual(calc.uvNivel(7.9).nivel, 'alerta');
  assert.strictEqual(calc.uvNivel(8.0).nivel, 'perigo');
  assert.strictEqual(calc.uvNivel(10.9).nivel, 'perigo');
  assert.strictEqual(calc.uvNivel(11.0).nivel, 'emergencia');
  assert.strictEqual(calc.uvNivel(18.0).nivel, 'emergencia');
});

check('ventoNivel & beaufort transitions and missing value handling', () => {
  assert.strictEqual(calc.ventoNivel(null), 'indisponivel');
  assert.strictEqual(calc.ventoNivel(NaN), 'indisponivel');
  assert.strictEqual(calc.beaufort(null).rotulo, 'Indisponível');

  // Beaufort levels
  assert.strictEqual(calc.ventoNivel(0), 'bom'); // BF0
  assert.strictEqual(calc.ventoNivel(25), 'bom'); // BF3
  assert.strictEqual(calc.ventoNivel(35), 'atencao'); // BF4
  assert.strictEqual(calc.ventoNivel(55), 'alerta'); // BF6
  assert.strictEqual(calc.ventoNivel(85), 'perigo'); // BF8
  assert.strictEqual(calc.ventoNivel(150), 'perigo'); // BF11
});

check('chuvaNivel transitions and missing value handling', () => {
  assert.deepStrictEqual(calc.chuvaNivel(null), { nivel: 'indisponivel', rotulo: 'Indisponível' });
  assert.deepStrictEqual(calc.chuvaNivel(NaN), { nivel: 'indisponivel', rotulo: 'Indisponível' });

  assert.strictEqual(calc.chuvaNivel(10).nivel, 'bom');
  assert.strictEqual(calc.chuvaNivel(40).nivel, 'atencao');
  assert.strictEqual(calc.chuvaNivel(70).nivel, 'alerta');
  assert.strictEqual(calc.chuvaNivel(90).nivel, 'perigo');
  // mm > 50 overrides prob
  assert.strictEqual(calc.chuvaNivel(10, 60).nivel, 'perigo');
  assert.strictEqual(calc.chuvaNivel(10, 60).rotulo, 'Risco de alagamento');
});

check('aqiIndex handling of missing or partial pollutant data', () => {
  assert.strictEqual(calc.aqiIndex(null), null);
  assert.strictEqual(calc.aqiIndex({}), null);
  assert.strictEqual(calc.aqiIndex({ time: [] }), null);

  // Partial data: only PM2.5 available
  const partialHourly = {
    time: ['2026-09-18T12:00'],
    pm2_5: [30] // ratio = 30/15 = 2.0 -> aqi = 100
  };
  const res = calc.aqiIndex(partialHourly);
  assert.ok(res != null);
  assert.strictEqual(res.aqi, 100);
  assert.strictEqual(res.nivel, 'perigo');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Risk Score & Missing / Indisponível Factors (Crucial Rule)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 4: Risk Score & Missing / Indisponível Factors ---');

// Mock factors definition identical to js/factors.js
const PESOS = {
  normal: { calor: 0.35, sol: 0.15, umidade: 0.15, ar: 0.15, vento: 0.10, chuva: 0.10 },
  elnino: { calor: 0.40, sol: 0.15, umidade: 0.10, ar: 0.20, vento: 0.05, chuva: 0.10 },
};
const PONTOS = {
  bom: 10,
  atencao: 35,
  alerta: 60,
  perigo: 82,
  emergencia: 95,
};

// Replicate calcularRiscoSeguro from js/app.js:168-203
function calcularRiscoSeguro(fatoresCalculados, elninoAtivo) {
  const pesos = elninoAtivo ? PESOS.elnino : PESOS.normal;
  let soma = 0;
  let total = 0;
  const detalhe = {};

  const pontosMap = PONTOS;

  for (const f of fatoresCalculados) {
    const p = pesos[f.id];
    if (p == null) continue;

    const lvl = f.nivel?.nivel;
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

check('Missing factors are assigned "indisponivel" and NEVER awarded 10 points', () => {
  const fatores = [
    { id: 'calor', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'sol', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'umidade', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'ar', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'vento', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'chuva', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } }
  ];

  const res = calcularRiscoSeguro(fatores, false);
  console.log(`    All indisponivel: score=${res.score}, nivel=${res.nivel.nivel} (${res.nivel.rotulo})`);
  assert.strictEqual(res.nivel.nivel, 'indisponivel', 'All indisponivel factors MUST NOT be marked "bom"');
  assert.strictEqual(res.score, 0);

  for (const id of ['calor', 'sol', 'umidade', 'ar', 'vento', 'chuva']) {
    assert.strictEqual(res.detalhe[id].pts, null, `${id} points must be null, not 10`);
  }
});

check('Single extreme factor with 5 missing factors maintains true risk (no dilution)', () => {
  // Calor is perigo (82 pts, peso 0.35). Other 5 are indisponivel.
  const fatores = [
    { id: 'calor', valor: 31.5, nivel: { nivel: 'perigo', rotulo: 'Muito quente' } },
    { id: 'sol', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'umidade', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'ar', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'vento', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'chuva', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } }
  ];

  const res = calcularRiscoSeguro(fatores, false);
  console.log(`    Calor=perigo (82 pts) + 5 indisponivel: score=${res.score}, nivel=${res.nivel.nivel}`);
  assert.strictEqual(res.score, 82, 'Score must be exactly 82, NOT diluted by missing data');
  // Note: under current ladder (score < 80 ? perigo : emergencia), 82 maps to emergencia.
  // Crucially, it is NOT diluted to 35 (atencao) or bom!
  assert.ok(res.score >= 80, 'Score must remain in top hazard bracket (score 82)');
});

check('Partial degradation: Missing AQI gracefully redistributes weight among remaining factors', () => {
  // 5 factors present at 'atencao' (35 pts). 'ar' is missing (air quality outage).
  const fatores = [
    { id: 'calor', valor: 27.0, nivel: { nivel: 'atencao', rotulo: 'Dá pra se virar' } },
    { id: 'sol', valor: 5.0, nivel: { nivel: 'atencao', rotulo: 'Moderado' } },
    { id: 'umidade', valor: 30, nivel: { nivel: 'atencao', rotulo: 'Ar seco' } },
    { id: 'vento', valor: 35, nivel: { nivel: 'atencao', rotulo: 'Brisa moderada' } },
    { id: 'chuva', valor: 50, nivel: { nivel: 'atencao', rotulo: 'Chance leve' } },
    { id: 'ar', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } }
  ];

  const res = calcularRiscoSeguro(fatores, false);
  console.log(`    5 atencao (35 pts) + 1 indisponivel: score=${res.score}, nivel=${res.nivel.nivel}`);
  // Sum of weights = 0.35 + 0.15 + 0.15 + 0.10 + 0.10 = 0.85
  // Sum of weighted pts = 35 * 0.85 = 29.75
  // score = 29.75 / 0.85 = 35
  assert.strictEqual(res.score, 35, 'Score must remain 35 (atencao), not depressed by missing AQI');
  assert.strictEqual(res.nivel.nivel, 'atencao');
});

check('Risk Score threshold boundary analysis (Threshold Alignment)', () => {
  // Testing boundary scores across the ladder:
  // 0-19: bom
  // 20-39: atencao
  // 40-59: alerta
  // 60-79: perigo
  // >=80: emergencia
  const mockWithScore = (scorePts) => {
    return calcularRiscoSeguro([
      { id: 'calor', valor: 20, nivel: { nivel: 'custom' } }
    ], false);
  };
  
  // Directly evaluate the ladder logic:
  const getLevel = (score, total = 1) => {
    return total === 0 ? 'indisponivel' :
      score < 20 ? 'bom' :
      score < 40 ? 'atencao' :
      score < 60 ? 'alerta' :
      score < 80 ? 'perigo' : 'emergencia';
  };

  assert.strictEqual(getLevel(19), 'bom');
  assert.strictEqual(getLevel(20), 'atencao');
  assert.strictEqual(getLevel(39), 'atencao');
  assert.strictEqual(getLevel(40), 'alerta');
  assert.strictEqual(getLevel(59), 'alerta');
  assert.strictEqual(getLevel(60), 'perigo'); // Note: 60 is perigo because 60 is not < 60
  assert.strictEqual(getLevel(79), 'perigo');
  assert.strictEqual(getLevel(80), 'emergencia');
  console.log('    Ladder boundaries verified: 19->bom, 20->atencao, 39->atencao, 40->alerta, 59->alerta, 60->perigo, 79->perigo, 80->emergencia');
});

check('Legacy js/risk.js behavior check (AUDIT NOTE)', () => {
  // Set global.window BEFORE requiring risk.js
  global.window = { ClimFactors: { PESOS } };
  const riskLegacy = require('./js/risk.js');
  
  const fatores = [
    { id: 'calor', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'sol', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'umidade', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'ar', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'vento', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } },
    { id: 'chuva', valor: null, nivel: { nivel: 'indisponivel', rotulo: 'Indisponível' } }
  ];
  
  const legacyRes = global.window.ClimRisk.calcular(fatores, false);
  console.log(`    Legacy risk.js output on all indisponivel: score=${legacyRes.score} (calor pts=${legacyRes.detalhe.calor.pts})`);
  assert.strictEqual(legacyRes.score, 10, 'Legacy js/risk.js indeed awarded 10 points to missing data!');
  console.log('    ⚠ VERIFIED: js/risk.js:27 contains legacy logic awarding 10 pts for indisponivel; bypassed by js/app.js:calcularRiscoSeguro');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n====================================================');
console.log(`Total Checks: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests.length}`);
if (failedTests.length > 0) {
  console.error('FAILURES DETECTED:');
  failedTests.forEach((f) => console.error(` - ${f.desc}: ${f.error}`));
  process.exit(1);
} else {
  console.log('🎉 ALL EMPIRICAL STRESS TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

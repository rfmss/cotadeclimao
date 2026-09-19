/**
 * Unit Test Suite: test_m1_units.js
 * Comprehensive edge-case validation for Milestone M1
 */
const assert = require('assert');
const schema = require('./js/schema.js');
const calc = require('./js/calculations.js');
const storage = require('./js/storage.js');
const api = require('./js/api.js');

console.log('=== Início dos Testes Unitários M1 ===');

// 1. Testes de Schema & Limites
console.log('\n[1/4] Testando js/schema.js:');
{
  assert.strictEqual(schema.isValidNumber(25), true);
  assert.strictEqual(schema.isValidNumber(NaN), false);
  assert.strictEqual(schema.isValidNumber('25'), false);
  assert.strictEqual(schema.isValidNumber(Infinity), false);

  // Bounds clamping
  assert.strictEqual(schema.sanitizeBound(65, 'temperature'), 55);
  assert.strictEqual(schema.sanitizeBound(-30, 'temperature'), -20);
  assert.strictEqual(schema.sanitizeBound(120, 'humidity'), 100);
  assert.strictEqual(schema.sanitizeBound(-5, 'humidity'), 0);
  assert.strictEqual(schema.sanitizeBound(300, 'windSpeed'), 250);

  // Validate forecast
  const invalidForecast = schema.validateForecast({});
  assert.strictEqual(invalidForecast, null);

  const validRaw = {
    daily: {
      time: ['2026-09-18'],
      temperature_2m_max: [28.5]
    },
    hourly: {
      temperature_2m: [25]
    }
  };
  const validated = schema.validateForecast(validRaw);
  assert.strictEqual(validated._validated, true);
  assert.strictEqual(validated.daily.temperature_2m_max[0], 28.5);

  // Indisponivel factor creation
  const indisp = schema.createIndisponivelFactor({ id: 'ar', nome: 'Ar' });
  assert.strictEqual(indisp.nivel.nivel, 'indisponivel');
  assert.strictEqual(indisp.nivel.rotulo, 'Indisponível');
  assert.strictEqual(indisp.valor, null);

  console.log('  ✓ Validações de limites e contratos de schema passaram');
}

// 2. Testes de Cálculos & WBGT
console.log('\n[2/4] Testando js/calculations.js:');
{
  // Teste de atenuação por nuvens no WBGT (remoção do bug * 0)
  const wbgtClear = calc.wBGT({ temperature: 32, wetBulb: 26, solarRadiation: 900, windSpeed: 2, cloudCover: 0 });
  const wbgtOvercast = calc.wBGT({ temperature: 32, wetBulb: 26, solarRadiation: 900, windSpeed: 2, cloudCover: 100 });
  assert.ok(wbgtOvercast < wbgtClear, `WBGT nublado (${wbgtOvercast}) deve ser menor que céu limpo (${wbgtClear})`);

  // Robustez contra entradas inválidas/nulas
  assert.strictEqual(calc.wBGT({ temperature: null }), null);
  assert.strictEqual(calc.wBGT({ temperature: NaN }), null);
  assert.strictEqual(calc.ventoNivel(null), 'indisponivel');
  assert.strictEqual(calc.uvNivel(null).nivel, 'indisponivel');
  assert.strictEqual(calc.chuvaNivel(null).nivel, 'indisponivel');
  assert.strictEqual(calc.bulboUmido(null).nivel, 'indisponivel');

  // Stress acumulado
  assert.strictEqual(calc.stressAcumulado([28, 29, 28]), 3);
  assert.strictEqual(calc.stressAcumulado([28, 25, 29]), 1);

  console.log('  ✓ Correção da atenuação do WBGT e proteção contra nulos verificadas');
}

// 3. Testes de Storage Multi-Tier & Resolvedor de 16 Dias
console.log('\n[3/4] Testando js/storage.js:');
(async () => {
  const mockPayload = {
    forecast: {
      daily: {
        time: ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'],
        temperature_2m_max: [30, 31, 29, 28]
      }
    }
  };

  await storage.saveWeatherDay('2026-09-18', mockPayload);

  // 1. Busca exata
  const exact = await storage.loadWeatherDay('2026-09-18');
  assert.ok(exact != null);

  // 2. Busca por dia projetado da janela de 16 dias
  const projected = await storage.loadWeatherDay('2026-09-20');
  assert.ok(projected != null);
  assert.strictEqual(projected.isProjected, true);

  // 3. Busca por latest
  const latest = await storage.loadLatestWeather();
  assert.ok(latest != null);

  // 4. Meta storage
  await storage.saveMeta('test_key', 'test_value');
  const metaVal = await storage.loadMeta('test_key');
  assert.strictEqual(metaVal, 'test_value');

  console.log('  ✓ Persistência, snapshot "latest" e resolvedor de 16 dias validados com sucesso');

  // 4. Testes de API
  console.log('\n[4/4] Testando js/api.js:');
  const forecastUrl = api.buildUrl('forecast');
  assert.ok(forecastUrl.includes('relative_humidity_2m_max'), 'URL deve solicitar relative_humidity_2m_max');
  assert.ok(forecastUrl.includes('apparent_temperature_max'), 'URL deve solicitar apparent_temperature_max');
  assert.strictEqual(api.TIMEOUT, 5000, 'TIMEOUT deve ser 5000ms');
  assert.deepStrictEqual(api.RETRIES, [1000, 2000], 'RETRIES deve ter 2 tentativas com backoff');

  console.log('  ✓ Parâmetros de API, timeouts (5s) e retries (2) verificados');

  console.log('\n======================================================');
  console.log('✅ TODOS OS TESTES UNITÁRIOS M1 PASSARAM COM SUCESSO!');
  console.log('======================================================\n');
})();

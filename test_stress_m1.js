/**
 * Adversarial Stress Test Suite: test_stress_m1.js
 * Milestone M1: Data Engine & API Resilience
 * 
 * Empirical Challenger Test Harness covering:
 * 1. Multi-day projection lookups (+5 days, +15 days, +25 days beyond 16-day window)
 * 2. Corrupt / invalid storage resilience (syntax errors, non-objects, missing forecast)
 * 3. Partial network failures (Forecast OK + Marine/AQ down; Forecast down + Marine/AQ OK)
 * 4. Concurrent request deduplication
 * 5. Full Browser E2E stress via Playwright (simulated date advance, partial aborts, corrupt storage)
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const schema = require('./js/schema.js');
const calc = require('./js/calculations.js');
const api = require('./js/api.js');

let playwright;
try {
  playwright = require('playwright');
} catch (_) {
  if (process.env.NODE_PATH) {
    require('module').Module._initPaths();
    playwright = require('playwright');
  } else {
    console.warn('Playwright não disponível via require padrão; verificando NODE_PATH...');
  }
}

const ROOT_DIR = __dirname;
const findings = [];
let passCount = 0;
let failCount = 0;

function recordFinding(category, severity, title, detail) {
  findings.push({ category, severity, title, detail });
  console.log(`\n  🚨 [FINDING - ${severity.toUpperCase()}] ${category}: ${title}`);
  console.log(`     → ${detail}\n`);
}

function testPass(msg) {
  passCount++;
  console.log(`  ✓ ${msg}`);
}

function testFail(msg, err) {
  failCount++;
  console.error(`  ❌ FALHA: ${msg}`, err ? (err.message || err) : '');
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Multi-day Projection Resolution (Unit / Storage)
// ─────────────────────────────────────────────────────────────────────────────
async function runSuite1_MultiDayProjections() {
  console.log('\n======================================================');
  console.log('SUITE 1: Multi-day Projection Lookups (+5d, +15d, +25d)');
  console.log('======================================================');

  delete require.cache[require.resolve('./js/storage.js')];
  const storage = require('./js/storage.js');

  const baseDate = new Date(2026, 8, 18); // 2026-09-18
  const dailyTimes = [];
  const dailyTemps = [];
  for (let i = 0; i < 16; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dailyTimes.push(`${y}-${m}-${day}`);
    dailyTemps.push(28 + (i % 5));
  }

  const mockPayload = {
    forecast: {
      latitude: -19.52,
      longitude: -39.78,
      daily: {
        time: dailyTimes,
        temperature_2m_max: dailyTemps,
        temperature_2m_min: dailyTemps.map(t => t - 7),
        relative_humidity_2m_max: dailyTimes.map(() => 80),
        apparent_temperature_max: dailyTemps.map(t => t + 3),
        uv_index_max: dailyTimes.map(() => 7.5),
        wind_speed_10m_max: dailyTimes.map(() => 20),
        wind_gusts_10m_max: dailyTimes.map(() => 30),
        precipitation_probability_max: dailyTimes.map(() => 40),
        precipitation_sum: dailyTimes.map(() => 2.0),
      },
      hourly: {
        time: Array.from({ length: 24 }, (_, i) => `${dailyTimes[0]}T${String(i).padStart(2, '0')}:00`),
        temperature_2m: Array.from({ length: 24 }, () => 27),
        relative_humidity_2m: Array.from({ length: 24 }, () => 75),
        wet_bulb_temperature_2m: Array.from({ length: 24 }, () => 25),
        wind_speed_10m: Array.from({ length: 24 }, () => 15),
        shortwave_radiation: Array.from({ length: 24 }, () => 500),
        cloud_cover: Array.from({ length: 24 }, () => 20),
      }
    }
  };

  await storage.saveWeatherDay('2026-09-18', mockPayload);

  // 1.1: Exact Day Lookup (Day 0)
  try {
    const res0 = await storage.loadWeatherDay('2026-09-18');
    assert.ok(res0 != null, 'Deveria retornar dados para o dia 0');
    assert.strictEqual(res0.date, '2026-09-18');
    testPass('1.1: Busca exata do Dia 0 (2026-09-18) retornou com sucesso');
  } catch (e) {
    testFail('1.1: Busca exata Dia 0', e);
  }

  // 1.2: Day +5 Projection (2026-09-23)
  try {
    const res5 = await storage.loadWeatherDay('2026-09-23');
    assert.ok(res5 != null, 'Deveria resolver projeção para +5 dias');
    assert.strictEqual(res5.isProjected, true, 'isProjected deve ser true para +5 dias');
    assert.strictEqual(res5.date, '2026-09-23');
    const fcast5 = res5.data?.forecast || res5.data?.data?.forecast;
    assert.ok(fcast5?.daily?.time.includes('2026-09-23'), 'Projeção deve conter a data 2026-09-23');
    testPass('1.2: Resolução de Projeção +5 dias (2026-09-23) retornou isProjected=true');
  } catch (e) {
    testFail('1.2: Resolução +5 dias', e);
  }

  // 1.3: Day +15 Projection (2026-10-03) — Limite da janela de 16 dias
  try {
    const res15 = await storage.loadWeatherDay('2026-10-03');
    assert.ok(res15 != null, 'Deveria resolver projeção para +15 dias');
    assert.strictEqual(res15.isProjected, true, 'isProjected deve ser true no 16º dia');
    assert.strictEqual(res15.date, '2026-10-03');
    testPass('1.3: Resolução de Projeção no limite de 16 dias (+15 dias: 2026-10-03) retornou isProjected=true');
  } catch (e) {
    testFail('1.3: Resolução +15 dias', e);
  }

  // 1.4: Day +25 Projection (2026-10-13) — Além da janela de 16 dias
  try {
    const res25 = await storage.loadWeatherDay('2026-10-13');
    assert.ok(res25 != null, 'Deveria retornar fallback resiliente para dia além da janela');
    assert.strictEqual(res25.isStaleFallback, true, 'isStaleFallback deve ser true quando além de 16 dias');
    assert.ok(res25.data != null, 'Deve conter payload de dados no fallback');
    testPass('1.4: Fallback além de 16 dias (+25 dias: 2026-10-13) retornou isStaleFallback=true');
  } catch (e) {
    testFail('1.4: Fallback além de 16 dias', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Storage Corruption & Resilience (Isolated)
// ─────────────────────────────────────────────────────────────────────────────
async function runSuite2_StorageCorruption() {
  console.log('\n======================================================');
  console.log('SUITE 2: Corrupt / Invalid Storage Resilience');
  console.log('======================================================');

  const mockStorageMap = new Map();
  global.localStorage = {
    getItem: (k) => mockStorageMap.get(k) ?? null,
    setItem: (k, v) => mockStorageMap.set(k, String(v)),
    removeItem: (k) => mockStorageMap.delete(k),
    clear: () => mockStorageMap.clear()
  };

  // 2.1: JSON corrompido com erro de sintaxe no localStorage
  try {
    delete require.cache[require.resolve('./js/storage.js')];
    const isolatedStorage = require('./js/storage.js');
    mockStorageMap.clear();
    mockStorageMap.set('cota_latest_weather', '{{INVALID_SYNTAX_JSON');

    const loaded = await isolatedStorage.loadLatestWeather();
    assert.strictEqual(loaded, null, 'Deve retornar null quando storage possui JSON com sintaxe inválida');
    testPass('2.1: JSON com sintaxe inválida no localStorage tratado sem exceção (retornou null)');
  } catch (e) {
    testFail('2.1: JSON com sintaxe inválida', e);
  }

  // 2.2: JSON primitivo / não-objeto no localStorage
  try {
    delete require.cache[require.resolve('./js/storage.js')];
    const isolatedStorage = require('./js/storage.js');
    mockStorageMap.clear();
    mockStorageMap.set('cota_latest_weather', '12345');

    const loaded = await isolatedStorage.loadLatestWeather();
    assert.strictEqual(loaded, null, 'Deve ignorar número primitivo no storage');
    testPass('2.2: JSON primitivo (12345) no storage ignorado sem exceção (retornou null)');
  } catch (e) {
    testFail('2.2: JSON primitivo no storage', e);
  }

  // 2.3: Objeto sem campo data
  try {
    delete require.cache[require.resolve('./js/storage.js')];
    const isolatedStorage = require('./js/storage.js');
    mockStorageMap.clear();
    mockStorageMap.set('cota_latest_weather', JSON.stringify({ savedAt: 12345 }));

    const loaded = await isolatedStorage.loadLatestWeather();
    assert.strictEqual(loaded, null, 'Deve ignorar objeto sem campo data');
    testPass('2.3: Objeto sem campo data ignorado com segurança (retornou null)');
  } catch (e) {
    testFail('2.3: Objeto sem campo data', e);
  }

  // 2.4: Objeto com data = null
  try {
    delete require.cache[require.resolve('./js/storage.js')];
    const isolatedStorage = require('./js/storage.js');
    mockStorageMap.clear();
    mockStorageMap.set('cota_latest_weather', JSON.stringify({ data: null, savedAt: 12345 }));

    const loaded = await isolatedStorage.loadLatestWeather();
    assert.strictEqual(loaded, null, 'Deve ignorar objeto com data=null');
    testPass('2.4: Objeto com data=null ignorado com segurança (retornou null)');
  } catch (e) {
    testFail('2.4: Objeto com data=null', e);
  }

  // 2.5: Storage possui objeto com data sem forecast (verificação de integridade)
  try {
    delete require.cache[require.resolve('./js/storage.js')];
    const isolatedStorage = require('./js/storage.js');
    mockStorageMap.clear();
    mockStorageMap.set('cota_latest_weather', JSON.stringify({
      date: 'latest',
      data: { error: 'api_failure_payload' },
      savedAt: 1000
    }));

    const loadedDay = await isolatedStorage.loadWeatherDay('2026-09-18');
    assert.ok(loadedDay != null, 'loadWeatherDay deve retornar objeto de fallback');
    const rawData = loadedDay.data?.data ? loadedDay.data.data : loadedDay.data;
    assert.strictEqual(rawData.error, 'api_failure_payload', 'Payload corrompido carregado para teste de guarda em app.js');
    testPass('2.5: Storage retorna payload sem forecast; guarda delegada para bootstrap() em app.js');
  } catch (e) {
    testFail('2.5: Análise adversarial de payload', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Partial Network Failures & API Resilience
// ─────────────────────────────────────────────────────────────────────────────
async function runSuite3_PartialNetworkFailures() {
  console.log('\n======================================================');
  console.log('SUITE 3: Partial Network Failures & API Resilience');
  console.log('======================================================');

  const originalFetch = global.fetch;

  const validForecastRaw = {
    latitude: -19.52,
    longitude: -39.78,
    timezone: 'America/Sao_Paulo',
    daily: {
      time: ['2026-09-18'],
      temperature_2m_max: [30.0],
      temperature_2m_min: [20.0],
      relative_humidity_2m_max: [80],
      apparent_temperature_max: [33.0],
      uv_index_max: [8.0],
      wind_speed_10m_max: [20.0],
      wind_gusts_10m_max: [30.0],
      precipitation_probability_max: [20],
      precipitation_sum: [0.0]
    },
    hourly: {
      time: ['2026-09-18T12:00'],
      temperature_2m: [28.0],
      relative_humidity_2m: [70],
      wet_bulb_temperature_2m: [24.0],
      wind_speed_10m: [15.0],
      shortwave_radiation: [600],
      cloud_cover: [20],
      soil_moisture_0_to_10cm: [0.3],
      uv_index: [8.0]
    }
  };

  const validMarineRaw = {
    hourly: {
      time: ['2026-09-18T12:00'],
      wave_height: [1.8],
      wave_period: [9.0],
      sea_surface_temperature: [26.5]
    }
  };

  // 3.1: Cenário A: Forecast OK, Air Quality 500, Marine 500
  try {
    global.fetch = async (url) => {
      if (url.includes('forecast')) {
        return { ok: true, json: async () => validForecastRaw };
      }
      if (url.includes('air-quality')) {
        return { ok: false, status: 500, statusText: 'Internal Server Error' };
      }
      if (url.includes('marine')) {
        return { ok: false, status: 503, statusText: 'Service Unavailable' };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const resA = await api.fetchAll();
    assert.ok(resA.forecast != null, 'Forecast deve ser retornado');
    assert.strictEqual(resA.airQuality, null, 'Air Quality deve ser null (degradação graciosa)');
    assert.strictEqual(resA.marine, null, 'Marine deve ser null (degradação graciosa)');
    assert.ok(resA.elnino != null, 'El Niño deve fornecer fallback seguro quando marine falha');
    assert.strictEqual(resA.status.isOffline, false, 'isOffline deve ser false quando forecast respondeu');
    testPass('3.1: Degradação graciosa com Forecast OK + Air/Marine 500 validada');
  } catch (e) {
    testFail('3.1: Degradação graciosa', e);
  }

  // 3.2: Cenário B: Forecast 500, Air Quality OK, Marine OK
  try {
    global.fetch = async (url) => {
      if (url.includes('forecast')) {
        return { ok: false, status: 500, statusText: 'Internal Server Error' };
      }
      if (url.includes('air-quality')) {
        return {
          ok: true,
          json: async () => ({
            hourly: {
              time: ['2026-09-18T12:00'],
              pm2_5: [15],
              pm10: [30]
            }
          })
        };
      }
      if (url.includes('marine')) {
        return { ok: true, json: async () => validMarineRaw };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const resB = await api.fetchAll();
    assert.strictEqual(resB.forecast, null, 'Forecast deve ser null quando endpoint falha');
    assert.ok(resB.airQuality != null, 'Air Quality deve estar disponível');
    assert.ok(resB.marine != null, 'Marine deve estar disponível');
    assert.strictEqual(resB.status.isOffline, false, 'isOffline deve ser false quando outros endpoints respondem');
    testPass('3.2: Resiliência parcial com Forecast 500 + Air/Marine OK validada');
  } catch (e) {
    testFail('3.2: Resiliência parcial', e);
  }

  // 3.3: Cenário C: Deduplicação de chamadas concorrentes
  try {
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      await new Promise(r => setTimeout(r, 40));
      return { ok: true, json: async () => validForecastRaw };
    };

    const promises = [
      api.fetchForecast(),
      api.fetchForecast(),
      api.fetchForecast(),
      api.fetchForecast()
    ];
    const results = await Promise.all(promises);
    assert.strictEqual(callCount, 1, `Esperada 1 requisição na rede, obtidas ${callCount}`);
    assert.strictEqual(results.length, 4);
    testPass('3.3: Deduplicação de 4 requisições concorrentes em voo validada (1 requisição de rede)');
  } catch (e) {
    testFail('3.3: Deduplicação concorrente', e);
  }

  // 3.4: Validação do Schema Open-Meteo & Rejeição em api.js
  try {
    const invalidRaw = { daily: { incomplete: true } };
    const validated = schema.validateForecast(invalidRaw);
    assert.strictEqual(validated, null, 'Schema deve rejeitar payload forecast sem time e temperature');

    global.fetch = async () => ({ ok: true, json: async () => invalidRaw });
    let threw = false;
    try {
      await api.fetchForecast();
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('validação de schema'), `Mensagem esperada: ${e.message}`);
    }
    assert.ok(threw, 'api.fetchForecast deve lançar erro se schema falhar');
    testPass('3.4: api.fetchForecast() rejeita payload inválido de schema com sucesso (sem vazamento de raw)');
  } catch (e) {
    testFail('3.4: Análise fallback schema', e);
  }

  global.fetch = originalFetch;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Browser End-to-End Stress Tests (Playwright)
// ─────────────────────────────────────────────────────────────────────────────
function createStaticServer() {
  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(ROOT_DIR, decodeURIComponent(reqPath));

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function runSuite4_BrowserStressTests() {
  if (!playwright) {
    console.log('\n[PULANDO SUITE 4: Playwright não disponível]');
    return;
  }

  console.log('\n======================================================');
  console.log('SUITE 4: Browser E2E Stress Tests (Playwright / Chromium)');
  console.log('======================================================');

  const { server, url } = await createStaticServer();

  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const validForecast = {
    latitude: -19.52,
    longitude: -39.78,
    timezone: 'America/Sao_Paulo',
    daily: {
      time: [todayStr, '2026-09-19', '2026-09-20', '2026-09-21'],
      temperature_2m_max: [31.5, 30.0, 29.5, 28.0],
      temperature_2m_min: [22.0, 21.5, 21.0, 20.0],
      relative_humidity_2m_max: [82, 80, 78, 85],
      apparent_temperature_max: [35.2, 33.1, 32.0, 30.5],
      uv_index_max: [7.8, 8.0, 7.5, 6.0],
      wind_speed_10m_max: [24.5, 22.0, 20.0, 18.0],
      wind_gusts_10m_max: [38.0, 35.0, 32.0, 28.0],
      precipitation_probability_max: [45, 30, 20, 10],
      precipitation_sum: [4.2, 1.0, 0.0, 0.0],
      sunrise: [`${todayStr}T05:45`],
      sunset: [`${todayStr}T17:45`]
    },
    hourly: {
      time: Array.from({ length: 24 }, (_, i) => `${todayStr}T${String(i).padStart(2, '0')}:00`),
      temperature_2m: Array.from({ length: 24 }, () => 28.5),
      relative_humidity_2m: Array.from({ length: 24 }, () => 75),
      apparent_temperature: Array.from({ length: 24 }, () => 32.0),
      wet_bulb_temperature_2m: Array.from({ length: 24 }, () => 26.2),
      wind_speed_10m: Array.from({ length: 24 }, () => 18.0),
      shortwave_radiation: Array.from({ length: 24 }, () => 650),
      cloud_cover: Array.from({ length: 24 }, () => 30),
      soil_moisture_0_to_10cm: Array.from({ length: 24 }, () => 0.28),
      uv_index: Array.from({ length: 24 }, () => 7.5)
    }
  };

  // 4.1: Teste E2E de Degradação Graciosa: Marine 500 + Air 500 com Forecast 200 OK
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const t = msg.text();
        if (!t.includes('net::ERR_') && !t.includes('Failed to load resource')) {
          consoleErrors.push(t);
        }
      }
    });

    await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
    await page.route('**/*open-meteo.com/v1/forecast*', r => {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(validForecast) });
    });
    await page.route('**/*open-meteo.com/v1/air-quality*', r => r.fulfill({ status: 500, body: 'Server error' }));
    await page.route('**/*open-meteo.com/v1/marine*', r => r.fulfill({ status: 503, body: 'Service unavailable' }));

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });

    const state = await page.evaluate(() => {
      const fakeScore = document.getElementById('fake-score')?.textContent?.trim();
      const arFactor = Array.from(document.querySelectorAll('.factor')).find(f => f.querySelector('.factor-name')?.textContent?.includes('Ar'));
      const arGauge = arFactor?.querySelector('.factor-gauge')?.textContent?.trim();
      const bannerHidden = document.getElementById('conn-banner')?.hidden;
      return { fakeScore, arGauge, bannerHidden };
    });

    assert.ok(state.fakeScore && !isNaN(parseInt(state.fakeScore, 10)), 'Score deve ser calculado com Air/Marine caídos');
    assert.strictEqual(state.arGauge, 'INDISPONÍVEL', 'Cota de Ar deve exibir INDISPONÍVEL');
    assert.strictEqual(state.bannerHidden, true, 'Banner offline deve estar oculto pois forecast foi carregado online');
    assert.strictEqual(consoleErrors.length, 0, `Esperados 0 console errors, encontrados ${consoleErrors.length}`);
    testPass('4.1: E2E Browser: Degradação graciosa online (Marine/Air 500) validada com 0 erros de console');

    await context.close();
  } catch (e) {
    testFail('4.1: E2E Degradação graciosa', e);
  }

  // 4.2: Teste E2E de Projeção no Navegador: Cache de Hoje consultado em Hoje + 5 dias (Offline)
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));

    const times16 = [];
    for (let i = 0; i < 16; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      times16.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    const forecast16 = {
      ...validForecast,
      daily: {
        ...validForecast.daily,
        time: times16,
        temperature_2m_max: times16.map((_, i) => 28 + (i % 4)),
        temperature_2m_min: times16.map(() => 20),
        relative_humidity_2m_max: times16.map(() => 80),
        apparent_temperature_max: times16.map((_, i) => 30 + (i % 4)),
        uv_index_max: times16.map(() => 7.0),
        wind_speed_10m_max: times16.map(() => 18),
        wind_gusts_10m_max: times16.map(() => 28),
        precipitation_probability_max: times16.map(() => 20),
        precipitation_sum: times16.map(() => 0),
      }
    };

    await page.route('**/*open-meteo.com/v1/forecast*', r => {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(forecast16) });
    });
    await page.route('**/*open-meteo.com/v1/air-quality*', r => r.fulfill({ status: 200, body: '{}' }));
    await page.route('**/*open-meteo.com/v1/marine*', r => r.fulfill({ status: 200, body: '{}' }));

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });

    // Simula navegação offline no dia +5 (2026-09-23)
    await page.unroute('**/*open-meteo.com/**');
    await page.route('**/*open-meteo.com/**', r => r.abort('aborted'));

    const futureDateStr = times16[5];
    const targetTime = new Date(`${futureDateStr}T12:00:00Z`).getTime();
    await page.addInitScript((time) => {
      const _origDate = Date;
      Date = class extends _origDate {
        constructor(...args) {
          if (args.length === 0) super(time);
          else super(...args);
        }
        static now() { return time; }
      };
    }, targetTime);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });

    const projectedState = await page.evaluate(() => {
      const score = document.getElementById('fake-score')?.textContent?.trim();
      const banner = document.getElementById('conn-banner')?.textContent?.trim();
      return { score, banner };
    });

    assert.ok(projectedState.score && !isNaN(parseInt(projectedState.score, 10)), 'Score deve ser calculado da projeção');
    assert.ok(projectedState.banner && projectedState.banner.includes('CACHE'), 'Banner offline deve indicar cache');
    testPass(`4.2: E2E Browser: Resolução de projeção offline em +5 dias (${futureDateStr}) renderizou com score ${projectedState.score}`);

    await context.close();
  } catch (e) {
    testFail('4.2: E2E Projeção +5 dias', e);
  }

  // 4.3: Teste E2E Adversarial: Injeção de Storage Corrompido (sem forecast)
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
    await page.route('**/*open-meteo.com/**', r => r.abort('aborted'));

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Limpa IndexedDB e localStorage para garantir isolamento puro de teste
    await page.evaluate(async () => {
      localStorage.clear();
      // Remove bancos IndexedDB existentes
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('cota-do-climao');
      }
    });

    // Injeta registro corrompido (sem forecast) em localStorage e IndexedDB
    await page.evaluate(async () => {
      const corruptEntry = {
        date: 'latest',
        data: { error: 'api_corrupt_payload_without_forecast' },
        savedAt: Date.now()
      };
      localStorage.setItem('cota_latest_weather', JSON.stringify(corruptEntry));
      localStorage.setItem('cota_weather_latest', JSON.stringify(corruptEntry));
    });

    // Recarrega offline com cache corrompido
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });

    const result = await page.evaluate(() => {
      const state = document.getElementById('app-main')?.getAttribute('data-state');
      const errBox = document.getElementById('err-box');
      const errVisible = errBox && !errBox.hidden;
      const errText = errBox?.textContent?.trim();
      return { state, errVisible, errText };
    });

    if (pageErrors.length > 0) {
      recordFinding(
        'Storage Fallback / Unhandled Exception',
        'high',
        'Exceção não tratada ao inicializar dashboard com cache corrompido',
        `Ao carregar o app offline com cache sem forecast, ocorreu a exceção não tratada: "${pageErrors[0]}". O dashboard congelou em data-state="${result.state}".`
      );
    } else if (result.state !== 'ready' || !result.errVisible) {
      recordFinding(
        'UI Error State',
        'medium',
        'Dashboard preso no estado "loading" quando cache está corrompido',
        `Com storage corrompido, data-state="${result.state}". O dashboard deveria exibir a tela de erro graciosa ("#err-box") e transicionar para "ready".`
      );
    } else {
      testPass('4.3: E2E Browser: Storage corrompido tratado graciosamente');
    }

    await context.close();
  } catch (e) {
    testFail('4.3: E2E Storage corrompido', e);
  }

  // 4.4: Teste E2E de Cache Totalmente Vazio / Sem Conexão
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
    await page.route('**/*open-meteo.com/**', r => r.abort('aborted'));

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Limpa completamente IndexedDB e localStorage
    await page.evaluate(async () => {
      localStorage.clear();
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('cota-do-climao');
      }
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });

    const cleanResult = await page.evaluate(() => {
      const errBox = document.getElementById('err-box');
      return {
        errVisible: errBox && !errBox.hidden,
        errText: errBox?.textContent?.trim(),
        appState: document.getElementById('app-main')?.getAttribute('data-state')
      };
    });

    assert.strictEqual(cleanResult.appState, 'ready', 'data-state deve ser "ready"');
    assert.strictEqual(cleanResult.errVisible, true, 'err-box deve estar visível');
    assert.ok(cleanResult.errText && cleanResult.errText.includes('SEM CONEXÃO E SEM REGISTRO'), 'Texto deve indicar sem conexão');
    assert.strictEqual(pageErrors.length, 0, 'Zero page errors esperados');
    testPass('4.4: E2E Browser: Cache totalmente vazio offline exibe tela amigável "SEM CONEXÃO" com 0 erros');

    await context.close();
  } catch (e) {
    testFail('4.4: E2E Cache vazio', e);
  }

  // 4.5: Teste E2E de Redundância Multi-Tier (IndexedDB intacto quando localStorage está com sintaxe corrompida)
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));

    // Popula IndexedDB online primeiro
    await page.route('**/*open-meteo.com/v1/forecast*', r => {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(validForecast) });
    });
    await page.route('**/*open-meteo.com/v1/air-quality*', r => r.fulfill({ status: 200, body: '{}' }));
    await page.route('**/*open-meteo.com/v1/marine*', r => r.fulfill({ status: 200, body: '{}' }));

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });

    // Agora corrompe o localStorage com sintaxe inválida
    await page.evaluate(() => {
      localStorage.setItem('cota_latest_weather', '{{{INVALID_SYNTAX_JSON');
      localStorage.setItem('cota_weather_latest', '{{{INVALID_SYNTAX_JSON');
    });

    // Bloqueia rede
    await page.unroute('**/*open-meteo.com/**');
    await page.route('**/*open-meteo.com/**', r => r.abort('aborted'));

    // Recarrega: o app deve recuperar do IndexedDB com sucesso!
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });

    const recoveryState = await page.evaluate(() => {
      const score = document.getElementById('fake-score')?.textContent?.trim();
      const banner = document.getElementById('conn-banner')?.textContent?.trim();
      return { score, banner };
    });

    assert.ok(recoveryState.score && !isNaN(parseInt(recoveryState.score, 10)), 'Score deve ser recuperado do IndexedDB');
    assert.ok(recoveryState.banner && recoveryState.banner.includes('CACHE'), 'Banner de cache deve estar ativo');
    testPass(`4.5: E2E Browser: Redundância Multi-Tier — Recuperação com sucesso via IndexedDB mesmo com localStorage corrompido (Score: ${recoveryState.score})`);

    await context.close();
  } catch (e) {
    testFail('4.5: E2E Redundância Multi-Tier', e);
  }

  await browser.close();
  server.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// Execução Principal
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('######################################################');
  console.log('BATERIA DE TESTES DE STRESS EMPÍRICO M1 (CHALLENGER 1)');
  console.log('######################################################');

  await runSuite1_MultiDayProjections();
  await runSuite2_StorageCorruption();
  await runSuite3_PartialNetworkFailures();
  await runSuite4_BrowserStressTests();

  console.log('\n######################################################');
  console.log('RESULTADO DOS TESTES DE STRESS M1:');
  console.log(`Testes executados com sucesso: ${passCount}`);
  console.log(`Testes com falha: ${failCount}`);
  console.log(`Findings adversariais identificados: ${findings.length}`);

  if (findings.length > 0) {
    console.log('\nDETALHES DOS FINDINGS ADVERSARIAIS:');
    findings.forEach((f, idx) => {
      console.log(`\n[${idx + 1}] (${f.severity.toUpperCase()}) ${f.category}: ${f.title}`);
      console.log(`    ${f.detail}`);
    });
  }

  console.log('\n######################################################\n');
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Erro fatal no executor de stress:', err);
  process.exit(1);
});

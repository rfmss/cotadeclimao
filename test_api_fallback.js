/**
 * Automated Fallback Test: test_api_fallback.js
 * Milestones M1 / Requirement R1
 * 
 * Verifies that when all Open-Meteo API endpoints fail (100% network failure),
 * the application cleanly loads and renders the cached state with zero console errors.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Carrega Playwright do cache npm se necessário
let playwright;
try {
  playwright = require('playwright');
} catch (_) {
  if (process.env.NODE_PATH) {
    require('module').Module._initPaths();
    playwright = require('playwright');
  } else {
    throw new Error('Playwright não encontrado. Defina NODE_PATH apropriadamente.');
  }
}

const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function createStaticServer() {
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

function generateMockWeatherData() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  return {
    forecast: {
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
    },
    airQuality: {
      hourly: {
        time: Array.from({ length: 24 }, (_, i) => `${todayStr}T${String(i).padStart(2, '0')}:00`),
        pm2_5: Array.from({ length: 24 }, () => 14),
        pm10: Array.from({ length: 24 }, () => 28),
        ozone: Array.from({ length: 24 }, () => 45),
        nitrogen_dioxide: Array.from({ length: 24 }, () => 16),
        european_aqi: Array.from({ length: 24 }, () => 2),
        us_aqi: Array.from({ length: 24 }, () => 35)
      }
    },
    marine: {
      hourly: {
        time: Array.from({ length: 24 }, (_, i) => `${todayStr}T${String(i).padStart(2, '0')}:00`),
        wave_height: Array.from({ length: 24 }, () => 1.5),
        wave_period: Array.from({ length: 24 }, () => 8),
        wave_direction: Array.from({ length: 24 }, () => 90),
        ocean_current_velocity: Array.from({ length: 24 }, () => 0.3),
        sea_surface_temperature: Array.from({ length: 24 }, () => 26.0)
      }
    }
  };
}

async function runTest() {
  console.log('=== Início do Teste: test_api_fallback.js ===');

  const { server, url } = await createStaticServer();
  console.log(`[1/6] Servidor local HTTP iniciado em: ${url}`);

  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-preconnect', '--dns-prefetch-disable']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const mockData = generateMockWeatherData();

  // Rotas para isolamento e mock inicial
  await page.route('**/*unpkg.com/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mock icon */' });
  });
  await page.route('**/*fonts.googleapis.com/**', (route) => {
    route.fulfill({ status: 200, contentType: 'text/css', body: '/* mock font */' });
  });
  await page.route('**/*fonts.gstatic.com/**', (route) => {
    route.fulfill({ status: 200, body: '' });
  });

  // Fase 1: Prime o cache fornecendo respostas válidas da API
  await page.route('**/*open-meteo.com/v1/forecast*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockData.forecast) });
  });
  await page.route('**/*open-meteo.com/v1/air-quality*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockData.airQuality) });
  });
  await page.route('**/*open-meteo.com/v1/marine*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockData.marine) });
  });

  console.log('[2/6] Carregando a aplicação para popular o cache local (IndexedDB + localStorage)...');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });

  // Confirma que dados foram salvos no storage
  const storageReady = await page.evaluate(async () => {
    if (!window.ClimStorage) return false;
    const snap = await window.ClimStorage.loadLatestWeather();
    return Boolean(snap && snap.data);
  });
  console.log(`[3/6] Cache populado com sucesso: ${storageReady}`);
  if (!storageReady) {
    throw new Error('Falha ao popular o cache na fase de aquecimento.');
  }

  // Fase 2: Simulação de Apagão Total da API (100% de falha em open-meteo.com)
  console.log('[4/6] Configurando bloqueio total (100% abort) para open-meteo.com...');
  await page.unroute('**/*open-meteo.com/v1/forecast*');
  await page.unroute('**/*open-meteo.com/v1/air-quality*');
  await page.unroute('**/*open-meteo.com/v1/marine*');
  await page.unroute('**/*open-meteo.com/**');
  await page.route('**/*open-meteo.com/**', (route) => {
    route.abort('aborted');
  });

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Não contabiliza mensagens nativas do C++ do Chromium de recusa de rede
      if (!text.includes('net::ERR_') && !text.includes('Failed to load resource')) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });

  // Fase 3: Recarrega o app no estado de falha de rede
  console.log('[5/6] Recarregando dashboard em modo offline / falha total de API...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });

  // Fase 4: Asserções da interface e do estado do cache
  console.log('[6/6] Executando asserções de resiliência e integridade do dashboard...');

  const appState = await page.evaluate(() => {
    const app = document.getElementById('app-main');
    const fakeScore = document.getElementById('fake-score');
    const scoreLabel = document.getElementById('score-label');
    const trafficCard = document.getElementById('traffic-card');
    const connBanner = document.getElementById('conn-banner');
    const factors = Array.from(document.querySelectorAll('#factor-list .factor')).map((el) => {
      const name = el.querySelector('.factor-name')?.textContent?.trim() || '';
      const gauge = el.querySelector('.factor-gauge')?.textContent?.trim() || '';
      const val = el.querySelector('.factor-value')?.textContent?.trim() || '';
      return { name, gauge, val };
    });

    return {
      dataState: app?.getAttribute('data-state'),
      scoreText: fakeScore?.textContent?.trim(),
      scoreLabel: scoreLabel?.textContent?.trim(),
      trafficCardClass: trafficCard?.className,
      bannerHidden: connBanner?.hidden,
      bannerText: connBanner?.textContent?.trim(),
      factorsCount: factors.length,
      factors
    };
  });

  console.log('Resultados observados na UI:');
  console.log(`- data-state: "${appState.dataState}"`);
  console.log(`- score: "${appState.scoreText}" (${appState.scoreLabel})`);
  console.log(`- banner offline: visible=${!appState.bannerHidden} ("${appState.bannerText}")`);
  console.log(`- total de cotas renderizadas: ${appState.factorsCount}`);

  // Validações
  if (appState.dataState !== 'ready') {
    throw new Error(`data-state esperado 'ready', mas obtido '${appState.dataState}'`);
  }

  const numScore = parseInt(appState.scoreText, 10);
  if (isNaN(numScore) || numScore < 0 || numScore > 100) {
    throw new Error(`fake-score inválido: '${appState.scoreText}'`);
  }

  if (appState.bannerHidden === true) {
    throw new Error('O banner offline (#conn-banner) deveria estar visível em modo fallback!');
  }

  if (!appState.bannerText || !appState.bannerText.includes('CACHE')) {
    throw new Error(`Banner offline não contém indicação de cache esperada: '${appState.bannerText}'`);
  }

  if (appState.factorsCount !== 6) {
    throw new Error(`Esperado 6 fatores renderizados, mas encontrado ${appState.factorsCount}`);
  }

  for (const factor of appState.factors) {
    if (!factor.name || !factor.gauge) {
      throw new Error(`Fator corrompido ou incompleto: ${JSON.stringify(factor)}`);
    }
    console.log(`  ✓ Cota [${factor.name}]: ${factor.val} (${factor.gauge})`);
  }

  // Asserção crítica: zero console errors
  const totalErrors = [...consoleErrors, ...pageErrors];
  console.log(`Console errors registrados: ${totalErrors.length}`);
  if (totalErrors.length > 0) {
    console.error('Erros no console detectados durante renderização em fallback:');
    totalErrors.forEach((e, idx) => console.error(` [${idx + 1}] ${e}`));
    throw new Error(`Falha de aceitação: esperados 0 erros no console, encontrados ${totalErrors.length}`);
  }

  console.log('\n======================================================');
  console.log('✅ TESTE APROVADO COM SUCESSO: R1 Motor de Dados & API Resiliente');
  console.log(' - API Open-Meteo abortada em 100% das requisições');
  console.log(' - Dashboard renderizou estado cached perfeitamente');
  console.log(' - 0 erros no console');
  console.log('======================================================\n');

  await browser.close();
  server.close();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('\n❌ TESTE FALHOU:', err.message);
  process.exit(1);
});

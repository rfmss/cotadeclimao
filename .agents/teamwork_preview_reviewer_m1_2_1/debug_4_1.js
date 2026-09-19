const http = require('http');
const fs = require('fs');
const path = require('path');

let playwright;
try {
  playwright = require('playwright');
} catch (_) {
  if (process.env.NODE_PATH) {
    require('module').Module._initPaths();
    playwright = require('playwright');
  }
}

const ROOT_DIR = path.resolve(__dirname, '../../');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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

async function debug() {
  const { server, url } = await createStaticServer();
  console.log('Server running at', url);

  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
  page.on('requestfinished', req => console.log('REQ FINISHED:', req.url()));

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

  await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, body: '' }));
  await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, body: '' }));
  await page.route('**/*open-meteo.com/v1/forecast*', r => {
    console.log('Intercepted forecast route');
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(validForecast) });
  });
  await page.route('**/*open-meteo.com/v1/air-quality*', r => {
    console.log('Intercepted air-quality route');
    r.fulfill({ status: 500, body: 'Server error' });
  });
  await page.route('**/*open-meteo.com/v1/marine*', r => {
    console.log('Intercepted marine route');
    r.fulfill({ status: 503, body: 'Service unavailable' });
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // wait up to 15 seconds, check state every second
  for (let s = 0; s < 12; s++) {
    await new Promise(r => setTimeout(r, 1000));
    const state = await page.evaluate(() => {
      const app = document.getElementById('app-main');
      return {
        dataState: app?.getAttribute('data-state'),
        errBoxHidden: document.getElementById('err-box')?.hidden,
        errBoxText: document.getElementById('err-box')?.textContent,
      };
    });
    console.log(`[t=${s + 1}s] state:`, state);
    if (state.dataState === 'ready') {
      console.log('READY REACHED!');
      break;
    }
  }

  await browser.close();
  server.close();
}

debug().catch(console.error);

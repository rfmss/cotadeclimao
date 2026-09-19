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

const ROOT_DIR = '/home/rafamass/Área de trabalho/COTADECLIMAO';

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
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

async function run() {
  const { server, port } = await createStaticServer();
  const url = `http://127.0.0.1:${port}`;

  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Add console listener with page timestamps
  page.on('console', msg => console.log('PAGE:', msg.type(), msg.text()));

  await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, body: '' }));
  await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, body: '' }));
  await page.route('**/*open-meteo.com/**', r => r.abort('failed'));

  // Inject console.time in bootstrap
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      console.log('INIT SCRIPT DOMContentLoaded');
    });
  });

  console.log('Starting goto...');
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  console.log('goto domcontentloaded in', Date.now() - t0, 'ms');

  // Let's measure how long bootstrap takes
  const res = await page.evaluate(async () => {
    const t0 = performance.now();
    // Check state every 100ms
    return new Promise(resolve => {
      const interval = setInterval(() => {
        const state = document.getElementById('app-main')?.getAttribute('data-state');
        if (state === 'ready') {
          clearInterval(interval);
          resolve({ time: performance.now() - t0, state });
        }
        if (performance.now() - t0 > 15000) {
          clearInterval(interval);
          resolve({ time: performance.now() - t0, state, timeout: true });
        }
      }, 50);
    });
  });

  console.log('Bootstrap finished in evaluate:', res);

  await browser.close();
  server.close();
}

run().catch(console.error);

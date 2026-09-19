const http = require('http');
const fs = require('fs');
const path = require('path');
const playwright = require('playwright');

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
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` })));
}

async function run() {
  const { server, url } = await createStaticServer();

  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const tStart = Date.now();
  page.on('request', req => {
    console.log(`[+${Date.now() - tStart}ms] REQ: ${req.method()} ${req.url()}`);
  });
  page.on('requestfinished', req => {
    console.log(`[+${Date.now() - tStart}ms] FIN: ${req.url()}`);
  });
  page.on('requestfailed', req => {
    console.log(`[+${Date.now() - tStart}ms] FAIL: ${req.url()} (${req.failure()?.errorText})`);
  });

  await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
  await page.route('**/*open-meteo.com/**', r => r.abort('failed'));

  console.log(`[+${Date.now() - tStart}ms] Calling page.goto...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  console.log(`[+${Date.now() - tStart}ms] DOMContentLoaded fired!`);

  console.log(`[+${Date.now() - tStart}ms] Waiting for ready...`);
  await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 30000 });
  console.log(`[+${Date.now() - tStart}ms] Ready fired!`);

  await browser.close();
  server.close();
}

run().catch(console.error);

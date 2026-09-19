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
  console.log('Server started on', url);

  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  console.log('Testing context 1...');
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await p1.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, body: '' }));
  await p1.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, body: '' }));
  await p1.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
  await p1.route('**/*open-meteo.com/**', r => r.abort('failed'));
  
  const t0 = Date.now();
  await p1.goto(url, { waitUntil: 'domcontentloaded' });
  console.log('ctx1 goto in', Date.now() - t0, 'ms');
  await p1.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });
  console.log('ctx1 ready in', Date.now() - t0, 'ms');
  await ctx1.close();

  console.log('Testing context 2...');
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, body: '' }));
  await p2.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, body: '' }));
  await p2.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
  await p2.route('**/*open-meteo.com/**', r => r.abort('failed'));
  
  const t1 = Date.now();
  await p2.goto(url, { waitUntil: 'domcontentloaded' });
  console.log('ctx2 goto in', Date.now() - t1, 'ms');
  await p2.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });
  console.log('ctx2 ready in', Date.now() - t1, 'ms');
  await ctx2.close();

  await browser.close();
  server.close();
  console.log('Done cleanly!');
}

run().catch(console.error);

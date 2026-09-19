// audit_runner.js - Script to audit Cota de Climão current UI layout, contrast, and 100vh constraints
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/rafamass/Área de trabalho/COTADECLIMAO';

// 1. Simple static file server
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

async function main() {
  await new Promise(resolve => server.listen(8082, '127.0.0.1', resolve));
  console.log('Static server listening on http://127.0.0.1:8082');

  const chrome = spawn('/usr/bin/chromium', [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=/tmp/chrome_audit_profile_' + Date.now(),
    '--remote-debugging-port=9223',
    '--remote-debugging-address=127.0.0.1'
  ]);

  let wsUrl = null;
  chrome.stderr.on('data', d => {
    const text = d.toString();
    const m = text.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:9223\/devtools\/browser\/[a-f0-9-]+)/);
    if (m) wsUrl = m[1];
  });

  while (!wsUrl) {
    await new Promise(r => setTimeout(r, 100));
  }

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  await new Promise(resolve => ws.onopen = resolve);

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  const targetRes = await send('Target.createTarget', { url: 'http://127.0.0.1:8082' });
  const targetId = targetRes.result.targetId;
  const attachRes = await send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = attachRes.result.sessionId;

  function sendSession(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
    });
  }

  await sendSession('Page.enable');
  await sendSession('Runtime.enable');
  await sendSession('DOM.enable');

  const viewports = [
    { name: 'Desktop 1080p', width: 1920, height: 1080 },
    { name: 'Desktop 768p', width: 1366, height: 768 },
    { name: 'Desktop Compact 720p', width: 1280, height: 720 },
    { name: 'Tablet 768p', width: 1024, height: 768 },
    { name: 'Mobile Standard (iPhone 13)', width: 390, height: 844 },
    { name: 'Mobile Compact (Android 360)', width: 360, height: 800 },
    { name: 'Mobile Small (320x568)', width: 320, height: 568 }
  ];

  for (const vp of viewports) {
    await sendSession('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width < 600
    });

    await sendSession('Page.navigate', { url: 'http://127.0.0.1:8082' });
    await new Promise(r => setTimeout(r, 1200));

    const auditCode = `
      (function() {
        const docH = document.documentElement.scrollHeight;
        const winH = window.innerHeight;
        const bodyH = document.body.scrollHeight;
        const overflow = docH > winH || bodyH > winH;

        // Elements check
        const factorEls = Array.from(document.querySelectorAll('.factor'));
        const factorDetails = factorEls.map(f => {
          const rect = f.getBoundingClientRect();
          const name = f.querySelector('.factor-name')?.textContent?.trim();
          const val = f.querySelector('.factor-value')?.textContent?.trim();
          const gauge = f.querySelector('.factor-gauge')?.textContent?.trim();
          const cs = window.getComputedStyle(f);
          const gaugeCs = f.querySelector('.factor-gauge') ? window.getComputedStyle(f.querySelector('.factor-gauge')) : null;
          return {
            name, val, gauge,
            box: { w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top), bottom: Math.round(rect.bottom) },
            cardOverflows: f.scrollHeight > f.clientHeight,
            bg: cs.backgroundColor,
            color: cs.color,
            gaugeBg: gaugeCs?.backgroundColor,
            gaugeColor: gaugeCs?.color
          };
        });

        const traffic = document.getElementById('traffic-card');
        const trafficCs = traffic ? window.getComputedStyle(traffic) : null;
        const trafficRect = traffic ? traffic.getBoundingClientRect() : null;

        // Check font loading
        const bodyCs = window.getComputedStyle(document.body);
        const logoCs = window.getComputedStyle(document.querySelector('.logo'));

        return {
          viewport: { w: window.innerWidth, h: window.innerHeight },
          pageDimensions: { docH, bodyH, winH, overflow, overflowPx: Math.max(0, docH - winH) },
          fonts: {
            bodyFont: bodyCs.fontFamily,
            logoFont: logoCs.fontFamily
          },
          trafficCard: {
            classes: traffic?.className,
            bg: trafficCs?.backgroundColor,
            color: trafficCs?.color,
            box: trafficRect ? { w: Math.round(trafficRect.width), h: Math.round(trafficRect.height) } : null,
            overflows: traffic ? traffic.scrollHeight > traffic.clientHeight : false
          },
          factorCount: factorEls.length,
          factors: factorDetails
        };
      })()
    `;

    const evalRes = await sendSession('Runtime.evaluate', { expression: auditCode, returnByValue: true });
    const val = evalRes.result?.result?.value;
    console.log(`\n=================== ${vp.name} (${vp.width}x${vp.height}) ===================`);
    console.log(JSON.stringify(val, null, 2));
  }

  chrome.kill();
  server.close();
}

main().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});

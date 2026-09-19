// test_rendered_state.js
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/rafamass/Área de trabalho/COTADECLIMAO';

// Mock data generator for 5 weather profiles
function getMockData(profile) {
  const hoy = new Date().toISOString().split('T')[0];
  const hourlyTimes = Array.from({length: 24}, (_, i) => `${hoy}T${String(i).padStart(2, '0')}:00`);

  let temp = 28, wbgt = 26, uv = 5, wind = 20, hum = 60, aqi = 30, rain = 10, rainSum = 0;
  if (profile === 'extremo_calor') {
    temp = 42; wbgt = 33.5; uv = 12; wind = 15; hum = 85; aqi = 60; rain = 0; rainSum = 0;
  } else if (profile === 'tempestade') {
    temp = 22; wbgt = 21; uv = 2; wind = 65; hum = 95; aqi = 20; rain = 95; rainSum = 45;
  } else if (profile === 'ar_critico') {
    temp = 31; wbgt = 28; uv = 8; wind = 10; hum = 35; aqi = 85; rain = 0; rainSum = 0;
  } else if (profile === 'ameno_ideal') {
    temp = 23; wbgt = 20; uv = 3; wind = 12; hum = 55; aqi = 15; rain = 5; rainSum = 0;
  } else if (profile === 'atencao_media') {
    temp = 29; wbgt = 27; uv = 6; wind = 25; hum = 70; aqi = 40; rain = 30; rainSum = 2;
  }

  return {
    forecast: {
      daily: {
        time: [hoy],
        temperature_2m_max: [temp],
        relative_humidity_2m_max: [hum],
        uv_index_max: [uv],
        wind_speed_10m_max: [wind],
        wind_gusts_10m_max: [wind * 1.4],
        precipitation_probability_max: [rain],
        precipitation_sum: [rainSum]
      },
      hourly: {
        time: hourlyTimes,
        wet_bulb_temperature_2m: Array(24).fill(wbgt),
        shortwave_radiation: Array(24).fill(600),
        cloud_cover: Array(24).fill(20),
        wind_speed_10m: Array(24).fill(wind),
        soil_moisture_0_to_10cm: Array(24).fill(0.25)
      }
    },
    air: {
      hourly: {
        time: hourlyTimes,
        pm2_5: Array(24).fill(aqi),
        pm10: Array(24).fill(aqi * 1.5),
        nitrogen_dioxide: Array(24).fill(15),
        ozone: Array(24).fill(40),
        sulphur_dioxide: Array(24).fill(5),
        carbon_monoxide: Array(24).fill(200)
      }
    },
    marine: {
      hourly: {
        wave_height: Array(24).fill(1.5),
        wave_period: Array(24).fill(8),
        sea_surface_temperature: Array(24).fill(24.5)
      }
    },
    enino: { ativo: false, anomalia: 0.2 }
  };
}

// Serve with mock API injected
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }

  if (reqPath === '/index.html') {
    let content = fs.readFileSync(filePath, 'utf8');
    // Inject mock API script before app.js
    const mockScript = `
      <script>
        const mockData = ${JSON.stringify(getMockData('extremo_calor'))};
        window.ClimAPI = {
          fetchForecast: async () => mockData.forecast,
          fetchAirQuality: async () => mockData.air,
          fetchMarine: async () => mockData.marine,
          fetchElNino: async () => mockData.enino
        };
      </script>
    `;
    content = content.replace('<script src="js/app.js"></script>', mockScript + '<script src="js/app.js"></script>');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(content);
  }

  const ext = path.extname(filePath);
  const mimeTypes = { '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

async function run() {
  await new Promise(r => server.listen(8083, '127.0.0.1', r));
  console.log('Mock server on 8083');

  const chrome = spawn('/usr/bin/chromium', [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=/tmp/chrome_mock_profile_' + Date.now(),
    '--remote-debugging-port=9224',
    '--remote-debugging-address=127.0.0.1'
  ]);

  let wsUrl = null;
  chrome.stderr.on('data', d => {
    const text = d.toString();
    const m = text.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:9224\/devtools\/browser\/[a-f0-9-]+)/);
    if (m) wsUrl = m[1];
  });
  while (!wsUrl) await new Promise(r => setTimeout(r, 100));

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
    return new Promise(resolve => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  const targetRes = await send('Target.createTarget', { url: 'http://127.0.0.1:8083' });
  const sessionId = (await send('Target.attachToTarget', { targetId: targetRes.result.targetId, flatten: true })).result.sessionId;

  function sendSession(method, params = {}) {
    return new Promise(resolve => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
    });
  }

  await sendSession('Page.enable');
  await sendSession('Runtime.enable');

  const viewports = [
    { name: 'Desktop 1080p', width: 1920, height: 1080 },
    { name: 'Desktop 768p', width: 1366, height: 768 },
    { name: 'Tablet 768p', width: 1024, height: 768 },
    { name: 'Mobile Standard (iPhone 13)', width: 390, height: 844 },
    { name: 'Mobile Compact (Android 360)', width: 360, height: 800 }
  ];

  for (const vp of viewports) {
    await sendSession('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.width < 600
    });

    await sendSession('Page.navigate', { url: 'http://127.0.0.1:8083' });
    await new Promise(r => setTimeout(r, 1500));

    const checkCode = `
      (function() {
        const docH = document.documentElement.scrollHeight;
        const bodyH = document.body.scrollHeight;
        const winH = window.innerHeight;
        const winW = window.innerWidth;
        const overflow = docH > winH || bodyH > winH;

        const trafficCard = document.getElementById('traffic-card');
        const trafficRect = trafficCard.getBoundingClientRect();
        const trafficCs = window.getComputedStyle(trafficCard);

        const factors = Array.from(document.querySelectorAll('.factor')).map(f => {
          const rect = f.getBoundingClientRect();
          const cs = window.getComputedStyle(f);
          const gauge = f.querySelector('.factor-gauge');
          const gaugeCs = gauge ? window.getComputedStyle(gauge) : null;
          const micro = f.querySelector('.factor-micro');
          const microCs = micro ? window.getComputedStyle(micro) : null;

          return {
            name: f.querySelector('.factor-name')?.innerText?.trim(),
            val: f.querySelector('.factor-value')?.innerText?.trim(),
            levelClass: Array.from(f.classList).find(c => c.startsWith('level-')),
            box: { w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top), bottom: Math.round(rect.bottom) },
            cardOverflows: f.scrollHeight > f.clientHeight,
            cardScrollH: f.scrollHeight,
            cardClientH: f.clientHeight,
            colors: {
              cardBg: cs.backgroundColor,
              cardColor: cs.color,
              gaugeBg: gaugeCs?.backgroundColor,
              gaugeColor: gaugeCs?.color,
              microBg: microCs?.backgroundColor,
              microColor: microCs?.color
            }
          };
        });

        // Overflow check on instruction list
        const recList = document.getElementById('rec-list');
        const recRect = recList ? recList.getBoundingClientRect() : null;

        return {
          viewport: { w: winW, h: winH },
          docH, bodyH, winH, overflow,
          overflowPx: Math.max(0, docH - winH),
          trafficCard: {
            classes: trafficCard.className,
            bg: trafficCs.backgroundColor,
            color: trafficCs.color,
            box: { w: Math.round(trafficRect.width), h: Math.round(trafficRect.height) },
            overflows: trafficCard.scrollHeight > trafficCard.clientHeight
          },
          recList: {
            box: recRect ? { w: Math.round(recRect.width), h: Math.round(recRect.height) } : null,
            scrollH: recList ? recList.scrollHeight : 0,
            clientH: recList ? recList.clientHeight : 0
          },
          factors
        };
      })()
    `;

    const evalRes = await sendSession('Runtime.evaluate', { expression: checkCode, returnByValue: true });
    console.log(`\n=================== ${vp.name} (${vp.width}x${vp.height}) ===================`);
    console.log(JSON.stringify(evalRes.result?.result?.value, null, 2));
  }

  chrome.kill();
  server.close();
}

run().catch(err => console.error(err));

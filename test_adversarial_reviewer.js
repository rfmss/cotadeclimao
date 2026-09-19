const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

let playwright;
try {
  playwright = require('playwright');
} catch (_) {
  if (process.env.NODE_PATH) {
    require('module').Module._initPaths();
    playwright = require('playwright');
  } else {
    throw new Error('Playwright not found');
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

const mockData = {
  forecast: {
    latitude: -19.52,
    longitude: -39.78,
    timezone: 'America/Sao_Paulo',
    daily: {
      time: ['2026-09-19', '2026-09-20'],
      temperature_2m_max: [31.5, 30.0],
      temperature_2m_min: [22.0, 21.5],
      relative_humidity_2m_max: [82, 80],
      apparent_temperature_max: [35.2, 33.1],
      uv_index_max: [7.8, 8.0],
      wind_speed_10m_max: [24.5, 22.0],
      wind_gusts_10m_max: [38.0, 35.0],
      precipitation_probability_max: [45, 30],
      precipitation_sum: [4.2, 1.0],
      sunrise: ['2026-09-19T05:45'],
      sunset: ['2026-09-19T17:45']
    },
    hourly: {
      time: Array.from({ length: 48 }, (_, i) => `2026-09-19T${String(i % 24).padStart(2, '0')}:00`),
      temperature_2m: Array.from({ length: 48 }, () => 28.5),
      relative_humidity_2m: Array.from({ length: 48 }, () => 75),
      apparent_temperature: Array.from({ length: 48 }, () => 32.0),
      wet_bulb_temperature_2m: Array.from({ length: 48 }, () => 26.2),
      wind_speed_10m: Array.from({ length: 48 }, () => 18.0),
      shortwave_radiation: Array.from({ length: 48 }, () => 650),
      cloud_cover: Array.from({ length: 48 }, () => 30),
      soil_moisture_0_to_10cm: Array.from({ length: 48 }, () => 0.28),
      uv_index: Array.from({ length: 48 }, () => 7.5)
    }
  },
  airQuality: {
    hourly: {
      time: Array.from({ length: 48 }, (_, i) => `2026-09-19T${String(i % 24).padStart(2, '0')}:00`),
      pm2_5: Array.from({ length: 48 }, () => 14),
      pm10: Array.from({ length: 48 }, () => 28),
      ozone: Array.from({ length: 48 }, () => 45),
      nitrogen_dioxide: Array.from({ length: 48 }, () => 16),
      european_aqi: Array.from({ length: 48 }, () => 2),
      us_aqi: Array.from({ length: 48 }, () => 35)
    }
  },
  marine: {
    hourly: {
      time: Array.from({ length: 48 }, (_, i) => `2026-09-19T${String(i % 24).padStart(2, '0')}:00`),
      wave_height: Array.from({ length: 48 }, () => 1.5),
      wave_period: Array.from({ length: 48 }, () => 8),
      wave_direction: Array.from({ length: 48 }, () => 90),
      ocean_current_velocity: Array.from({ length: 48 }, () => 0.3),
      sea_surface_temperature: Array.from({ length: 48 }, () => 26.0)
    }
  }
};

async function runAdversarialAudit() {
  console.log('======================================================');
  console.log('ADVERSARIAL REVIEWER ROUND 1 — CHALLENGE SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;
  const issues = [];

  function check(desc, fn) {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${desc}`);
    } catch (e) {
      failed++;
      console.error(`  ❌ FALHA: ${desc}`);
      console.error(`     Erro: ${e.message}`);
      issues.push({ desc, error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // PART 1: Combinatorial Microcopy Unit Stress
  // ─────────────────────────────────────────────────────────
  console.log('--- TEST PART 1: js/recommendations.js Adversarial Edge Cases ---');
  const recs = require('./js/recommendations.js');

  check('Handles completely null input without throwing and returns valid safe recs', () => {
    const res = recs.recomendacoes(null);
    assert.ok(Array.isArray(res) && res.length >= 1);
    assert.ok(res.every(r => typeof r === 'string' && r.length > 10));
  });

  check('Handles undefined input without throwing', () => {
    const res = recs.recomendacoes(undefined);
    assert.ok(Array.isArray(res) && res.length >= 1);
  });

  check('Handles empty object and array without throwing', () => {
    const res1 = recs.recomendacoes({});
    const res2 = recs.recomendacoes([]);
    assert.ok(Array.isArray(res1) && res1.length >= 1);
    assert.ok(Array.isArray(res2) && res2.length >= 1);
  });

  check('Handles extreme values without crashing or producing NaN/undefined strings', () => {
    const extremeFactors = [
      { id: 'calor', valor: 65, wetBulb: 38, nivel: 'emergencia' },
      { id: 'sol', valor: 25, nivel: 'emergencia' },
      { id: 'vento', valor: 220, nivel: 'emergencia' },
      { id: 'umidade', valor: 0, nivel: 'emergencia' },
      { id: 'ar', valor: 600, nivel: 'emergencia' },
      { id: 'chuva', valor: 100, rainSum: 350, nivel: 'emergencia' },
    ];
    for (const p of ['geral', 'pescador', 'agricultor', 'invalid_persona']) {
      const res = recs.recomendacoes(extremeFactors, p, { ativo: true, anomalia: 3.5 });
      assert.ok(res.length >= 2, `Expected >= 2 recommendations for ${p}`);
      assert.ok(res.every(r => !r.includes('undefined') && !r.includes('NaN') && !r.includes('null')), `Found NaN or undefined in: ${JSON.stringify(res)}`);
    }
  });

  check('Handles zero and negative values gracefully', () => {
    const coldFactors = [
      { id: 'calor', valor: -15, wetBulb: -18, nivel: 'perigo' },
      { id: 'sol', valor: 0, nivel: 'bom' },
      { id: 'vento', valor: 0, nivel: 'bom' },
      { id: 'umidade', valor: 0, nivel: 'perigo' },
      { id: 'ar', valor: 0, nivel: 'bom' },
      { id: 'chuva', valor: 0, rainSum: 0, nivel: 'bom' },
    ];
    const res = recs.recomendacoes(coldFactors, 'geral');
    assert.ok(res.length >= 1);
    assert.ok(res.every(r => !r.includes('undefined') && !r.includes('NaN')));
  });

  check('Ensures strict uniqueness of recommendations within every call (no intra-call duplicate phrases)', () => {
    const factors = [
      { id: 'calor', valor: 36, wetBulb: 32, nivel: 'emergencia' },
      { id: 'sol', valor: 12, nivel: 'emergencia' },
      { id: 'vento', valor: 65, nivel: 'perigo' },
      { id: 'umidade', valor: 90, nivel: 'emergencia' },
      { id: 'ar', valor: 85, nivel: 'perigo' },
      { id: 'chuva', valor: 95, rainSum: 60, nivel: 'perigo' },
    ];
    for (let cycle = 0; cycle < 50; cycle++) {
      for (const p of ['geral', 'pescador', 'agricultor']) {
        const list = recs.recomendacoes(factors, p, null, { cycle });
        const set = new Set(list);
        assert.strictEqual(set.size, list.length, `Duplicates found for persona ${p} in cycle ${cycle}: ${JSON.stringify(list)}`);
      }
    }
  });

  // ─────────────────────────────────────────────────────────
  // PART 2: Browser E2E, Containment 100vh & Viewport Matrix
  // ─────────────────────────────────────────────────────────
  console.log('\n--- TEST PART 2: Browser E2E, 100vh Containment & Viewport Matrix ---');
  const { server, url } = await createStaticServer();

  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const viewports = [
    { name: 'Desktop Full HD', width: 1920, height: 1080 },
    { name: 'Laptop Standard', width: 1366, height: 768 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'iPad Portrait', width: 768, height: 1024 },
    { name: 'iPhone 13 / Modern Mobile', width: 390, height: 844 },
    { name: 'iPhone SE / Narrow Mobile', width: 375, height: 667 },
    { name: 'Android Standard', width: 360, height: 740 },
    { name: 'Small Screen / Boundary', width: 320, height: 568 },
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    // Mock API
    await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
    await page.route('**/*open-meteo.com/v1/forecast*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockData.forecast) }));
    await page.route('**/*open-meteo.com/v1/air-quality*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockData.airQuality) }));
    await page.route('**/*open-meteo.com/v1/marine*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockData.marine) }));

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 10000 });

    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const app = document.getElementById('app-main');
      const trafficCard = document.getElementById('traffic-card');
      const factorsGrid = document.querySelector('.factors-grid');
      const instructions = document.querySelector('.huge-instructions');

      return {
        docScrollHeight: doc.scrollHeight,
        docClientHeight: doc.clientHeight,
        docScrollWidth: doc.scrollWidth,
        docClientWidth: doc.clientWidth,
        bodyScrollHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        appHeight: app ? app.offsetHeight : 0,
        trafficCardHeight: trafficCard ? trafficCard.offsetHeight : 0,
        factorsGridHeight: factorsGrid ? factorsGrid.offsetHeight : 0,
        instructionsScrollable: instructions ? (instructions.scrollHeight >= instructions.clientHeight) : false,
      };
    });

    check(`[Viewport ${vp.name} (${vp.width}x${vp.height})] Strict 100vh containment: NO document scroll (scrollHeight <= clientHeight)`, () => {
      assert.ok(
        layout.docScrollHeight <= layout.docClientHeight,
        `Document has vertical scroll: scrollHeight=${layout.docScrollHeight} > clientHeight=${layout.docClientHeight}`
      );
      assert.ok(
        layout.docScrollWidth <= layout.docClientWidth,
        `Document has horizontal scroll: scrollWidth=${layout.docScrollWidth} > clientWidth=${layout.docClientWidth}`
      );
    });

    // Test Persona Switching on this viewport
    const personaSwitchResult = await page.evaluate(async () => {
      const btns = Array.from(document.querySelectorAll('[data-persona]'));
      const results = [];
      for (const btn of btns) {
        btn.click();
        const p = btn.getAttribute('data-persona');
        const active = btn.classList.contains('active');
        const recItems = Array.from(document.querySelectorAll('#rec-list li')).map(li => li.textContent);
        const doc = document.documentElement;
        results.push({
          persona: p,
          active,
          recCount: recItems.length,
          hasScroll: doc.scrollHeight > doc.clientHeight
        });
      }
      return results;
    });

    check(`[Viewport ${vp.name}] Persona toggles work seamlessly and retain 100vh containment`, () => {
      for (const r of personaSwitchResult) {
        assert.ok(r.active, `Button for ${r.persona} not active`);
        assert.ok(r.recCount >= 2, `Expected >= 2 recommendations for ${r.persona}, got ${r.recCount}`);
        assert.ok(!r.hasScroll, `Vertical scroll appeared when switching to ${r.persona}`);
      }
    });

    await page.close();
  }

  // ─────────────────────────────────────────────────────────
  // PART 3: Computed Style WCAG AAA Contrast Verification
  // ─────────────────────────────────────────────────────────
  console.log('\n--- TEST PART 3: Live DOM Computed Style WCAG AAA Audit ---');
  const auditPage = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await auditPage.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await auditPage.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await auditPage.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
  await auditPage.route('**/*open-meteo.com/v1/forecast*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockData.forecast) }));
  await auditPage.route('**/*open-meteo.com/v1/air-quality*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockData.airQuality) }));
  await auditPage.route('**/*open-meteo.com/v1/marine*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockData.marine) }));
  await auditPage.goto(url, { waitUntil: 'domcontentloaded' });
  await auditPage.waitForSelector('#app-main[data-state="ready"]', { timeout: 10000 });

  const contrastResults = await auditPage.evaluate(() => {
    const states = ['bom', 'atencao', 'alerta', 'perigo', 'emergencia', 'indisponivel'];
    const card = document.getElementById('traffic-card');
    const factorList = document.getElementById('factor-list');
    const reports = [];

    function parseColor(str) {
      const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0,0,0];
    }
    function lum(c) {
      const [r, g, b] = c.map(v => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    function ratio(c1, c2) {
      const l1 = lum(c1);
      const l2 = lum(c2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    // Check traffic card in all classes
    for (const st of states) {
      card.className = `traffic-light-card bg-${st}`;
      const style = window.getComputedStyle(card);
      const bg = parseColor(style.backgroundColor);
      const color = parseColor(style.color);
      const r = ratio(bg, color);
      reports.push({ target: `Card bg-${st}`, ratio: r, bg, color });
    }

    // Check factor cards
    const sampleFactor = factorList.querySelector('.factor');
    if (sampleFactor) {
      for (const st of states) {
        sampleFactor.className = `factor level-${st}`;
        const style = window.getComputedStyle(sampleFactor);
        const bg = parseColor(style.backgroundColor);
        const color = parseColor(style.color);
        const r = ratio(bg, color);
        reports.push({ target: `Factor level-${st}`, ratio: r, bg, color });
      }
    }

    // Check neutral elements
    const app = document.getElementById('app-main');
    const appStyle = window.getComputedStyle(app);
    const appBg = parseColor(window.getComputedStyle(document.body).backgroundColor);
    const appColor = parseColor(appStyle.color);
    reports.push({ target: 'Body Background vs Default Text', ratio: ratio(appBg, appColor), bg: appBg, color: appColor });

    const btn = document.querySelector('.btn-action');
    if (btn) {
      const btnStyle = window.getComputedStyle(btn);
      reports.push({ target: 'Inactive Action Button', ratio: ratio(parseColor(btnStyle.backgroundColor), parseColor(btnStyle.color)) });
      btn.classList.add('active');
      const activeStyle = window.getComputedStyle(btn);
      reports.push({ target: 'Active Action Button', ratio: ratio(parseColor(activeStyle.backgroundColor), parseColor(activeStyle.color)) });
    }

    const conn = document.getElementById('conn-banner');
    if (conn) {
      conn.hidden = false;
      const connStyle = window.getComputedStyle(conn);
      reports.push({ target: 'Offline Connection Banner', ratio: ratio(parseColor(connStyle.backgroundColor), parseColor(connStyle.color)) });
    }

    const err = document.getElementById('err-box');
    if (err) {
      err.hidden = false;
      const errStyle = window.getComputedStyle(err);
      reports.push({ target: 'Error Box Banner', ratio: ratio(parseColor(errStyle.backgroundColor), parseColor(errStyle.color)) });
    }

    return reports;
  });

  for (const c of contrastResults) {
    check(`WCAG AAA Contrast for ${c.target}: Ratio ${c.ratio.toFixed(2)}:1 (Min 7.0:1)`, () => {
      assert.ok(c.ratio >= 7.0, `Contrast ratio ${c.ratio.toFixed(2)}:1 is below WCAG AAA requirement (7.0:1)`);
    });
  }

  // ─────────────────────────────────────────────────────────
  // PART 4: Safe Empty State & Offline Failure Handling
  // ─────────────────────────────────────────────────────────
  console.log('\n--- TEST PART 4: Safe Empty State & Corrupt Storage Handling ---');

  const errorPage = await browser.newPage();
  // Abort all network
  await errorPage.route('**/*open-meteo.com/**', r => r.abort('failed'));
  await errorPage.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, body: '' }));
  await errorPage.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, body: '' }));
  await errorPage.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));

  // Seed corrupt data in localStorage before loading
  await errorPage.addInitScript(() => {
    localStorage.setItem('cota_latest_weather', 'CORRUPT_NOT_JSON{{{{');
    localStorage.setItem('cota_weather_latest', 'null');
  });

  const pageErrors = [];
  const uncaughtErrors = [];
  errorPage.on('pageerror', err => pageErrors.push(err.message));
  errorPage.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('Failed to load resource') && !msg.text().includes('net::ERR_')) {
      uncaughtErrors.push(msg.text());
    }
  });

  await errorPage.goto(url, { waitUntil: 'domcontentloaded' });
  await errorPage.waitForSelector('#app-main[data-state="ready"]', { timeout: 10000 });

  const safeState = await errorPage.evaluate(() => {
    const app = document.getElementById('app-main');
    const fake = document.getElementById('fake-score');
    const card = document.getElementById('traffic-card');
    const errBox = document.getElementById('err-box');
    const factors = Array.from(document.querySelectorAll('#factor-list .factor')).map(el => ({
      name: el.querySelector('.factor-name')?.textContent?.trim(),
      gauge: el.querySelector('.factor-gauge')?.textContent?.trim(),
    }));

    return {
      state: app?.getAttribute('data-state'),
      fakeText: fake?.textContent?.trim(),
      cardClass: card?.className,
      errVisible: !errBox?.hidden,
      errText: errBox?.textContent?.trim(),
      factorsCount: factors.length,
      allIndisponivel: factors.every(f => f.gauge === 'INDISPONÍVEL')
    };
  });

  check('UI does not freeze in loading (data-state is "ready")', () => {
    assert.strictEqual(safeState.state, 'ready');
  });

  check('Score displays safe null indicator ("--")', () => {
    assert.strictEqual(safeState.fakeText, '--');
  });

  check('Traffic card displays safe "bg-indisponivel" class', () => {
    assert.ok(safeState.cardClass.includes('bg-indisponivel'), `Expected bg-indisponivel in class: ${safeState.cardClass}`);
  });

  check('Error banner is visible with informative safe message', () => {
    assert.ok(safeState.errVisible);
    assert.ok(safeState.errText.includes('SEM CONEXÃO') || safeState.errText.includes('MODO SEGURO'));
  });

  check('All 6 factor cards display INDISPONÍVEL state', () => {
    assert.strictEqual(safeState.factorsCount, 6);
    assert.ok(safeState.allIndisponivel, 'Not all factors are in INDISPONÍVEL state');
  });

  check('Zero unhandled JavaScript exceptions in safe empty state mode', () => {
    assert.strictEqual(pageErrors.length, 0, `Page errors encountered: ${JSON.stringify(pageErrors)}`);
  });

  await browser.close();
  server.close();

  console.log('\n======================================================');
  console.log(`TOTAL AUDIT CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.error('FAILED ISSUES LEDGER:');
    issues.forEach(iss => console.error(`- ${iss.desc}: ${iss.error}`));
    process.exit(1);
  } else {
    console.log('🎉 ALL ADVERSARIAL AUDIT CHECKS PASSED FLAWLESSLY!');
  }
}

runAdversarialAudit().catch(err => {
  console.error('Fatal error running adversarial audit:', err);
  process.exit(1);
});

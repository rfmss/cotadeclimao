/**
 * Adversarial Reviewer Round 2 Verification Suite: test_adversarial_round2.js
 * 
 * Verifies:
 * 1. Falsy numeric zero preservation (wind: 0, sol: 0, calor: 0, chuva: 0) in normalizeFactors & interpolateTemplate
 * 2. Rotating complementary microcopy without intra-call or inter-cycle repetition (diaAmeno)
 * 3. Beaufort scale calibration for calm conditions (w < 1 km/h -> BF0)
 * 4. Full NaN / Infinity / string protection in interpolation templates
 * 5. Headless Chromium E2E verification of ARIA landmarks, roles, live regions, pressed states, and focus styles
 * 6. Visual status indicator background color validity (eliminating --l-* typo)
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const recs = require('./js/recommendations.js');
const schema = require('./js/schema.js');
const calc = require('./js/calculations.js');

let playwright;
try {
  playwright = require('playwright');
} catch (_) {
  if (process.env.NODE_PATH) {
    require('module').Module._initPaths();
    playwright = require('playwright');
  } else {
    throw new Error('Playwright não encontrado.');
  }
}

let passed = 0;
let failed = 0;
const failures = [];

function check(desc, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ FALHA: ${desc} -> ${err.message}`);
    failures.push({ desc, error: err.message });
  }
}

async function checkAsync(desc, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ FALHA: ${desc} -> ${err.message}`);
    failures.push({ desc, error: err.message });
  }
}

function createStaticServer() {
  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(__dirname, decodeURIComponent(reqPath));

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function runSuite() {
  console.log('======================================================');
  console.log('🔍 ADVERSARIAL REVIEWER ROUND 2 — CHALLENGER AUDIT');
  console.log('======================================================\n');

  // ─── SUITE 1: Microcopy Falsy 0 & Sanitization ─────────────────────────────
  console.log('--- SUITE 1: Falsy 0 Preservation & NaN Sanitization ---');

  check('Preserves numeric 0 (wind=0, sol=0, calor=0, chuva=0) without falling back to defaults', () => {
    const res = recs.recomendacoes({ vento: 0, sol: 0, calor: 0, chuva: 0 }, 'geral');
    assert.ok(Array.isArray(res) && res.length >= 2);
    const joined = res.join(' ');
    // Deve conter vento 0 km/h e WBGT 0.0°C
    assert.ok(joined.includes('0 km/h'), `Expected "0 km/h" in microcopy, got: ${joined}`);
    assert.ok(joined.includes('0.0°C'), `Expected "0.0°C" in microcopy, got: ${joined}`);
    assert.ok(!joined.includes('15 km/h'), `Did not expect default "15 km/h" in: ${joined}`);
    assert.ok(!joined.includes('26.0°C'), `Did not expect default "26.0°C" in: ${joined}`);
  });

  check('Beaufort scale correctly returns BF0 for calm conditions (vento < 1 km/h)', () => {
    const text = recs.interpolateTemplate('Vento: {vento} km/h (BF{bf})', { vento: { valor: 0 } });
    assert.strictEqual(text, 'Vento: 0 km/h (BF0)', `Expected BF0 for wind 0, got: ${text}`);
  });

  check('Sanitizes NaN, Infinity, -Infinity and invalid types without leaking "NaN" strings', () => {
    const badFactors = {
      calor: { valor: NaN },
      sol: { valor: Infinity },
      vento: { valor: -Infinity },
      umidade: { valor: 'invalid' },
      ar: { valor: undefined }
    };
    const res = recs.recomendacoes(badFactors, 'geral');
    assert.ok(Array.isArray(res) && res.length >= 1);
    for (const phrase of res) {
      assert.ok(!phrase.includes('NaN'), `Found "NaN" in phrase: ${phrase}`);
      assert.ok(!phrase.includes('Infinity'), `Found "Infinity" in phrase: ${phrase}`);
      assert.ok(!phrase.includes('undefined'), `Found "undefined" in phrase: ${phrase}`);
      assert.ok(!phrase.includes('null'), `Found "null" in phrase: ${phrase}`);
    }
  });

  check('Complementary microcopy rotates dynamically across consecutive cycles without repetition', () => {
    const diaAmenoFactors = { calor: 22, vento: 10, umidade: 60 };
    const secondPhrases = [];

    for (let cycle = 0; cycle < 4; cycle++) {
      const out = recs.recomendacoes(diaAmenoFactors, 'geral', null, { cycle });
      assert.strictEqual(out.length, 2, 'Must generate exactly 2 phrases for diaAmeno');
      // No intra-call duplicate
      assert.notStrictEqual(out[0], out[1], `Intra-call duplicate detected in cycle ${cycle}`);
      secondPhrases.push(out[1]);
    }

    // Ensure consecutive second phrases are not identical
    for (let i = 1; i < secondPhrases.length; i++) {
      assert.notStrictEqual(
        secondPhrases[i],
        secondPhrases[i - 1],
        `Consecutive duplicate secondary phrase detected in cycle ${i}`
      );
    }

    const uniqueSeconds = new Set(secondPhrases);
    assert.ok(uniqueSeconds.size >= 3, `Expected >= 3 unique secondary phrases, got ${uniqueSeconds.size}`);
  });

  // ─── SUITE 2: Live DOM Accessibility & WCAG AAA ────────────────────────────
  console.log('\n--- SUITE 2: Live DOM Accessibility & ARIA Landmarks (Playwright) ---');

  const { server, url } = await createStaticServer();
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Mock API responses
  const mockForecast = {
    latitude: -19.52,
    longitude: -39.78,
    timezone: 'America/Sao_Paulo',
    daily: {
      time: ['2026-09-19', '2026-09-20'],
      temperature_2m_max: [30.0, 29.0],
      temperature_2m_min: [21.0, 20.0],
      relative_humidity_2m_max: [75, 70],
      apparent_temperature_max: [33.0, 31.0],
      uv_index_max: [7.0, 7.5],
      wind_speed_10m_max: [20.0, 18.0],
      wind_gusts_10m_max: [30.0, 28.0],
      precipitation_probability_max: [20, 10],
      precipitation_sum: [0.0, 0.0]
    },
    hourly: {
      time: Array.from({ length: 48 }, (_, i) => `2026-09-19T${String(i % 24).padStart(2, '0')}:00`),
      temperature_2m: Array.from({ length: 48 }, () => 27.0),
      relative_humidity_2m: Array.from({ length: 48 }, () => 70),
      apparent_temperature: Array.from({ length: 48 }, () => 30.0),
      wet_bulb_temperature_2m: Array.from({ length: 48 }, () => 24.0),
      wind_speed_10m: Array.from({ length: 48 }, () => 14.0),
      shortwave_radiation: Array.from({ length: 48 }, () => 500),
      cloud_cover: Array.from({ length: 48 }, () => 20),
      soil_moisture_0_to_10cm: Array.from({ length: 48 }, () => 0.3)
    }
  };

  await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));
  await page.route('**/*open-meteo.com/v1/forecast*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockForecast) }));
  await page.route('**/*open-meteo.com/v1/air-quality*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hourly: { time: [] } }) }));
  await page.route('**/*open-meteo.com/v1/marine*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hourly: { time: [] } }) }));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 10000 });

  await checkAsync('Main container has valid landmark role="main"', async () => {
    const role = await page.getAttribute('#app-main', 'role');
    assert.strictEqual(role, 'main');
  });

  await checkAsync('Traffic light card has aria-live="polite" and aria-atomic="true"', async () => {
    const live = await page.getAttribute('#traffic-card', 'aria-live');
    const atomic = await page.getAttribute('#traffic-card', 'aria-atomic');
    assert.strictEqual(live, 'polite');
    assert.strictEqual(atomic, 'true');
  });

  await checkAsync('Persona button group has role="group" and aria-label', async () => {
    const groupRole = await page.getAttribute('.personas', 'role');
    const groupLabel = await page.getAttribute('.personas', 'aria-label');
    assert.strictEqual(groupRole, 'group');
    assert.ok(groupLabel && groupLabel.length > 3);
  });

  await checkAsync('Persona buttons support dynamic aria-pressed state transitions', async () => {
    // Initial state: geral is active
    const geralPressed = await page.getAttribute('[data-persona="geral"]', 'aria-pressed');
    const pescaPressed = await page.getAttribute('[data-persona="pescador"]', 'aria-pressed');
    assert.strictEqual(geralPressed, 'true');
    assert.strictEqual(pescaPressed, 'false');

    // Click pesca
    await page.click('[data-persona="pescador"]');
    const geralPressedAfter = await page.getAttribute('[data-persona="geral"]', 'aria-pressed');
    const pescaPressedAfter = await page.getAttribute('[data-persona="pescador"]', 'aria-pressed');
    assert.strictEqual(geralPressedAfter, 'false');
    assert.strictEqual(pescaPressedAfter, 'true');

    // Restore geral
    await page.click('[data-persona="geral"]');
  });

  await checkAsync('Status indicator dot has computed non-transparent, high-contrast background color', async () => {
    const dotBg = await page.evaluate(() => {
      const dot = document.querySelector('.status-dot, .status-indicator');
      return window.getComputedStyle(dot).backgroundColor;
    });
    // Must be green rgb(20, 83, 45) for online mode (#14532D)
    assert.ok(dotBg.includes('20') && dotBg.includes('83') && dotBg.includes('45'), `Status dot background invalid: ${dotBg}`);
  });

  await checkAsync('Offline banners and error alert boxes have correct ARIA roles', async () => {
    const connRole = await page.getAttribute('#conn-banner', 'role');
    const errRole = await page.getAttribute('#err-box', 'role');
    assert.strictEqual(connRole, 'status');
    assert.strictEqual(errRole, 'alert');
  });

  await checkAsync('Screen-reader hidden heading exists for factor panel', async () => {
    const heading = await page.textContent('.panel-factors h2.visually-hidden');
    assert.ok(heading && heading.includes('Fatores Climáticos'));
  });

  await checkAsync('Keyboard focus outline rule exists in computed styles for action buttons', async () => {
    const hasFocusRule = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const s of sheets) {
        try {
          const rules = Array.from(s.cssRules || []);
          for (const r of rules) {
            if (r.selectorText && r.selectorText.includes('focus-visible')) return true;
          }
        } catch (_) {}
      }
      return false;
    });
    assert.ok(hasFocusRule, 'Must contain focus-visible accessibility styling');
  });

  await browser.close();
  await new Promise(r => server.close(r));

  console.log('\n======================================================');
  console.log(`TOTAL DE TESTES EXECUTADOS: ${passed + failed}`);
  console.log(`PASSOU: ${passed} | FALHOU: ${failed}`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 TODOS OS TESTES DA AUDITORIA ROUND 2 PASSARAM COM SUCESSO!\n');
    process.exit(0);
  }
}

runSuite().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});

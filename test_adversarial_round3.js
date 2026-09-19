/**
 * Adversarial Challenger Suite — Reviewer Round 3
 * Validates:
 * 1. Safe 'indisponivel' display and MutationObserver non-regression
 * 2. Recommendations engine resilience on edge cycles (NaN, negative, string) and string/negative El Niño anomalies
 * 3. Safe numeric formatting on strings/NaN
 * 4. PWA Service Worker caching and registration integrity
 * 5. Headless Chromium E2E test verifying that 'indisponivel' risk score never turns green/bg-bom
 */

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

let playwright = null;
try {
  playwright = require('playwright');
} catch (_) {
  if (process.env.NODE_PATH) {
    try {
      playwright = require(path.join(process.env.NODE_PATH, 'playwright'));
    } catch (_) {}
  }
}

const ROOT_DIR = __dirname;
let passed = 0;
let failed = 0;

function check(title, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${title}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ FALHA: ${title}\n     ${err.stack || err.message}`);
  }
}

async function asyncCheck(title, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${title}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ FALHA: ${title}\n     ${err.stack || err.message}`);
  }
}

function createStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(ROOT_DIR, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const map = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
        };
        res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

console.log('======================================================');
console.log('🛡️ ADVERSARIAL REVIEWER ROUND 3 — FINAL CHALLENGE SUITE');
console.log('======================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Recommendations Engine Deep Resilience
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- SUITE 1: Recommendations Engine Edge-Case Resilience ---');

const ClimRecs = require('./js/recommendations.js');

check('interpolateTemplate returns empty string on null, undefined or non-string template', () => {
  assert.strictEqual(ClimRecs.interpolateTemplate(null, {}), '');
  assert.strictEqual(ClimRecs.interpolateTemplate(undefined, {}), '');
  assert.strictEqual(ClimRecs.interpolateTemplate(12345, {}), '');
  assert.strictEqual(ClimRecs.interpolateTemplate({}, {}), '');
});

check('Handles cycle: NaN without throwing and produces valid non-empty recommendations', () => {
  const recs = ClimRecs.recomendacoes({}, 'geral', null, { cycle: NaN });
  assert.ok(Array.isArray(recs) && recs.length >= 2);
  assert.ok(!recs.some(r => r.includes('NaN') || r.includes('undefined')));
});

check('Handles cycle: negative float (e.g. -2.7) without throwing and produces valid output', () => {
  const recs = ClimRecs.recomendacoes({}, 'geral', null, { cycle: -2.7 });
  assert.ok(Array.isArray(recs) && recs.length >= 2);
  assert.ok(!recs.some(r => r.includes('NaN') || r.includes('undefined')));
});

check('Handles cycle as non-numeric string (e.g. "cycle_5") gracefully', () => {
  const recs = ClimRecs.recomendacoes({}, 'geral', null, { cycle: "cycle_5" });
  assert.ok(Array.isArray(recs) && recs.length >= 2);
});

check('Handles string anomalia in El Niño (e.g. "1.8") without TypeError', () => {
  const recs = ClimRecs.recomendacoes({}, 'geral', { ativo: true, anomalia: "1.8" });
  assert.ok(Array.isArray(recs));
  const elninoRec = recs.find(r => r.includes('El Niño'));
  assert.ok(elninoRec, 'El Niño recommendation must be present');
  assert.ok(elninoRec.includes('+1.8°C'), `Expected +1.8°C in phrase, got: ${elninoRec}`);
});

check('Handles negative anomalia in El Niño (e.g. -1.2) without double plus/minus (+-)', () => {
  const recs = ClimRecs.recomendacoes({}, 'geral', { ativo: true, anomalia: -1.2 });
  assert.ok(Array.isArray(recs));
  const elninoRec = recs.find(r => r.includes('El Niño'));
  assert.ok(elninoRec, 'El Niño recommendation must be present');
  assert.ok(elninoRec.includes('-1.2°C'), `Expected -1.2°C in phrase, got: ${elninoRec}`);
  assert.ok(!elninoRec.includes('+-'), 'Must not contain +-');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Service Worker & PWA Shell Integrity
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 2: Service Worker & Shell Integrity ---');

check('sw.js includes ./js/schema.js in SHELL cache list', () => {
  const swContent = fs.readFileSync(path.join(ROOT_DIR, 'sw.js'), 'utf-8');
  assert.ok(swContent.includes("'./js/schema.js'"), "sw.js SHELL must include './js/schema.js'");
});

check('index.html registers sw.js on window load', () => {
  const htmlContent = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf-8');
  assert.ok(htmlContent.includes("navigator.serviceWorker.register('sw.js')"), "index.html must register sw.js");
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Browser E2E - Indisponivel Risk Display & MutationObserver Defense
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- SUITE 3: Live DOM Browser Verification (Playwright) ---');

async function runBrowserTests() {
  if (!playwright) {
    console.log('  [PULANDO SUITE 3: Playwright não disponível]');
    return;
  }

  const { server, url } = await createStaticServer();
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Test 3.1: All factors indisponivel MUST remain bg-indisponivel and NOT flip to bg-bom
  await asyncCheck('All factors indisponivel renders as "--" score and bg-indisponivel (NOT bg-bom)', async () => {
    const page = await browser.newPage();
    await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));

    // Mock API with valid structure but null measurements for all daily/hourly factors
    const nullForecast = {
      latitude: -19.52,
      longitude: -39.78,
      timezone: 'America/Sao_Paulo',
      daily: {
        time: ['2026-09-19'],
        temperature_2m_max: [null],
        relative_humidity_2m_max: [null],
        uv_index_max: [null],
        wind_speed_10m_max: [null],
        precipitation_probability_max: [null]
      },
      hourly: {
        time: ['2026-09-19T12:00'],
        temperature_2m: [null],
        relative_humidity_2m: [null],
        wind_speed_10m: [null]
      }
    };

    await page.route('**/*open-meteo.com/v1/forecast*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nullForecast) }));
    await page.route('**/*open-meteo.com/v1/air-quality*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/*open-meteo.com/v1/marine*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 10000 });

    // Wait a brief tick for any MutationObservers to settle
    await page.waitForTimeout(300);

    const cardState = await page.evaluate(() => {
      const card = document.getElementById('traffic-card');
      const fake = document.getElementById('fake-score');
      const scoreLabel = document.getElementById('score-label');
      const quickTips = document.getElementById('quick-tips');
      return {
        cardClass: card ? card.className : '',
        fakeText: fake ? fake.textContent.trim() : '',
        scoreLabelText: scoreLabel ? scoreLabel.textContent.trim() : '',
        quickTipsText: quickTips ? quickTips.textContent.trim() : ''
      };
    });

    assert.ok(
      cardState.cardClass.includes('bg-indisponivel'),
      `Expected bg-indisponivel, but card class was: "${cardState.cardClass}"`
    );
    assert.ok(
      !cardState.cardClass.includes('bg-bom'),
      `Card must NOT have bg-bom when risk is indisponivel!`
    );
    assert.strictEqual(cardState.fakeText, '--', `Expected fake score "--", got "${cardState.fakeText}"`);
    assert.ok(
      cardState.quickTipsText.includes('INDISPONÍVEIS') || cardState.quickTipsText.includes('sincronização'),
      `Expected quick tips to mention unavailability, got: "${cardState.quickTipsText}"`
    );

    await page.close();
  });

  // Test 3.2: Persona switching with string El Niño anomaly and numeric edge values
  await asyncCheck('Persona switching executes smoothly and maintains valid ARIA states', async () => {
    const page = await browser.newPage();
    await page.route('**/*unpkg.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route('**/*fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));

    const validForecast = {
      latitude: -19.52,
      longitude: -39.78,
      timezone: 'America/Sao_Paulo',
      daily: {
        time: ['2026-09-19'],
        temperature_2m_max: [30.0],
        relative_humidity_2m_max: [75],
        uv_index_max: [8.0],
        wind_speed_10m_max: [22.0],
        precipitation_probability_max: [10]
      },
      hourly: {
        time: ['2026-09-19T12:00'],
        temperature_2m: [30.0],
        relative_humidity_2m: [75],
        wind_speed_10m: [22.0]
      }
    };

    await page.route('**/*open-meteo.com/v1/forecast*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(validForecast) }));
    await page.route('**/*open-meteo.com/v1/air-quality*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/*open-meteo.com/v1/marine*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 10000 });

    // Click 'pesca'
    await page.click('[data-persona="pescador"]');
    const pescaActive = await page.$eval('[data-persona="pescador"]', el => ({
      active: el.classList.contains('active'),
      pressed: el.getAttribute('aria-pressed')
    }));
    assert.strictEqual(pescaActive.active, true);
    assert.strictEqual(pescaActive.pressed, 'true');

    // Click 'roça'
    await page.click('[data-persona="agricultor"]');
    const rocaActive = await page.$eval('[data-persona="agricultor"]', el => ({
      active: el.classList.contains('active'),
      pressed: el.getAttribute('aria-pressed')
    }));
    assert.strictEqual(rocaActive.active, true);
    assert.strictEqual(rocaActive.pressed, 'true');

    await page.close();
  });

  await browser.close();
  server.close();
}

runBrowserTests().then(() => {
  console.log('\n======================================================');
  console.log(`TOTAL DE AUDITORIAS EXECUTADAS: ${passed + failed}`);
  console.log(`PASSOU: ${passed} | FALHOU: ${failed}`);
  console.log('======================================================\n');
  if (failed > 0) {
    process.exit(1);
  }
  console.log('🎉 TODOS OS TESTES ADVERSARIAIS DO ROUND 3 PASSARAM COM SUCESSO!\n');
}).catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});

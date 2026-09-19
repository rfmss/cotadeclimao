/**
 * Automated Test Suite: test_accessibility_and_containment.js
 * Acceptance Criteria R3: Auditoria de WCAG AAA, Tipografia de Sistema e Contenção 100vh
 * 
 * Valida:
 * 1. Relação de contraste WCAG AAA (>= 7.0:1 para texto normal, >= 4.5:1 para texto grande)
 * 2. Ausência de texto invisível ou combinações de baixo contraste
 * 3. Regras CSS de contenção estrita em 100vh / 100dvh sem rolagem vertical da página
 * 4. Tipografia de sistema segura para tolerância total a quedas de rede offline
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passCount = 0;
let failCount = 0;

function testPass(msg) {
  passCount++;
  console.log(`  ✓ ${msg}`);
}

function testFail(msg, err) {
  failCount++;
  console.error(`  ❌ FALHA: ${msg}`, err ? (err.message || err) : '');
}

// ─── Algoritmo Oficial WCAG 2.1 Luminância Relativa e Contraste ───────────────
function luminance(r, g, b) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '').trim();
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function contrastRatio(hex1, hex2) {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

console.log('======================================================');
console.log('👁️ BATERIA DE AUDITORIA: WCAG AAA & CONTENÇÃO 100vh (R3)');
console.log('======================================================\n');

// ─── SUITE 1: Contraste WCAG AAA das Cores do Painel ──────────────────────────
console.log('--- SUITE 1: Relação de Contraste WCAG AAA (Mínimo 7.0:1) ---');

const colorPairs = [
  { name: 'Nível BOM: Verde Floresta #14532D com Texto Branco #FFFFFF', bg: '#14532D', fg: '#FFFFFF', minRatio: 7.0 },
  { name: 'Nível ATENÇÃO: Âmbar #FBBF24 com Texto Escuro #111827', bg: '#FBBF24', fg: '#111827', minRatio: 7.0 },
  { name: 'Nível ALERTA: Ferrugem #9A3412 com Texto Branco #FFFFFF', bg: '#9A3412', fg: '#FFFFFF', minRatio: 7.0 },
  { name: 'Nível PERIGO: Carmesim #991B1B com Texto Branco #FFFFFF', bg: '#991B1B', fg: '#FFFFFF', minRatio: 7.0 },
  { name: 'Nível EMERGÊNCIA: Roxo Escuro #581C87 com Texto Branco #FFFFFF', bg: '#581C87', fg: '#FFFFFF', minRatio: 7.0 },
  { name: 'Nível INDISPONÍVEL: Ardósia #374151 com Texto Branco #FFFFFF', bg: '#374151', fg: '#FFFFFF', minRatio: 7.0 },
  { name: 'Fundo Geral #E5E7EB com Texto Escuro #111827', bg: '#E5E7EB', fg: '#111827', minRatio: 7.0 },
  { name: 'Painel Branco #FFFFFF com Texto Escuro #111827', bg: '#FFFFFF', fg: '#111827', minRatio: 7.0 },
  { name: 'Botão Ação Inativo #E5E7EB com Texto Escuro #111827', bg: '#E5E7EB', fg: '#111827', minRatio: 7.0 },
  { name: 'Botão Ação Ativo #111827 com Texto Branco #FFFFFF', bg: '#111827', fg: '#FFFFFF', minRatio: 7.0 },
  { name: 'Aviso de Conexão #FEF3C7 com Texto Âmbar Escuro #78350F', bg: '#FEF3C7', fg: '#78350F', minRatio: 7.0 },
  { name: 'Aviso de Erro #FEE2E2 com Texto Vermelho Escuro #7F1D1D', bg: '#FEE2E2', fg: '#7F1D1D', minRatio: 7.0 },
];

for (const pair of colorPairs) {
  try {
    const ratio = contrastRatio(pair.bg, pair.fg);
    assert.ok(
      ratio >= pair.minRatio,
      `Contraste insuficiente em "${pair.name}": ${ratio.toFixed(2)}:1 (mínimo exigido: ${pair.minRatio}:1)`
    );
    testPass(`${pair.name} → ${ratio.toFixed(2)}:1 (Aprovado WCAG AAA)`);
  } catch (e) {
    testFail(pair.name, e);
  }
}

// ─── SUITE 2: Auditoria de Contenção de Layout em 100vh ───────────────────────
console.log('\n--- SUITE 2: Auditoria Estrita de Contenção 100vh no CSS ---');

const cssPath = path.join(__dirname, 'css', 'style.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

try {
  // 1. html, body com overflow: hidden e 100vh / 100dvh
  assert.ok(
    /html,\s*body\s*\{[^}]*overflow:\s*hidden/i.test(cssContent),
    'html, body deve ter overflow: hidden declarado'
  );
  assert.ok(
    /html,\s*body\s*\{[^}]*height:\s*100vh/i.test(cssContent) || /html,\s*body\s*\{[^}]*height:\s*100dvh/i.test(cssContent),
    'html, body deve ter altura definida para 100vh / 100dvh'
  );
  assert.ok(
    /html,\s*body\s*\{[^}]*max-height:\s*100vh/i.test(cssContent) || /html,\s*body\s*\{[^}]*max-height:\s*100dvh/i.test(cssContent),
    'html, body deve ter max-height: 100vh / 100dvh para impedir expansão'
  );
  testPass('html, body estritamente contido em 100vh/100dvh com overflow: hidden');
} catch (e) {
  testFail('Contenção de html, body', e);
}

try {
  // 2. #app-main e dashboard-grid
  assert.ok(
    /#app-main\s*\{[^}]*max-height:\s*100%/i.test(cssContent),
    '#app-main deve ter max-height: 100%'
  );
  assert.ok(
    /#app-main\s*\{[^}]*overflow:\s*hidden/i.test(cssContent),
    '#app-main deve conter overflow: hidden'
  );
  assert.ok(
    /\.dashboard-grid\s*\{[^}]*max-height:\s*100%/i.test(cssContent),
    '.dashboard-grid deve ter max-height: 100%'
  );
  testPass('#app-main e .dashboard-grid com contenção rígida');
} catch (e) {
  testFail('Contenção do grid principal', e);
}

try {
  // 3. Painéis e scroll interno
  assert.ok(
    /\.huge-instructions\s*\{[^}]*overflow-y:\s*auto/i.test(cssContent),
    'Apenas .huge-instructions deve ter overflow-y: auto para rolagem interna'
  );
  testPass('Rolagem isolada internamente na lista de instruções (.huge-instructions)');
} catch (e) {
  testFail('Rolagem isolada', e);
}

// ─── SUITE 3: Auditoria de Tipografia de Sistema Segura ───────────────────────
console.log('\n--- SUITE 3: Tipografia de Sistema Segura (Resiliência Offline) ---');

try {
  assert.ok(
    /--font-sans:[^;]*system-ui/i.test(cssContent),
    'Pilha sans-serif deve conter system-ui nativo'
  );
  assert.ok(
    /--font-sans:[^;]*-apple-system/i.test(cssContent) || /--font-sans:[^;]*Segoe UI/i.test(cssContent),
    'Pilha sans-serif deve conter fontes de sistema seguras (Apple/Windows)'
  );
  assert.ok(
    /--font-display:[^;]*system-ui/i.test(cssContent) || /--font-display:[^;]*Arial Narrow/i.test(cssContent) || /--font-display:[^;]*Impact/i.test(cssContent),
    'Pilha display condensada deve conter fallbacks de sistema seguros'
  );
  testPass('Pilhas tipográficas de sistema configuradas para tolerância total offline');
} catch (e) {
  testFail('Tipografia de sistema', e);
}

// ─── RESUMO FINAL ────────────────────────────────────────────────────────────
console.log('\n======================================================');
console.log(`TOTAL DE AUDITORIAS EXECUTADAS: ${passCount + failCount}`);
console.log(`PASSOU: ${passCount} | FALHOU: ${failCount}`);
console.log('======================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 TODAS AS AUDITORIAS DE ACESSIBILIDADE E CONTENÇÃO PASSARAM COM SUCESSO!\n');
  process.exit(0);
}

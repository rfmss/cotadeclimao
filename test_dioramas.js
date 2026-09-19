/**
 * Teste automatizado: js/dioramas.js
 * Valida que cada fator gera uma cena 3D não-vazia para todos os
 * níveis E que a intensidade da cena escala com os dados reais
 * (nivel + valor) — nada pode ser estático/cenográfico.
 */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync('js/dioramas.js', 'utf8');
const captured = [];
global.window = {};
eval(src);
const D = window.ClimDioramas;

const factors = ['calor', 'sol', 'vento', 'umidade', 'ar', 'chuva'];
const levels  = ['bom', 'atencao', 'alerta', 'perigo', 'emergencia', 'indisponivel'];

let pass = 0;
function ok(msg) { pass++; console.log('  ✓ ' + msg); }
function fail(msg) { console.error('  ❌ FALHA: ' + msg); process.exitCode = 1; }

const count = (html, token) => (html.match(new RegExp(token, 'g')) || []).length;

console.log('--- Cobertura: 6 fatores × 6 níveis geram cenas 3D ---');
for (const f of factors) {
  for (const l of levels) {
    const html = D.get(f, 30, l);
    assert.ok(html && html.length > 40, `${f}/${l}: cena vazia`);
    assert.ok(html.includes('.dm') === false, 'red flag');
    assert.ok(html.includes('dm-island'), `${f}/${l}: sem ilha`);
    assert.ok(html.includes('dm-grass'), `${f}/${l}: sem grama`);
    assert.ok(html.includes('dm-dirt-s') && html.includes('dm-dirt-e'), `${f}/${l}: faces 3D ausentes`);
  }
}
ok('todas as 36 combinações renderizam ilha isométrica 3D');

console.log('--- Calibração por severidade (nivel) ---');
const seq = ['bom', 'atencao', 'alerta', 'perigo', 'emergencia'];
function monotonic(f, token) {
  const nums = seq.map(l => count(D.get(f, 30, l), token));
  for (let i = 1; i < nums.length; i++) {
    assert.ok(nums[i] >= nums[i - 1], `${f} ${token}: não cresce (${nums.join(',')})`);
  }
  assert.ok(nums[nums.length - 1] > nums[0], `${f} ${token}: extremo == bom (${nums.join(',')})`);
  return nums;
}
{
  const n = monotonic('calor', 'dm-hw');
  ok(`calor: ondas de calor crescentes ${n.join(' → ')}`);
  const c = monotonic('calor', 'dm-crk');
  ok(`calor: rachaduras crescem ${c.join(' → ')}`);
}
{
  const n = monotonic('sol', 'dm-uvray');
  ok(`sol: raios UV crescentes ${n.join(' → ')}`);
}
{
  const n = monotonic('vento', 'dm-ring');
  ok(`vento: vórtices crescentes ${n.join(' → ')}`);
}
{
  const n = monotonic('umidade', 'dm-ubigdrop');
  ok(`umidade: gotas crescentes ${n.join(' → ')}`);
}
{
  const n = monotonic('chuva', 'dm-raindrop2');
  ok(`chuva: pingos crescentes ${n.join(' → ')}`);
  const bom = D.get('chuva', 30, 'bom');
  const limite = D.get('chuva', 30, 'emergencia');
  assert.ok(!bom.includes('⚡'), 'chuva boa não pode ter raio');
  assert.ok(limite.includes('⚡'), 'chuva extrema deve ter raio');
  ok('chuva: raio apenas em perigo/extremo');
}
{
  const n = monotonic('ar', 'dm-puff');
  ok(`ar: fumaça crescente ${n.join(' → ')}`);
}

console.log('--- Calibração por valor da leitura (valor) ---');
{
  const hBaixo = count(D.get('calor', 8, 'bom'), 'height:');
  const hAlto  = count(D.get('calor', 38, 'emergencia'), 'height:');
  const parse = html => Number((html.match(/mercury" style="height:(\d+)%/) || [])[1]);
  const low = parse(D.get('calor', 8, 'bom'));
  const high = parse(D.get('calor', 38, 'emergencia'));
  assert.ok(Number.isFinite(low) && Number.isFinite(high), 'alturas do mercúrio devem ser numéricas');
  assert.ok(high > low + 30, `mercúrio deve subir com o valor real (${low}% vs ${high}%)`);
  ok(`calor: mercúrio ${low}% (valor 8) → ${high}% (valor 38)`);
}

console.log('--- Indisponível vira cena neutra (sem falso alarme) ---');
{
  const html = D.get('ar', null, 'indisponivel');
  assert.ok(html.includes('dm-indisponivel'), 'cenas indisponíveis devem ter classe neutra');
  assert.ok(!html.includes('😷'), 'sem estado perigoso quando não há dado');
  ok('indisponivel: cena neutra, sem severidade fake');
}

console.log(`\nRESULTADO: ${pass} validações passaram.`);
if (process.exitCode) { console.log('HOUVE FALHAS.'); process.exit(1); }
console.log('🎉 TODOS OS DIORAMAS VALIDADOS COM DADOS REAIS!\n');
const src = require('fs').readFileSync('js/dioramas.js','utf8');
// Stub window
global.window = {};
eval(src);
const D = window.ClimDioramas;
const factors = ['calor','sol','vento','umidade','ar','chuva'];
const levels  = ['bom','atencao','alerta','perigo','emergencia'];
let ok = true;
for (const f of factors) {
  for (const l of levels) {
    const html = D.get(f, 30, l);
    if (!html || html.length < 10) { console.error('EMPTY:', f, l); ok = false; }
    if (html.includes('rotateX') || html.includes('preserve-3d')) { console.error('OLD 3D:', f, l); ok = false; }
  }
}
console.log(ok ? 'ALL PASS' : 'FAILED');

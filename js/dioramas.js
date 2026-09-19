/**
 * Cota do Climão — Dioramas Isométricos
 * Mini-cenas 3D em CSS puro para cada fator climático.
 */
(function () {
  'use strict';

  function dm(id, content) {
    return '<div class="dm dm-' + id + '" aria-hidden="true"><div class="dm-shadow"></div><div class="dm-island">' + content + '</div></div>';
  }

  function genVento(valor, nivel) {
    const speeds = { bom: 1.4, atencao: 1.0, alerta: 0.65, perigo: 0.4, emergencia: 0.22 };
    const s = speeds[nivel] || 1.0;
    return dm('vento',
      '<div class="dm-grass"></div>' +
      '<div class="dm-dirt-s"></div><div class="dm-dirt-e"></div>' +
      '<div class="dm-mast"><div class="dm-flag" style="animation-duration:' + (s * 1.2) + 's"></div></div>' +
      '<div class="dm-tornado">' +
        '<div class="dm-swirl dm-s1" style="animation-duration:' + (s * 0.5) + 's"></div>' +
        '<div class="dm-swirl dm-s2" style="animation-duration:' + (s * 0.38) + 's"></div>' +
        '<div class="dm-swirl dm-s3" style="animation-duration:' + (s * 0.3) + 's"></div>' +
        '<div class="dm-leaf dm-l1"></div>' +
        '<div class="dm-leaf dm-l2"></div>' +
        '<div class="dm-leaf dm-l3"></div>' +
      '</div>'
    );
  }

  function genCalor(valor, nivel) {
    const intense = nivel === 'emergencia' || nivel === 'perigo';
    const waves = intense ? 5 : 3;
    let waveHTML = '';
    for (let i = 0; i < waves; i++) {
      waveHTML += '<div class="dm-heatwave" style="animation-delay:' + (i * 0.3) + 's;left:' + (8 + i * 18) + 'px"></div>';
    }
    const fillPct = Math.min(90, Math.max(20, (valor / 40) * 90));
    return dm('calor',
      '<div class="dm-grass dm-grass-dry"></div>' +
      '<div class="dm-dirt-s"></div><div class="dm-dirt-e"></div>' +
      '<div class="dm-thermo">' +
        '<div class="dm-thermo-tube"><div class="dm-thermo-fill" style="height:' + fillPct + '%"></div></div>' +
        '<div class="dm-thermo-bulb"></div>' +
      '</div>' +
      '<div class="dm-heatwaves">' + waveHTML + '</div>'
    );
  }

  function genSol(valor, nivel) {
    const spd = { bom: 8, atencao: 6, alerta: 4, perigo: 3, emergencia: 2 };
    const s = spd[nivel] || 6;
    let rays = '';
    for (let i = 0; i < 8; i++) {
      rays += '<div class="dm-ray dm-ray-' + (i+1) + '"></div>';
    }
    return dm('sol',
      '<div class="dm-grass dm-grass-sun"></div>' +
      '<div class="dm-dirt-s"></div><div class="dm-dirt-e"></div>' +
      '<div class="dm-sun-orb" style="animation-duration:' + s + 's"><div class="dm-sun-core"></div>' + rays + '</div>' +
      '<div class="dm-shadow-obj"></div>'
    );
  }

  function genUmidade(valor, nivel) {
    const n = nivel === 'alerta' || nivel === 'emergencia' ? 5 : 3;
    let drops = '';
    for (let i = 0; i < n; i++) {
      drops += '<div class="dm-drop" style="left:' + (14 + i * 18) + 'px;animation-delay:' + (i * 0.35) + 's"></div>';
    }
    return dm('umidade',
      '<div class="dm-grass dm-grass-wet"></div>' +
      '<div class="dm-dirt-s"></div><div class="dm-dirt-e"></div>' +
      '<div class="dm-well"><div class="dm-well-wall"></div><div class="dm-well-arch"></div></div>' +
      '<div class="dm-drops">' + drops + '</div>' +
      '<div class="dm-pond"></div>'
    );
  }

  function genAr(valor, nivel) {
    const pCount = { bom: 2, atencao: 3, alerta: 5, perigo: 7, emergencia: 9 }[nivel] || 3;
    const clr = { bom: '#b8c4aa', atencao: '#d4a853', alerta: '#c47c2e', perigo: '#b5512c', emergencia: '#7a2020' }[nivel] || '#c0c0c0';
    let pts = '';
    for (let i = 0; i < pCount; i++) {
      pts += '<div class="dm-particle" style="left:' + (4 + (i % 4) * 22) + 'px;top:' + (8 + Math.floor(i / 4) * 16) + 'px;animation-delay:' + (i * 0.22) + 's;background:' + clr + '"></div>';
    }
    const spd = nivel === 'emergencia' ? 0.7 : nivel === 'perigo' ? 1.0 : 1.5;
    return dm('ar',
      '<div class="dm-grass dm-grass-dry"></div>' +
      '<div class="dm-dirt-s"></div><div class="dm-dirt-e"></div>' +
      '<div class="dm-smokestack">' +
        '<div class="dm-smoke dm-smoke-1" style="animation-duration:' + spd + 's"></div>' +
        '<div class="dm-smoke dm-smoke-2" style="animation-duration:' + (spd * 0.8) + 's"></div>' +
      '</div>' +
      '<div class="dm-particles">' + pts + '</div>'
    );
  }

  function genChuva(valor, nivel) {
    const n = Math.min(10, Math.max(3, Math.round(valor / 10)));
    let rain = '';
    for (let i = 0; i < n; i++) {
      rain += '<div class="dm-rain" style="left:' + (4 + i * 10) + 'px;animation-delay:' + ((i * 0.18) % 0.9) + 's"></div>';
    }
    return dm('chuva',
      '<div class="dm-grass dm-grass-wet"></div>' +
      '<div class="dm-dirt-s"></div><div class="dm-dirt-e"></div>' +
      '<div class="dm-cloud"><div class="dm-cloud-body"></div>' +
        '<div class="dm-rain-container">' + rain + '</div>' +
      '</div>' +
      '<div class="dm-puddle"></div>'
    );
  }

  window.ClimDioramas = {
    get: function(factorId, valor, nivel) {
      var map = { calor: genCalor, sol: genSol, vento: genVento, umidade: genUmidade, ar: genAr, chuva: genChuva };
      return map[factorId] ? map[factorId](valor || 0, nivel || 'bom') : '';
    }
  };
})();

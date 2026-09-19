/**
 * Cota do Climão — Dioramas 3D (ilhas isométricas) v3
 * Cena por fator climático sobre uma ilha 3D. NADA é cenográfico:
 * cada elemento, animação e cor é calibrado pelos dados reais
 * (nivel de severidade + valor da leitura) recebidos do app.
 */
(function () {
  'use strict';

  var SPEEDS = { bom: 2.4, atencao: 1.7, alerta: 1.05, perigo: 0.6, emergencia: 0.32, indisponivel: 2.4 };
  var TIERS  = { bom: 0, atencao: 1, alerta: 2, perigo: 3, emergencia: 4, indisponivel: 0 };

  function spd(nivel, mult) {
    return ((SPEEDS[nivel] || 1.7) * (mult || 1)).toFixed(2) + 's';
  }

  function pct(valor, max) {
    if (valor == null || max <= 0) return 25;
    return Math.min(96, Math.max(8, Math.round((valor / max) * 88)));
  }

  function tier(nivel, arr) {
    return arr[TIERS[nivel] || 0];
  }

  function cls(nivel) {
    return nivel === 'indisponivel' ? ' dm-indisponivel' : '';
  }

  /* ── Base de cena: sombra + ilha isométrica ─────────────────── */
  function scene(factor, nivel, inner) {
    return '<div class="dm dm-' + factor + cls(nivel) + '">' +
      inner +
      '<div class="dm-shadow"></div>' +
      '<div class="dm-island">' +
        '<div class="dm-grass"></div>' +
        '<div class="dm-dirt-s"></div>' +
        '<div class="dm-dirt-e"></div>' +
      '</div>' +
    '</div>';
  }

  /* ── VENTO — bandeira + vórtices; rotação/quantidade = rajada real ── */
  function genVento(valor, nivel) {
    var spinBase = tier(nivel, [0.7, 0.6, 0.5, 0.38, 0.28, 0.7]);
    var flagDur  = tier(nivel, [1.4, 1.15, 0.9, 0.65, 0.45, 1.4]);
    var swirlN = tier(nivel, [3, 3, 4, 5, 6]);
    var sizes = [15, 27, 40, 46];
    var rings = '';
    for (var i = 0; i < swirlN; i++) {
      var sz = sizes[i % sizes.length];
      rings += '<div class="dm-ring" style="width:' + sz + 'px;height:' + sz + 'px;bottom:' + (2 + Math.floor(i / 4) * 22) + 'px;animation-duration:' + (spinBase + i * 0.05).toFixed(2) + 's"></div>';
    }
    var leaves = [
      { l: 102, b: 18, bg: '#f5b700', d: 1.5, del: 0 },
      { l: 118, b: 34, bg: '#e04b1f', d: 1.2, del: -0.5 },
      { l: 86,  b: 48, bg: '#71cf31', d: 1.0, del: -1 }
    ];
    var leafHTML = '';
    for (var j = 0; j < leaves.length; j++) {
      var lf = leaves[j];
      leafHTML += '<div class="dm-leaf" style="left:' + lf.l + 'px;bottom:' + lf.b + 'px;background:' + lf.bg + ';animation-duration:' + lf.d + 's;animation-delay:' + lf.del + 's"></div>';
    }
    return scene('vento', nivel,
      '<div class="dm-pole"><div class="dm-flag" style="animation-duration:' + flagDur + '"></div></div>' +
      '<div class="dm-vortex">' + rings + '</div>' +
      leafHTML);
  }

  /* ── CHUVA — nuvem (escurece por severidade), pingos + poça ── */
  function genChuva(valor, nivel) {
    var cloudColor = {
      bom: '#9bbbd8', atencao: '#7f96ad', alerta: '#677f96', perigo: '#5b6f85', emergencia: '#46586b', indisponivel: '#8b96a5'
    }[nivel] || 'rgba(148,163,184,0.8)';
    var rainN = tier(nivel, [4, 6, 8, 11, 14]);
    var rain = '';
    for (var i = 0; i < rainN; i++) {
      var h = 12 + (i % 3) * 7;
      rain += '<div class="dm-raindrop2" style="left:' + (12 + i * ((rainN > 8 ? 62 : 70) / rainN)) + 'px;height:' + h + 'px;animation-duration:' + spd(nivel, 0.42 + (i % 4) * 0.05) + ';animation-delay:' + (i * -0.06) + 's"></div>';
    }
    var hasLightning = nivel === 'emergencia' || nivel === 'perigo';
    var puddleW = 34 + tier(nivel, [4, 6, 8, 11, 14]) * 2;
    return scene('chuva', nivel,
      (hasLightning ? '<div class="dm-lightning" style="animation-duration:' + spd(nivel, 0.5) + '">⚡</div>' : '') +
      '<div class="dm-bigcloud" style="background:' + cloudColor + '"></div>' +
      rain +
      '<div class="dm-puddle" style="bottom:' + (18 + tier(nivel, [2, 2, 3, 4, 5])) + 'px;right:14px"></div>');
  }

  /* ── CALOR — termômetro em pé com mercúrio no valor real + solo rachado ── */
  function genCalor(valor, nivel) {
    var fillH = pct(valor, 40);
    var heatColor = nivel === 'emergencia' ? '#ef4444' : nivel === 'perigo' ? '#f97316' : nivel === 'alerta' ? '#ea580c' : '#fbbf24';
    if (nivel === 'indisponivel') heatColor = '#9ca3af';
    var shimN = tier(nivel, [3, 3, 4, 5, 6]);
    var shims = '';
    for (var i = 0; i < shimN; i++) {
      shims += '<div class="dm-hw" style="left:' + (24 + i * 16) + 'px;animation-duration:' + spd(nivel, 0.8 + i * 0.15) + ';animation-delay:' + (i * 0.25) + 's"></div>';
    }
    var crackN = tier(nivel, [3, 3, 4, 5, 6]);
    var cracks = '';
    for (var k = 0; k < crackN; k++) {
      cracks += '<div class="dm-crk" style="left:' + (36 + k * 30) + 'px;animation-duration:' + (2.2 - k * 0.25).toFixed(2) + 's"></div>';
    }
    return scene('calor', nivel,
      '<div class="dm-thermo">' +
        '<div class="dm-thermo-body"><div class="dm-thermo-mercury" style="height:' + fillH + '%;background:' + heatColor + '"></div></div>' +
        '<div class="dm-thermo-ball" style="background:' + heatColor + '"></div>' +
        '<div class="dm-thermo-tick dm-t1"></div>' +
        '<div class="dm-thermo-tick dm-t2"></div>' +
        '<div class="dm-thermo-tick dm-t3"></div>' +
      '</div>' +
      shims + cracks);
  }

  /* ── SOL — disco UV + raios; contagem/ritmo cresce com o risco ── */
  function genSol(valor, nivel) {
    var uvRays = tier(nivel, [4, 4, 5, 6, 8]);
    var rays = '';
    for (var i = 0; i < uvRays; i++) {
      rays += '<div class="dm-uvray" style="transform:rotate(' + (i * (360 / uvRays)) + 'deg);animation-duration:' + spd(nivel, 0.9 + i * 0.1) + ';animation-delay:' + (i * 0.18) + 's"></div>';
    }
    return scene('sol', nivel,
      '<div class="dm-sun2">' +
        '<div class="dm-sun-glow2" style="animation-duration:' + spd(nivel) + '"></div>' +
        rays +
        '<div class="dm-sun-disc2"></div>' +
      '</div>');
  }

  /* ── UMIDADE — gotas + vapor subindo da poça ── */
  function genUmidade(valor, nivel) {
    var dropN = tier(nivel, [3, 4, 5, 6, 8]);
    var drops = '';
    for (var i = 0; i < dropN; i++) {
      var sz = 10 + (i % 3) * 5;
      drops += '<div class="dm-ubigdrop" style="width:' + sz + 'px;height:' + (sz * 1.3) + 'px;left:' + (10 + i * 14) + 'px;animation-duration:' + spd(nivel, 0.6 + (i % 3) * 0.2) + ';animation-delay:' + (i * -0.35) + 's"></div>';
    }
    var vaporN = tier(nivel, [3, 3, 4, 5, 6]);
    var vapors = '';
    for (var v = 0; v < vaporN; v++) {
      vapors += '<div class="dm-vapor" style="left:' + (26 + v * 22) + 'px;animation-duration:' + spd(nivel, 2.6 + v * 0.25) + ';animation-delay:' + (v * -0.7) + 's"></div>';
    }
    return scene('umidade', nivel, drops + vapors + '<div class="dm-pond" style="left:38px"></div>');
  }

  /* ── AR — neblina + fumaça; densidade e cor = AQI real ── */
  function genAr(valor, nivel) {
    var puffN = tier(nivel, [2, 3, 5, 7, 9]);
    var puffColor = {
      bom: 'rgba(167,243,208,0.55)',
      atencao: 'rgba(253,230,138,0.6)',
      alerta: 'rgba(253,186,116,0.65)',
      perigo: 'rgba(252,165,165,0.7)',
      emergencia: 'rgba(196,181,253,0.75)',
      indisponivel: 'rgba(148,163,184,0.5)'
    }[nivel] || 'rgba(148,163,184,0.5)';
    var haze = { bom: 0.12, atencao: 0.22, alerta: 0.34, perigo: 0.48, emergencia: 0.62, indisponivel: 0.12 }[nivel] || 0.12;
    var icon = { bom: '🌿', atencao: '🌫', alerta: '🌫', perigo: '😮‍💨', emergencia: '😷', indisponivel: '—' }[nivel] || '🌫';
    var puffs = '';
    for (var i = 0; i < puffN; i++) {
      var sz = 18 + (i % 3) * 15;
      puffs += '<div class="dm-puff" style="width:' + sz + 'px;height:' + sz + 'px;left:' + (12 + i * 20) + 'px;top:' + (6 + (i % 2) * 18) + 'px;background:' + puffColor + ';animation-duration:' + spd(nivel, 1.3 + i * 0.25) + ';animation-delay:' + (i * -0.4) + 's"></div>';
    }
    return scene('ar', nivel,
      '<div class="dm-haze" style="--dm-haze:' + haze + '"></div>' +
      puffs +
      '<div class="dm-aqi-badge">' + icon + '</div>');
  }

  window.ClimDioramas = {
    get: function (factorId, valor, nivel) {
      var map = { calor: genCalor, sol: genSol, vento: genVento, umidade: genUmidade, ar: genAr, chuva: genChuva };
      return map[factorId] ? map[factorId](valor || 0, nivel || 'bom') : '';
    }
  };
})();
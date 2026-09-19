/**
 * Cota do Climão — Dioramas 2D Animados
 * Cenas compactas em CSS puro, calibradas por nível de severidade.
 */
(function () {
  'use strict';

  var SPEEDS = { bom: 2.2, atencao: 1.6, alerta: 1.0, perigo: 0.62, emergencia: 0.35 };

  function spd(nivel, mult) {
    return (((SPEEDS[nivel] || 1.6) * (mult || 1))).toFixed(2) + 's';
  }

  /* ── CALOR ─────────────────────────────────────── */
  function genCalor(valor, nivel) {
    var rays = '';
    for (var i = 0; i < 8; i++) {
      rays += '<div class="dm-sun2-ray" style="transform:rotate(' + (i * 45) + 'deg) translateX(-50%)"></div>';
    }
    var n = nivel === 'emergencia' ? 8 : nivel === 'perigo' ? 6 : nivel === 'alerta' ? 5 : 4;
    var shimmers = '';
    for (var j = 0; j < n; j++) {
      shimmers += '<div class="dm-shimmer2" style="left:' + (6 + j * 11) + 'px;height:' + (28 + j * 7) + 'px;animation-duration:' + spd(nivel, 0.7 + j * 0.12) + ';animation-delay:' + (j * 0.22) + 's"></div>';
    }
    return '<div class="dm dm-calor" style="--dm-speed:' + spd(nivel) + '">' +
      '<div class="dm-sun2"><div class="dm-sun2-core" style="animation-duration:' + spd(nivel) + '"></div>' + rays + '</div>' +
      shimmers + '<div class="dm-crack"></div></div>';
  }

  /* ── SOL ──────────────────────────────────────── */
  function genSol(valor, nivel) {
    var s = spd(nivel, 4);
    var beams = '';
    for (var i = 0; i < 4; i++) {
      beams += '<div class="dm-beam" style="transform:rotate(' + (i * 45) + 'deg);animation-delay:' + (i * 0.5) + 's"></div>';
    }
    return '<div class="dm dm-sol" style="--dm-speed:' + s + '">' +
      '<div class="dm-halo" style="animation-duration:' + s + '"></div>' +
      beams + '<div class="dm-disc"></div></div>';
  }

  /* ── VENTO ────────────────────────────────────── */
  function genVento(valor, nivel) {
    var s = spd(nivel, 0.5);
    var linesN = nivel === 'emergencia' ? 7 : nivel === 'perigo' ? 6 : nivel === 'alerta' ? 5 : nivel === 'atencao' ? 4 : 3;
    var lines = '';
    for (var i = 0; i < linesN; i++) {
      lines += '<div class="dm-wline" style="top:' + (8 + i * 11) + 'px;width:' + (42 + (i % 3) * 18) + '%;left:' + (8 + (i % 2) * 12) + '%;animation-duration:' + spd(nivel, 0.55 + i * 0.08) + ';animation-delay:' + (i * 0.2) + 's"></div>';
    }
    var leavesN = nivel === 'emergencia' ? 4 : nivel === 'perigo' ? 3 : 2;
    var colors = ['#f59e0b','#84cc16','#ef4444','#f97316'];
    var leaves = '';
    for (var j = 0; j < leavesN; j++) {
      leaves += '<div class="dm-leaf2" style="left:' + (4 + j * 16) + 'px;top:' + (18 + j * 14) + 'px;background:' + colors[j % 4] + ';animation-duration:' + spd(nivel, 1.3 + j * 0.4) + ';animation-delay:' + (j * -0.6) + 's"></div>';
    }
    return '<div class="dm dm-vento" style="--dm-speed:' + s + '">' +
      lines +
      '<div class="dm-flagpole"><div class="dm-flag2" style="animation-duration:' + s + '"></div></div>' +
      leaves + '</div>';
  }

  /* ── UMIDADE ──────────────────────────────────── */
  function genUmidade(valor, nivel) {
    var n = nivel === 'emergencia' ? 9 : nivel === 'perigo' ? 7 : nivel === 'alerta' ? 6 : nivel === 'atencao' ? 5 : 3;
    var drops = '';
    for (var i = 0; i < n; i++) {
      drops += '<div class="dm-drop3" style="left:' + (6 + i * 10) + 'px;animation-duration:' + spd(nivel, 0.65 + (i % 3) * 0.15) + ';animation-delay:' + (i * -0.28) + 's"></div>';
    }
    return '<div class="dm dm-umidade" style="--dm-speed:' + spd(nivel) + '">' +
      drops + '<div class="dm-mist2"></div></div>';
  }

  /* ── AR ───────────────────────────────────────── */
  function genAr(valor, nivel) {
    var bgClass = 'dm-ar-bg-' + (nivel || 'bom');
    var pCount = { bom: 4, atencao: 6, alerta: 8, perigo: 10, emergencia: 13 }[nivel] || 5;
    var pSize  = { bom: 4, atencao: 5, alerta: 7, perigo: 8, emergencia: 10 }[nivel] || 5;
    var pColor = {
      bom:       'rgba(52,211,153,0.65)',
      atencao:   'rgba(251,191,36,0.7)',
      alerta:    'rgba(249,115,22,0.7)',
      perigo:    'rgba(220,38,38,0.7)',
      emergencia:'rgba(124,58,237,0.75)'
    }[nivel] || 'rgba(180,180,180,0.65)';
    var pts = '';
    for (var i = 0; i < pCount; i++) {
      var sz = pSize - 1 + (i % 3);
      pts += '<div class="dm-ptc2" style="width:' + sz + 'px;height:' + sz + 'px;left:' + (4 + (i % 5) * 19) + 'px;top:' + (6 + Math.floor(i / 5) * 28 + (i % 3) * 7) + 'px;background:' + pColor + ';animation-duration:' + spd(nivel, 0.9 + i * 0.22) + ';animation-delay:' + (i * -0.25) + 's"></div>';
    }
    var icon = nivel === 'bom' ? '🌿' : nivel === 'emergencia' ? '😷' : '🌫️';
    return '<div class="' + bgClass + '" style="--dm-speed:' + spd(nivel, 1.5) + '">' +
      '<div class="dm-haze2"></div>' + pts +
      '<div class="dm-icon-ar">' + icon + '</div></div>';
  }

  /* ── CHUVA ────────────────────────────────────── */
  function genChuva(valor, nivel) {
    var s = spd(nivel, 0.38);
    var n = nivel === 'emergencia' ? 13 : nivel === 'perigo' ? 11 : nivel === 'alerta' ? 8 : nivel === 'atencao' ? 6 : 4;
    var rain = '';
    for (var i = 0; i < n; i++) {
      rain += '<div class="dm-rain2" style="left:' + (3 + i * 8) + 'px;top:36px;height:' + (10 + (i % 3) * 6) + 'px;animation-duration:' + spd(nivel, 0.45 + (i % 3) * 0.1) + ';animation-delay:' + (i * -0.07) + 's"></div>';
    }
    return '<div class="dm dm-chuva" style="--dm-speed:' + s + '">' +
      '<div class="dm-cloud3"></div>' + rain +
      '<div class="dm-ripple2" style="animation-duration:' + spd(nivel, 0.65) + '"></div>' +
      '<div class="dm-ripple2" style="animation-duration:' + spd(nivel, 0.65) + ';animation-delay:-0.45s;bottom:2px"></div>' +
    '</div>';
  }

  window.ClimDioramas = {
    get: function (factorId, valor, nivel) {
      var map = { calor: genCalor, sol: genSol, vento: genVento, umidade: genUmidade, ar: genAr, chuva: genChuva };
      return map[factorId] ? map[factorId](valor || 0, nivel || 'bom') : '';
    }
  };
})();

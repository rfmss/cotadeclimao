/**
 * Cota do Climão — Painéis de Intensidade (6 itens × 4 níveis)
 * Cada item: ilustração + faixa térmica/técnica × LEVE / MODERADO / FORTE / EXTREMO.
 * O mapeamento imagem→item fica centralizado aqui (facilita corrigir ordem).
 */
(function () {
  'use strict';

  var ITENS = [
    {
      id: 'chuva',
      nome: 'CHUVA',
      img: 'assets/chuva.png',
      desc: 'Probabilidade e acúmulo de precipitação',
      niveis: [
        { label: 'LEVE', faixa: '< 30% · até 2mm', texto: 'Garoa fina e chuvisqueiro', cls: 'l-leve' },
        { label: 'MODERADO', faixa: '30–60% · 2–10mm', texto: 'Chuva irregular intermitente', cls: 'l-moderado' },
        { label: 'FORTE', faixa: '60–85% · 10–30mm', texto: 'Pancadas fortes e volumosas', cls: 'l-forte' },
        { label: 'EXTREMO', faixa: '> 85% · > 30mm', texto: 'Temporais, raios e alagamento', cls: 'l-extremo' }
      ]
    },
    {
      id: 'vento',
      nome: 'VENTO',
      img: 'assets/vento.png',
      desc: 'Escala de Beaufort (OMM)',
      niveis: [
        { label: 'LEVE', faixa: '< 20 km/h · BF3', texto: 'Brisa suave', cls: 'l-leve' },
        { label: 'MODERADO', faixa: '20–38 km/h · BF5', texto: 'Vento favorável à navegação', cls: 'l-moderado' },
        { label: 'FORTE', faixa: '40–60 km/h · BF7-8', texto: 'Ventania com rajadas', cls: 'l-forte' },
        { label: 'EXTREMO', faixa: '> 60 km/h · BF9+', texto: 'Vendaval perigoso no mar', cls: 'l-extremo' }
      ]
    },
    {
      id: 'calor',
      nome: 'CALOR',
      img: 'assets/calor.png',
      desc: 'Temperatura máxima / Bulbo úmido',
      niveis: [
        { label: 'LEVE', faixa: '< 28°C', texto: 'Morno e agradável', cls: 'l-leve' },
        { label: 'MODERADO', faixa: '28–33°C', texto: 'Quente, exige hidratação', cls: 'l-moderado' },
        { label: 'FORTE', faixa: '34–37°C', texto: 'Muito quente, risco de exaustão', cls: 'l-forte' },
        { label: 'EXTREMO', faixa: '> 37°C', texto: 'Escaldante, risco de insolação', cls: 'l-extremo' }
      ]
    },
    {
      id: 'sol',
      nome: 'SOL',
      img: 'assets/sol.png',
      desc: 'Índice UV (WHO/EPA)',
      niveis: [
        { label: 'LEVE', faixa: 'UV 0–2', texto: 'Exposição sem proteção', cls: 'l-leve' },
        { label: 'MODERADO', faixa: 'UV 3–6', texto: 'Proteção moderada', cls: 'l-moderado' },
        { label: 'FORTE', faixa: 'UV 7–10', texto: 'Exigida proteção total', cls: 'l-forte' },
        { label: 'EXTREMO', faixa: 'UV 11+', texto: 'Evite exposição ao sol', cls: 'l-extremo' }
      ]
    },
    {
      id: 'umidade',
      nome: 'UMIDADE',
      img: 'assets/umidade.png',
      desc: 'Massa de vapor atmosférico',
      niveis: [
        { label: 'LEVE', faixa: '< 40%', texto: 'Ar seco, resseca mucosas', cls: 'l-leve' },
        { label: 'MODERADO', faixa: '40–70%', texto: 'Zona confortável', cls: 'l-moderado' },
        { label: 'FORTE', faixa: '70–85%', texto: 'Úmido, sensação de abafado', cls: 'l-forte' },
        { label: 'EXTREMO', faixa: '> 85%', texto: 'Saturado, mormaço intenso', cls: 'l-extremo' }
      ]
    },
    {
      id: 'ar',
      nome: 'AR',
      img: 'assets/ar.png',
      desc: 'Qualidade do ar (AQI · PM2.5)',
      niveis: [
        { label: 'LEVE', faixa: 'AQI < 25', texto: 'Ar limpo e respirável', cls: 'l-leve' },
        { label: 'MODERADO', faixa: 'AQI 25–50', texto: 'Aceitável para a maioria', cls: 'l-moderado' },
        { label: 'FORTE', faixa: 'AQI 50–100', texto: 'Ar pesado, sensíveis afetados', cls: 'l-forte' },
        { label: 'EXTREMO', faixa: 'AQI > 100', texto: 'Insalubre, use máscara', cls: 'l-extremo' }
      ]
    }
  ];

  var niveisCls = ['l-leve', 'l-moderado', 'l-forte', 'l-extremo'];

  function buildItem(it) {
    var levelsHTML = it.niveis.map(function (n) {
      return (
        '<div class="i-cell ' + n.cls + '" role="listitem">' +
          '<span class="i-dot" aria-hidden="true"></span>' +
          '<strong class="i-label">' + n.label + '</strong>' +
          '<span class="i-faixa">' + n.faixa + '</span>' +
          '<span class="i-texto">' + n.texto + '</span>' +
        '</div>'
      );
    }).join('');

    return (
      '<article class="intensity-item" aria-label="' + it.nome + '">' +
        '<div class="intensity-hero">' +
          '<img src="' + it.img + '" alt="Ilustração de ' + it.nome.toLowerCase() + '" loading="lazy" />' +
          '<div class="intensity-name">' + it.nome + '</div>' +
        '</div>' +
        '<p class="intensity-desc">' + it.desc + '</p>' +
        '<div class="i-levels" role="list" aria-label="Níveis de intensidade de ' + it.nome.toLowerCase() + '">' +
          levelsHTML +
        '</div>' +
      '</article>'
    );
  }

  function open(c) {
    return '<div id="intensity-overlay" class="intensity-overlay" role="dialog" aria-modal="true" aria-labelledby="intensity-title">' +
      '<div class="intensity-panel">' +
        '<header class="intensity-head">' +
          '<h2 id="intensity-title">PANORAMA DE INTENSIDADE</h2>' +
          '<p class="intensity-sub">Como cada um dos 6 elementos se manifesta: leve → moderado → forte → extremo</p>' +
          '<button type="button" class="intensity-close" aria-label="Fechar painel de intensidade">✕ FECHAR</button>' +
        '</header>' +
        '<div class="intensity-grid">' +
          ITENS.map(function (it) { return buildItem(it); }).join('') +
          '<div class="intensity-legend" aria-hidden="true">' +
            niveisCls.map(function (ncl) {
              return '<span class="' + ncl + '">' + ncl.replace('l-', '') + '</span>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function init() {
    var btn = document.getElementById('btn-intensity');
    var host = document.getElementById('intensity-host');
    if (!btn || !host) return;

    btn.addEventListener('click', function () { openOverlay(); });

    function openOverlay() {
      if (host.innerHTML === '') host.innerHTML = open();
      var ov = document.getElementById('intensity-overlay');
      ov.hidden = false;
      document.body.style.overflow = 'hidden';
      var close = ov.querySelector('.intensity-close');
      close.addEventListener('click', closeOverlay);
      ov.addEventListener('click', function (e) {
        if (e.target === ov) closeOverlay();
      });
      close.focus();
    }

    function closeOverlay() {
      var ov = document.getElementById('intensity-overlay');
      if (ov) ov.hidden = true;
      document.body.removeAttribute('style');
      if (btn) btn.focus();
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !document.getElementById('intensity-overlay').hidden) closeOverlay();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ClimIntensity = { ITENS: ITENS };
})();
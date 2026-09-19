/**
 * Cota do Climão — Fatores (definição das 6 cotas + indicadores)
 * Cada fator: id, nome, ícone SVG (linha técnica), unidade, faixa ideal
 */
(function () {
  'use strict';

  const I = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  const FACTORS = [
    {
      id: 'calor',
      nome: 'Calor',
      icona: `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" d="M12 2a3.25 3.25 0 0 1 3.245 3.065l.005.185l.001 7.952l.08.069a5 5 0 0 1 1.644 3.223l.019.252L17 17a5 5 0 1 1-8.51-3.56l.18-.17l.079-.068l.001-7.952a3.25 3.25 0 0 1 2.884-3.23l.182-.015zm0 1.5a1.75 1.75 0 0 0-1.744 1.607l-.006.143v8.695l-.309.224a3.5 3.5 0 1 0 4.283.128l-.165-.127l-.307-.225l-.002-8.695A1.75 1.75 0 0 0 12 3.5M12 8a.75.75 0 0 1 .75.75v5.865a2.501 2.501 0 1 1-1.5 0V8.75A.75.75 0 0 1 12 8"/></svg>`,
      unidade: '°C',
      alvo: 'WBGT // ISO 7933',
      ideal: '≤ 28°C',
      escala: 40,
      calcular: (maps) => maps.wbgt,
      nivel: (v) => {
        if (v < 25) return { nivel: 'bom', rotulo: 'Leve' };
        if (v < 27.8) return { nivel: 'atencao', rotulo: 'Dá pra se virar' };
        if (v < 30) return { nivel: 'alerta', rotulo: 'Atenção' };
        if (v < 32) return { nivel: 'perigo', rotulo: 'Muito quente' };
        return { nivel: 'emergencia', rotulo: 'Perigoso' };
      },
    },
    {
      id: 'sol',
      nome: 'Sol',
      icona: `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" d="M12 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 2m0 15a5 5 0 1 0 0-10a5 5 0 0 0 0 10m0-1.5a3.5 3.5 0 1 1 0-7a3.5 3.5 0 0 1 0 7m9.25-2.75a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5zM12 19a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 19m-7.75-6.25a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5zm-.03-8.53a.75.75 0 0 1 1.06 0l1.5 1.5a.75.75 0 0 1-1.06 1.06l-1.5-1.5a.75.75 0 0 1 0-1.06m1.06 15.56a.75.75 0 1 1-1.06-1.06l1.5-1.5a.75.75 0 1 1 1.06 1.06zm14.5-15.56a.75.75 0 0 0-1.06 0l-1.5 1.5a.75.75 0 0 0 1.06 1.06l1.5-1.5a.75.75 0 0 0 0-1.06m-1.06 15.56a.75.75 0 1 0 1.06-1.06l-1.5-1.5a.75.75 0 1 0-1.06 1.06z"/></svg>`,
      unidade: 'UV',
      alvo: 'ÍNDICE UV // WHO',
      ideal: '< 6',
      escala: 11,
      calcular: (maps) => maps.uvMax,
      nivel: (v) => window.ClimCalc.uvNivel(v),
    },
    {
      id: 'vento',
      nome: 'Vento',
      icona: `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" d="M3 3.748a.75.75 0 0 1 .75-.75h16.504a.75.75 0 0 1 .6 1.2L16.69 9.75l4.164 5.551a.75.75 0 0 1-.6 1.2H4.5v4.75a.75.75 0 0 1-.648.743L3.75 22a.75.75 0 0 1-.743-.648L3 21.25zm15.754.75H4.5v10.503h14.254l-3.602-4.802a.75.75 0 0 1 0-.9z"/></svg>`,
      unidade: 'km/h',
      alvo: 'BEAUFORT // OMM',
      ideal: '≤ BF5 (38 km/h)',
      escala: 120,
      calcular: (maps) => maps.windMax,
      nivel: (v) => {
        const b = window.ClimCalc.beaufort(v);
        const n = window.ClimCalc.ventoNivel(v);
        return { nivel: n, rotulo: `${b.rotulo} · BF${b.n}` };
      },
    },
    {
      id: 'umidade',
      nome: 'Umidade',
      icona: `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" d="M14.75 20.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5zm2.75-3a.75.75 0 0 1 0 1.5h-11a.75.75 0 0 1 0-1.5zm1-3a.75.75 0 0 1 0 1.5h-13a.75.75 0 0 1 0-1.5zM11.47 2.22a.75.75 0 0 1 1.06 0c.404.403 2 2.128 3.5 4.362c1.245 1.856 2.496 4.171 2.86 6.418h-1.519c-.355-1.829-1.406-3.822-2.588-5.582A33 33 0 0 0 12 3.848a33 33 0 0 0-2.783 3.57C8.035 9.178 6.984 11.171 6.629 13h-1.52c.365-2.247 1.615-4.562 2.862-6.418c1.5-2.234 3.095-3.959 3.499-4.362"/></svg>`,
      unidade: '%',
      alvo: 'BULBO ÚMIDO',
      ideal: '< 80%',
      escala: 100,
      calcular: (maps) => maps.humidityMax,
      nivel: (v) => {
        if (v < 40) return { nivel: 'atencao', rotulo: 'Ar seco — hidrate' };
        if (v < 80) return { nivel: 'bom', rotulo: 'Sobe um pouco' };
        return { nivel: 'alerta', rotulo: 'Muito úmido — abafa' };
      },
    },
    {
      id: 'ar',
      nome: 'Ar',
      icona: `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" d="M5 5.5a.5.5 0 1 0-1 0a.5.5 0 0 0 1 0m1.5 0a2 2 0 1 1-4 0a2 2 0 0 1 4 0M11.973 4a4.07 4.07 0 0 0-3.896 2.884l-.045.15a.75.75 0 1 0 1.436.432l.045-.15a2.57 2.57 0 0 1 2.46-1.816C13.362 5.5 14.5 6.627 14.5 8a2.5 2.5 0 0 1-2.5 2.5H2.75a.75.75 0 0 0 0 1.5H12a4 4 0 0 0 4-4c0-2.217-1.826-4-4.027-4m7.098 6c-1.265 0-2.385.82-2.783 2.013a.75.75 0 0 0 1.424.474a1.44 1.44 0 0 1 1.359-.987c.789 0 1.429.64 1.429 1.43V13a1.5 1.5 0 0 1-1.5 1.5H2.75a.75.75 0 0 0 0 1.5h12.5a1.25 1.25 0 1 1 0 2.5h-.135c-.4 0-.765-.226-.945-.583a.75.75 0 0 0-1.34.672A2.56 2.56 0 0 0 15.115 20h.135a2.75 2.75 0 0 0 2.45-4H19a3 3 0 0 0 3-3v-.07A2.93 2.93 0 0 0 19.07 10M9.5 20a.5.5 0 1 1 0-1a.5.5 0 0 1 0 1m0 1.5a2 2 0 1 0 0-4a2 2 0 0 0 0 4M20 6.5a.5.5 0 1 0-1 0a.5.5 0 0 0 1 0m1.5 0a2 2 0 1 1-4 0a2 2 0 0 1 4 0"/></svg>`,
      unidade: 'AQI',
      alvo: 'AQI // PM2.5',
      ideal: '< 40',
      escala: 100,
      calcular: (maps) => maps.aqi,
      nivel: (a) => {
        if (a == null) return { nivel: 'bom', rotulo: 'Sem dados' };
        if (a < 25) return { nivel: 'bom', rotulo: 'Ar limpo' };
        if (a < 45) return { nivel: 'atencao', rotulo: 'Aceitável' };
        if (a < 65) return { nivel: 'alerta', rotulo: 'Ar pesado' };
        return { nivel: 'perigo', rotulo: 'Ar ruim' };
      },
    },
    {
      id: 'chuva',
      nome: 'Chuva',
      icona: `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" d="M12 4.001c3.169 0 4.966 2.097 5.227 4.63h.08A3.687 3.687 0 0 1 21 12.314a3.687 3.687 0 0 1-3.692 3.682h-.582l-1.582 2.635a.75.75 0 0 1-1.344-.659l.045-.091l1.149-1.885h-2.136l-1.582 2.635a.75.75 0 0 1-1.344-.659l.045-.091l1.148-1.885H8.987l-1.58 2.635a.75.75 0 0 1-1.345-.659l.045-.091l1.148-1.885h-.562A3.687 3.687 0 0 1 3 12.314A3.687 3.687 0 0 1 6.693 8.63h.08C7.035 6.08 8.831 4 12 4m0 1.498c-2.071 0-3.877 1.633-3.877 3.889c0 .357-.319.638-.684.638h-.69c-1.261 0-2.284 1.001-2.284 2.236S5.488 14.5 6.75 14.5h10.5c1.261 0 2.284-1.002 2.284-2.237s-1.023-2.236-2.284-2.236h-.69c-.365 0-.684-.28-.684-.638c0-2.285-1.806-3.89-3.877-3.89"/></svg>`,
      unidade: '%',
      alvo: 'PROBABILIDADE // MM',
      ideal: '< 30%',
      escala: 100,
      calcular: (maps) => maps.rainProbMax,
      nivel: (v, maps) => window.ClimCalc.chuvaNivel(v, maps && maps.rainSum),
    },
  ];

  // Personas
  const PERSONAS = [
    { id: 'geral', nome: 'MORADOR', descricao: 'Uso geral: lazer, saúde, rotina' },
    { id: 'pescador', nome: 'PESCADOR', descricao: 'Mar, vento, ondas e segurança' },
    { id: 'agricultor', nome: 'AGRICULTOR', descricao: 'Solo, seca e chuva' },
  ];

  // Pesos da Preocupação (padrão / modo El Niño)
  const PESOS = {
    normal: { calor: 0.35, sol: 0.15, umidade: 0.15, ar: 0.15, vento: 0.10, chuva: 0.10 },
    elnino: { calor: 0.40, sol: 0.15, umidade: 0.10, ar: 0.20, vento: 0.05, chuva: 0.10 },
  };

  window.ClimFactors = { FACTORS, PERSONAS, PESOS };
})();
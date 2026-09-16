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
      icona: I('<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/><line x1="12" y1="9" x2="12" y2="3"/>'),
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
      icona: I('<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"/>'),
      unidade: '',
      alvo: 'ÍNDICE UV // WHO',
      ideal: '< 6',
      escala: 11,
      calcular: (maps) => maps.uvMax,
      nivel: (v) => window.ClimCalc.uvNivel(v),
    },
    {
      id: 'vento',
      nome: 'Vento',
      icona: I('<path d="M9.59 4.59A2 2 0 1 1 11 8H2"/><path d="M12.59 19.41A2 2 0 1 0 14 16H2"/><path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/>'),
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
      icona: I('<path d="M12 2.5l5.7 5.7a8 8 0 1 1-11.4 0z"/>'),
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
      icona: I('<path d="M6.5 3.5c3.6 1.6 6 4.8 6 8.5s-2.4 6.9-6 8.5c-1.9-2.7-3-5.4-3-8.5s1.1-5.8 3-8.5z" fill="none"/><path d="M17.5 3.5c-3.6 1.6-6 4.8-6 8.5s2.4 6.9 6 8.5c1.2-1.7 1.9-3.4 1.9-5.2" stroke-dasharray="2.2 2.4"/>'),
      unidade: '',
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
      icona: I('<path d="M23 12a11.05 11.05 0 0 0-22 0z"/><path d="M18 19a3 3 0 0 1-6 0v-3.3"/><path d="M2 12h20"/>'),
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
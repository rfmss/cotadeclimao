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
      icona: '<span class="iconify" data-icon="fluent:temperature-24-filled"></span>',
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
      icona: '<span class="iconify" data-icon="fluent:weather-sunny-24-filled"></span>',
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
      icona: '<span class="iconify" data-icon="fluent:flag-24-filled"></span>',
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
      icona: '<span class="iconify" data-icon="fluent:weather-humidity-24-filled"></span>',
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
      icona: '<span class="iconify" data-icon="fluent:weather-duststorm-24-filled"></span>',
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
      icona: '<span class="iconify" data-icon="fluent:weather-rain-24-filled"></span>',
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
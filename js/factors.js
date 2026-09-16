/**
 * Cota do Climão — Fatores (definição das 6 cotas + indicadores)
 * Cada fator: id, nome, ícone (emoji), unidades, faixa ideal, funções de nível
 */
(function () {
  'use strict';

  const FACTORS = [
    {
      id: 'calor',
      nome: 'Calor',
      icona: '🌡️',
      unidade: '°C',
      alvo: 'WBGT',
      ideal: '≤ 28°C',
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
      icona: '☀️',
      unidade: '',
      alvo: 'UV Index',
      ideal: '< 6',
      calcular: (maps) => maps.uvMax,
      nivel: (v) => {
        const r = window.ClimCalc.uvNivel(v);
        return r;
      },
    },
    {
      id: 'vento',
      nome: 'Vento',
      icona: '💨',
      unidade: 'km/h',
      alvo: 'Beaufort',
      ideal: '≤ 5 (38 km/h)',
      calcular: (maps) => maps.windMax,
      nivel: (v) => {
        const b = window.ClimCalc.beaufort(v);
        const n = window.ClimCalc.ventoNivel(v);
        return { nivel: n, rotulo: `${b.rotulo} (BF${b.n})` };
      },
    },
    {
      id: 'umidade',
      nome: 'Umidade',
      icona: '💦',
      unidade: '%',
      alvo: 'Bulbo Úmido (WB)',
      ideal: '< 80%',
      calcular: (maps) => maps.humidityMax,
      nivel: (v) => {
        if (v < 40) return { nivel: 'atencao', rotulo: 'Ar seco — hidrate' };
        if (v < 80) return { nivel: 'bom', rotulo: 'OK, mas pode abafar' };
        return { nivel: 'alerta', rotulo: 'Muito úmido — abafado' };
      },
    },
    {
      id: 'ar',
      nome: 'Ar',
      icona: '🌬️',
      unidade: '',
      alvo: 'AQI (PM2.5)',
      ideal: '< 40',
      calcular: (maps) => maps.aqi,
      nivel: (a) => {
        if (a == null) return { nivel: 'bom', rotulo: 'Sem dados' };
        if (a < 20) return { nivel: 'bom', rotulo: 'Ar limpo' };
        if (a < 40) return { nivel: 'atencao', rotulo: 'Aceitável' };
        if (a < 60) return { nivel: 'alerta', rotulo: 'Ar pesado' };
        return { nivel: 'perigo', rotulo: 'Ar ruim — proteja-se' };
      },
    },
    {
      id: 'chuva',
      nome: 'Chuva',
      icona: '🌧️',
      unidade: 'mm',
      alvo: 'Probabilidade',
      ideal: '< 30%',
      calcular: (maps) => maps.rainProbMax,
      nivel: (v, maps) => {
        return window.ClimCalc.chuvaNivel(v, maps.rainSum);
      },
    },
  ];

  // Personas
  const PERSONAS = [
    { id: 'geral', nome: '🏠 Morador', descricao: 'Uso geral: lazer, saúde, rotina' },
    { id: 'pescador', nome: '🎣 Pescador', descricao: 'Mar, vento, ondas e segurança' },
    { id: 'agricultor', nome: '🌾 Agricultor', descricao: 'Solo, seca e chuva' },
  ];

  // Pesos da Preocupação (padrão / modo El Niño)
  const PESOS = {
    normal: { calor: 0.35, sol: 0.15, umidade: 0.15, ar: 0.15, vento: 0.10, chuva: 0.10 },
    elnino: { calor: 0.40, sol: 0.15, umidade: 0.10, ar: 0.20, vento: 0.05, chuva: 0.10 },
  };

  window.ClimFactors = { FACTORS, PERSONAS, PESOS };
})();
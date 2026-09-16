/**
 * Cota do Climão — Score de Preocupação
 * Média ponderada dos 6 fatores, normalizada para 0-100.
 * Ajuste automático no modo El Niño (pesos diferentes).
 */
(function () {
  'use strict';

  // Mapeia nível → pontuação interna (0-100)
  const PONTOS = {
    bom: 10,
    atencao: 35,
    alerta: 60,
    perigo: 82,
    emergencia: 95,
  };

  function calcular(fatoresCalculados, elninoAtivo) {
    const pesos = (elninoAtivo ? window.ClimFactors.PESOS.elnino : window.ClimFactors.PESOS.normal);
    let soma = 0;
    let total = 0;

    const detalhe = {};
    for (const f of fatoresCalculados) {
      const p = pesos[f.id];
      if (p == null) continue;
      const pts = PONTOS[f.nivel?.nivel] || 10;
      soma += pts * p;
      total += p;
      detalhe[f.id] = { pts, peso: p, nivel: f.nivel?.nivel };
    }

    const score = total > 0 ? Math.round(soma / total) : 0;
    const nivel =
      score < 20 ? { nivel: 'bom', rotulo: 'Clima bem tranquilo hoje' } :
      score < 40 ? { nivel: 'atencao', rotulo: 'Dá pra se virar com cuidado' } :
      score < 60 ? { nivel: 'alerta', rotulo: 'Preocupação média — fique atento' } :
      score < 80 ? { nivel: 'perigo', rotulo: 'Preocupação alta — evite excessos' } :
      { nivel: 'emergencia', rotulo: 'Preocupação máxima — redobre o cuidado' };

    return { score, nivel, detalhe, pesos, modoElNino: !!elninoAtivo };
  }

  window.ClimRisk = { calcular, PONTOS };
})();
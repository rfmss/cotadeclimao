/**
 * Cota do Climão — Recomendações
 * Linguagem variada (evita repetição de "cota") + persona do usuário.
 * Pescador → foca mar/vento/ondas; Agricultor → solo/seca/chuva; Morador → geral.
 */
(function () {
  'use strict';

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function recomendacoes(fatoresCalculados, persona, elnino) {
    const recs = [];

    for (const f of fatoresCalculados) {
      const v = f.valor;
      const nivel = f.nivel ? f.nivel.nivel : 'bom';
      const id = f.id;

      if (id === 'calor') {
        if (nivel === 'perigo' || nivel === 'emergencia') {
          recs.push(`🥵 Calor ${v}°C (WBGT). Evite trabalho pesado das 11h às 15h. Hidrate-se a cada 20 min — sem esperar sede.`);
        } else if (nivel === 'alerta') {
          recs.push(`🥵 Calor ${v}°C. Se precisar se mexer, faça pausas à sombra e beba água fresca.`);
        }
        if (window.ClimCalc && window.ClimCalc.bulboUmido) {
          const wb = window.ClimCalc.bulboUmido(f.wetBulb ?? v);
          if (wb.nivel === 'perigo' || wb.nivel === 'emergencia') {
            recs.push(`💦 Bulbo úmido ${f.wetBulb ?? v}°C — ar quente e úmido atrapalha o corpo a se resfriar. Não exagere.`);
          }
        }
      }

      if (id === 'sol') {
        if (nivel === 'perigo' || nivel === 'emergencia') {
          recs.push(`☀️ UV ${v}. Fique na sombra entre 10h e 16h. Chapéu, camisa de manga longa e protetor são obrigatórios.`);
        } else if (nivel === 'alerta') {
          recs.push(`☀️ UV ${v}. Não prolongue o sol — reforce protetor e boné.`);
        }
      }

      if (id === 'vento') {
        if (persona === 'pescador' && nivel !== 'bom') {
          recs.push(`🛶 Vento ${v} km/h. Só leve a embarcação se souber exatamente o que está fazendo — condições mudam de manhã para tarde.`);
        } else if (nivel === 'perigo' || nivel === 'emergencia') {
          recs.push(`💨 Vento ${v} km/h. Cuidado com objetos soltos e quedas de galhos.`);
        } else if (nivel === 'alerta') {
          recs.push(`💨 Rajadas fortes. Se for à praia, atenção com guarda-sóis e crianças.`);
        }
      }

      if (id === 'umidade' && nivel === 'atencao') {
        recs.push(`💦 Umidade ${v}%. Ar seco — hidrate e evite respirar por muito tempo o ar muito seco.`);
      }

      if (id === 'ar') {
        if (nivel === 'alerta' || nivel === 'perigo') {
          recs.push(`😮‍💨 Ar pesado (AQI ${v}). Se sentir tosse ou irritação nos olhos, reduza o tempo fora de casa.`);
        }
      }

      if (id === 'chuva') {
        if (nivel === 'alerta' || nivel === 'perigo') {
          recs.push(`🌧️ Chuva com ${v}% de chance${f.rainSum ? ` (prevista ~${f.rainSum}mm)` : ''}. Se for pescar/colher, confira o radar antes de sair.`);
        }
      }
    }

    // El Niño
    if (elnino && elnino.ativo) {
      recs.push('🌍 El Niño ativo — calor acima do normal, chuva irregular e risco de incêndio. Economize água e fique alerta.');
    }

    // Fallback se nada veio
    if (!recs.length) {
      const fallbacks = [
        '🍃 Clima tranquilo por aqui. Pode aproveitar — com água e proteção de praxe.',
        '😊 Nada de crítico hoje. A natureza está generosa.',
        '✅ Condições boas. Mantenha a hidratação e se proteja do sol de costume.',
      ];
      recs.push(pick(fallbacks));
    }

    // Máximo 4 recs para não virar spam
    return recs.slice(0, 4);
  }

  window.ClimRecs = { recomendacoes, pick };
})();
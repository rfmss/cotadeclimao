/**
 * Automated Test Suite: test_matrix.js
 * Acceptance Criteria R2: Matriz Combinatória de Microcopy Dinâmico
 * 
 * Simula 5 cenários meteorológicos extremos e operacionais:
 * 1. Calor extremo (WBGT elevado, mormaço ou UV perigoso)
 * 2. Vendaval litorâneo (Vento severo, Beaufort BF6-BF8, rajadas e mar agitado)
 * 3. Ar poluído / seca (AQI crítico, PM2.5, baixa umidade relativa e aridez)
 * 4. Tempestade convectiva (Chuva torrencial, descargas elétricas e enxurrada)
 * 5. Dia ameno (Condições favoráveis de conforto biometeorológico)
 * 
 * Valida para cada perfil ('geral', 'pescador', 'agricultor'):
 * - Geração de frases ricas com rigor técnico meteorológico
 * - Exclusividade e sem repetições dentro da mesma chamada
 * - Roletagem sem repetições consecutivas ao longo de múltiplos ciclos
 * - Diferenciação semântica e contextual por persona
 */

const assert = require('assert');
const ClimRecs = require('./js/recommendations.js');

let passCount = 0;
let failCount = 0;

function testPass(msg) {
  passCount++;
  console.log(`  ✓ ${msg}`);
}

function testFail(msg, err) {
  failCount++;
  console.error(`  ❌ FALHA: ${msg}`, err ? (err.message || err) : '');
}

console.log('======================================================');
console.log('🧪 BATERIA DE TESTES: MATRIZ DE MICROCOPY DINÂMICO (R2)');
console.log('======================================================\n');

// 5 Cenários Meteorológicos Definidos
const SCENARIOS = {
  calorExtremo: {
    nome: 'Cenário 1: Calor Extremo (WBGT 34.5°C, Umidade 84%, UV 11)',
    factors: {
      calor: { valor: 34.5, nivel: 'emergencia', wetBulb: 30.2 },
      sol: { valor: 11, nivel: 'emergencia' },
      vento: { valor: 14, nivel: 'bom' },
      umidade: { valor: 84, nivel: 'alerta' },
      ar: { valor: 25, nivel: 'bom' },
      chuva: { valor: 10, nivel: 'bom', rainSum: 0 },
    },
    expectedKeywords: {
      geral: ['WBGT', 'idosos', 'hidratação'],
      pescador: ['térmica', 'água', 'convés'],
      agricultor: ['roça', 'lavoura', 'térmico'],
    },
    expectedTipo: 'calorExtremo'
  },

  vendavalLitoraneo: {
    nome: 'Cenário 2: Vendaval Litorâneo (Vento 64 km/h, Beaufort BF8, Rajadas)',
    factors: {
      calor: { valor: 25.0, nivel: 'bom', wetBulb: 21.0 },
      sol: { valor: 3, nivel: 'bom' },
      vento: { valor: 64, nivel: 'emergencia' },
      umidade: { valor: 65, nivel: 'bom' },
      ar: { valor: 20, nivel: 'bom' },
      chuva: { valor: 20, nivel: 'bom', rainSum: 2 },
    },
    expectedKeywords: {
      geral: ['rajadas', 'Beaufort', 'vento'],
      pescador: ['navegação', 'barra', 'mar'],
      agricultor: ['pulveriza', 'deriva', 'vento'],
    },
    expectedTipo: 'vendaval'
  },

  arPoluidoSeca: {
    nome: 'Cenário 3: Ar Poluído / Seca Crônica (AQI 82, PM2.5, Umidade 26%)',
    factors: {
      calor: { valor: 28.5, nivel: 'atencao', wetBulb: 18.0 },
      sol: { valor: 6, nivel: 'alerta' },
      vento: { valor: 18, nivel: 'bom' },
      umidade: { valor: 26, nivel: 'atencao' },
      ar: { valor: 82, nivel: 'perigo' },
      chuva: { valor: 0, nivel: 'bom', rainSum: 0 },
    },
    expectedKeywords: {
      geral: ['partícula', 'respirat', 'AQI'],
      pescador: ['fumaça', 'visibilidade', 'ar'],
      agricultor: ['queimada', 'seca', 'solo'],
    },
    expectedTipo: 'arSeca'
  },

  tempestadeConvectiva: {
    nome: 'Cenário 4: Tempestade Convectiva (Chuva 90%, ~45mm acumulados, Rajadas)',
    factors: {
      calor: { valor: 24.0, nivel: 'bom', wetBulb: 23.0 },
      sol: { valor: 1, nivel: 'bom' },
      vento: { valor: 38, nivel: 'atencao' },
      umidade: { valor: 95, nivel: 'alerta' },
      ar: { valor: 15, nivel: 'bom' },
      chuva: { valor: 90, nivel: 'emergencia', rainSum: 45 },
    },
    expectedKeywords: {
      geral: ['precipita', 'alagamento', 'enxurrada'],
      pescador: ['tempestade', 'mar', 'raio'],
      agricultor: ['solo', 'erosão', 'trator'],
    },
    expectedTipo: 'tempestade'
  },

  diaAmeno: {
    nome: 'Cenário 5: Dia Ameno e Estável (WBGT 22°C, Vento 14 km/h, Ar Puro)',
    factors: {
      calor: { valor: 22.0, nivel: 'bom', wetBulb: 18.0 },
      sol: { valor: 4, nivel: 'atencao' },
      vento: { valor: 14, nivel: 'bom' },
      umidade: { valor: 60, nivel: 'bom' },
      ar: { valor: 18, nivel: 'bom' },
      chuva: { valor: 5, nivel: 'bom', rainSum: 0 },
    },
    expectedKeywords: {
      geral: ['amena', 'livre', 'tranquil'],
      pescador: ['mar', 'pesca', 'estável'],
      agricultor: ['ideal', 'campo', 'cultur'],
    },
    expectedTipo: 'diaAmeno'
  }
};

const PERSONAS = ['geral', 'pescador', 'agricultor'];

// ─── SUITE 1: Validação dos 5 Cenários × 3 Personas (15 Combinações) ─────────
console.log('--- SUITE 1: Matriz de 5 Cenários × 3 Perfis ---');

for (const [scenKey, scen] of Object.entries(SCENARIOS)) {
  console.log(`\n▶ ${scen.nome}`);

  // 1. Classificação correta do cenário
  const cenarioDetectado = ClimRecs.avaliarCenario(scen.factors);
  try {
    assert.strictEqual(
      cenarioDetectado.tipo,
      scen.expectedTipo,
      `Classificação incorreta: esperado ${scen.expectedTipo}, obtido ${cenarioDetectado.tipo}`
    );
    testPass(`Classificação automática do cenário validada: ${cenarioDetectado.tipo}`);
  } catch (e) {
    testFail(`Classificação do cenário ${scenKey}`, e);
  }

  // 2. Validação para cada persona
  for (const persona of PERSONAS) {
    try {
      const recs = ClimRecs.recomendacoes(scen.factors, persona);

      // Quantidade adequada (2 a 4 recomendações densas)
      assert.ok(Array.isArray(recs), 'Deve retornar array de recomendações');
      assert.ok(recs.length >= 2, `Deve conter ao menos 2 recomendações (recebido ${recs.length})`);
      assert.ok(recs.length <= 4, `Não deve exceder 4 recomendações (recebido ${recs.length})`);

      // Sem repetição interna (todas as frases exclusivas)
      const uniqueSet = new Set(recs);
      assert.strictEqual(
        uniqueSet.size,
        recs.length,
        `Frases repetidas encontradas para persona ${persona} no cenário ${scenKey}`
      );

      // Validação de termos técnicos ricos
      const joined = recs.join(' ').toLowerCase();
      const expectedList = scen.expectedKeywords[persona];
      let matches = 0;
      for (const kw of expectedList) {
        if (joined.includes(kw.toLowerCase())) matches++;
      }
      assert.ok(
        matches >= 1,
        `Microcopy deve conter vocabulário técnico contextualizado para ${persona}. Esperados ao menos 1 de [${expectedList.join(', ')}]`
      );

      testPass(`Perfil [${persona.toUpperCase()}]: ${recs.length} frases exclusivas e ricas geradas`);
    } catch (e) {
      testFail(`Geração de recomendações para ${persona} no cenário ${scenKey}`, e);
    }
  }
}

// ─── SUITE 2: Roletagem e Anti-Repetição Consecutiva ──────────────────────────
console.log('\n--- SUITE 2: Mecanismo de Roletagem e Anti-Repetição ---');

for (const persona of PERSONAS) {
  try {
    const scen = SCENARIOS.calorExtremo;
    const history = [];

    // Executa 4 ciclos consecutivos com opções de ciclo
    for (let c = 0; c < 4; c++) {
      const recs = ClimRecs.recomendacoes(scen.factors, persona, null, { cycle: c });
      assert.ok(recs.length > 0, 'Recomendações não devem ser vazias');
      const primaryPhrase = recs[0];
      history.push(primaryPhrase);
    }

    // Verifica que as frases principais rotacionaram sem se repetir consecutivamente
    for (let i = 1; i < history.length; i++) {
      assert.notStrictEqual(
        history[i],
        history[i - 1],
        `Frase consecutiva idêntica detectada no ciclo ${i} para ${persona}`
      );
    }

    // Diversidade do pool: deve gerar ao menos 3 frases primárias distintas nos 4 ciclos
    const distinctPhrases = new Set(history);
    assert.ok(
      distinctPhrases.size >= 3,
      `Roletagem com diversidade insuficiente: ${distinctPhrases.size} distintas em 4 ciclos`
    );

    testPass(`Roletagem dinâmica sem repetição consecutiva para persona [${persona.toUpperCase()}]: ${distinctPhrases.size} variações`);
  } catch (e) {
    testFail(`Roletagem consecutiva para ${persona}`, e);
  }
}

// ─── SUITE 3: Contextualização Telegráfica El Niño ────────────────────────────
console.log('\n--- SUITE 3: Injeção de Contexto Telegráfico El Niño ---');

try {
  const scen = SCENARIOS.calorExtremo;
  const elnino = { ativo: true, anomalia: 1.8, fonte: 'CPTEC/INPE' };

  for (const persona of PERSONAS) {
    const recs = ClimRecs.recomendacoes(scen.factors, persona, elnino);
    const hasElNino = recs.some((r) => r.toLowerCase().includes('el niño'));
    assert.ok(
      hasElNino,
      `Recomendações para ${persona} devem incluir contexto de El Niño quando ativo`
    );

    // Deve ser específico para cada persona
    if (persona === 'pescador') {
      const pText = recs.join(' ').toLowerCase();
      assert.ok(pText.includes('termoclina') || pText.includes('cardumes') || pText.includes('redes'), 'Contexto marinho de El Niño presente');
    } else if (persona === 'agricultor') {
      const aText = recs.join(' ').toLowerCase();
      assert.ok(aText.includes('evapotranspiração') || aText.includes('hídrica') || aText.includes('vegetal'), 'Contexto agrícola de El Niño presente');
    }
    testPass(`Contexto El Niño validado com sucesso para perfil [${persona.toUpperCase()}]`);
  }
} catch (e) {
  testFail('Contexto El Niño', e);
}

// ─── RESUMO FINAL ────────────────────────────────────────────────────────────
console.log('\n======================================================');
console.log(`TOTAL DE TESTES EXECUTADOS: ${passCount + failCount}`);
console.log(`PASSOU: ${passCount} | FALHOU: ${failCount}`);
console.log('======================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 TODOS OS TESTES DA MATRIZ DE MICROCOPY PASSARAM COM SUCESSO!\n');
  process.exit(0);
}

/**
 * Cota do Climão — Motor Combinatório Inteligente de Microcopy Dinâmico
 * R2:
 * - Cruza múltiplos fatores (WBGT/temperatura, vento/Beaufort, umidade, UV, AQI/PM2.5, chuva, persona, El Niño)
 * - Matriz combinatória de regras técnicas de meteorologia aplicada
 * - Contextualização profunda por persona (geral / morador, pescador, agricultor)
 * - Motor de roletagem com eliminação estrita de repetições (anti-repetition pool)
 * - Suporte UMD (Node.js e browser)
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.ClimRecs = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Histórico de rotação para garantir roletagem sem repetições consecutivas
  const rotationCounters = new Map();

  function getRotationIndex(key, poolSize) {
    if (poolSize <= 1) return 0;
    const current = rotationCounters.get(key) || 0;
    rotationCounters.set(key, (current + 1) % poolSize);
    return current;
  }

  function pick(arr) {
    if (!Array.isArray(arr) || !arr.length) return '';
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Normaliza os fatores para um mapa simples de leitura
   */
  function normalizeFactors(fatoresCalculados) {
    const map = {
      calor: { valor: null, nivel: 'bom' },
      sol: { valor: null, nivel: 'bom' },
      vento: { valor: null, nivel: 'bom' },
      umidade: { valor: null, nivel: 'bom' },
      ar: { valor: null, nivel: 'bom' },
      chuva: { valor: null, nivel: 'bom', rainSum: 0 },
    };

    if (Array.isArray(fatoresCalculados)) {
      for (const f of fatoresCalculados) {
        if (!f || !f.id) continue;
        const lvl = (typeof f.nivel === 'object' && f.nivel !== null) ? f.nivel.nivel : (f.nivel || 'bom');
        map[f.id] = {
          valor: f.valor != null && !isNaN(f.valor) ? Number(f.valor) : null,
          nivel: lvl,
          wetBulb: f.wetBulb != null ? Number(f.wetBulb) : null,
          rainSum: f.rainSum != null ? Number(f.rainSum) : 0,
        };
      }
    } else if (typeof fatoresCalculados === 'object' && fatoresCalculados !== null) {
      const isNum = (v) => typeof v === 'number' && !isNaN(v) && isFinite(v);
      for (const key of Object.keys(map)) {
        if (fatoresCalculados[key] !== undefined && fatoresCalculados[key] !== null) {
          const item = fatoresCalculados[key];
          const lvl = (typeof item.nivel === 'object' && item.nivel !== null) ? item.nivel.nivel : (item.nivel || 'bom');
          map[key] = {
            valor: (item.valor != null && isNum(item.valor)) ? Number(item.valor) : (isNum(item) ? item : null),
            nivel: lvl,
            wetBulb: (item.wetBulb != null && isNum(item.wetBulb)) ? Number(item.wetBulb) : null,
            rainSum: (item.rainSum != null && isNum(item.rainSum)) ? Number(item.rainSum) : 0,
          };
        }
      }
    }

    return map;
  }

  /**
   * Banco combinatório de microcopy técnico contextualizado por perfil
   */
  const PHRASE_BANKS = {
    // 1. Calor Extremo (WBGT elevado + Mormaço / Radiação Solar)
    calorExtremo: {
      mormaco: {
        geral: [
          '🌡️ Mormaço sufocante: alta taxa de vapor d\'água ({umidade}%) bloqueia o resfriamento por sudorese sob WBGT de {wbgt}°C. Hidratação isotônica fracionada obrigatória para idosos a cada 20 min.',
          '🌡️ Estresse higrotérmico crítico: saturação do ar ({umidade}%) impede a dissipação evaporativa do calor metabólico. Permaneça em recintos ventilados e monitore sintomas de síncope térmica em crianças.',
          '🌡️ Ar abafado e sobrecarga fisiológica: WBGT de {wbgt}°C associado a umidade de {umidade}%. Redobre cuidados de climatização passiva; banhos tépidos e repouso estrito nas horas centrais.',
          '🌡️ Calor convectivo sufocante: taxa metabólica basal sofre esforço cardíaco compensatório sob umidade de {umidade}%. Suspenda qualquer atividade esportiva ou faxina pesada ao ar livre.'
        ],
        pescador: [
          '🎣 Sobrecarga térmica em convés aberto: umidade litorânea ({umidade}%) e WBGT de {wbgt}°C duplicam o desgaste físico. Carregue suprimento extra de água doce a bordo e faça pausas sob o toldo.',
          '🎣 Espelho d\'água refletor e mormaço denso: com {umidade}% de umidade e WBGT de {wbgt}°C, a taxa de perda hídrica duplica nas manobras de rede. Evite saídas solitárias e hidrate-se continuamente.',
          '🎣 Radiação reflexiva combinada a ar saturado ({umidade}%): o esforço de puxada sob WBGT {wbgt}°C induz exaustão precoce. Programe recolhimento de redes antes das 11h ou após as 16h.',
          '🎣 Estresse térmico na linha de arrebentação: vapor saturado ({umidade}%) reduz a lucidez de manobra. Mantenha sais de reidratação acessíveis na cabine de pilotagem.'
        ],
        agricultor: [
          '🌾 Alerta fitossanitário e humano: sob WBGT de {wbgt}°C e umidade de {umidade}%, o esforço físico na roça induz estresse térmico acelerado. Interrompa o trabalho pesado entre 10h30 e 15h30.',
          '🌾 Manejo sob sobrecarga térmica: evaporação foliar acelerada e atmosfera sufocante ({umidade}% de umidade). Priorize irrigação no início da manhã e descanse a equipe sob copas densas.',
          '🌾 Risco de golpe de calor na lavoura: calor de {wbgt}°C somado a mormaço impede a termorregulação no corte ou capina. Disponibilize pontos de água fresca sombreados e vigilância mútua entre trabalhadores.',
          '🌾 Parada operacional recomendada: atmosfera opressiva com {umidade}% de umidade eleva o risco cardíaco no campo. Transfira a carga pesada para horários crepusculares.'
        ]
      },
      actinico: {
        geral: [
          '☀️ Radiação actínica e estresse térmico combinados: índice UV {uv} e WBGT {wbgt}°C exigem barreira física (chapéu de aba larga, óculos UV400) e bloqueador solar FPS 50+ reaplicado a cada 2h.',
          '☀️ Pico de radiação ultravioleta extrema (UV {uv}): feixes actínicos atingem a derme em menos de 15 min. Proteja crianças e idosos com roupas de trama fechada e mantenha abrigo de sombra total.',
          '☀️ Índice ultravioleta severo (UV {uv}) com calor de {wbgt}°C: alto risco de eritema solar e insolação. Evite trânsito a pé no meio do dia e hidrate os olhos com colírio lubrificante.',
          '☀️ Radiação solar direta em nível perigoso (UV {uv}): sobrecarga cumulativa nos tecidos oculares e dérmicos. Atividades de lazer ao ar livre devem ser postergadas para o fim da tarde.'
        ],
        pescador: [
          '🎣 Radiação duplicada pela lâmina d\'água: UV {uv} com calor de {wbgt}°C eleva o perigo de ceratite actínica e queimaduras profundas. Viseira, camisa UV manga longa e óculos polarizados são vitais.',
          '🎣 Reflexão marinha agressiva sob UV {uv}: o mar projeta feixes solares adicionais no rosto do navegador. Reforce protetor labial e facial mesmo sob névoa fina.',
          '🎣 Condução sob sol a pino (UV {uv}): sem cobertura na embarcação, o tempo limite seguro de exposição direta cai para 10 minutos. Use balaclava de pesca e óculos com filtro UVA/UVB.',
          '🎣 Queimadura actínica acelerada no mar aberto: feixes UV {uv} combinados a salitre causam rápida desidratação e lesões dérmicas. Mantenha vestuário protetor molhado com água doce se necessário.'
        ],
        agricultor: [
          '🌾 Insolação direta nas linhas de plantio: índice UV {uv} com WBGT de {wbgt}°C demanda chapéu de palha com aba integral e camisas de proteção UV. Monitore sinais de vertigem entre os trabalhadores.',
          '🌾 Radiação solar nociva sobre o talhão: pico de UV {uv} deteriora defensivos sensíveis à fotólise e sobrecarrega a equipe. Faça rotação de tarefas para áreas sob sombrites.',
          '🌾 Carga actínica severa na colheita: sob UV {uv}, o trabalho desprotegido provoca desidratação dérmica e queima de córnea. Obrigatoriedade de mangas compridas e intervalos frequentes à sombra.',
          '🌾 Exposição ocupacional no campo: UV {uv} exige proteção física rigorosa para a nuca e braços. Programe a pulverização e adubação fora da janela solar crítica.'
        ]
      }
    },

    // 2. Vendaval Litorâneo (Vento forte, rajadas e mar agitado)
    vendaval: {
      costeiro: {
        geral: [
          '💨 Vendaval litorâneo com rajadas de {vento} km/h (Beaufort BF{bf}): recolha toldos, vasos e objetos soltos em varandas. Mantenha distância de árvores frondosas e fiações suspensas.',
          '💨 Rajadas costeiras intensas atingindo {vento} km/h: vento Beaufort BF{bf} com forte pressão dinâmica. Praia totalmente imprópria para barracas e guarda-sóis com risco de arremesso.',
          '💨 Alerta de vento contínuo ({vento} km/h, BF{bf}): instabilidade na rede de distribuição aérea. Mantenha lanternas carregadas e evite estacionar veículos sob copas antigas.',
          '💨 Vento em intensidade severa ({vento} km/h): ventania costeira ergue detritos e dificulta o equilíbrio de idosos ao ar livre. Permaneça abrigado em áreas construídas.'
        ],
        pescador: [
          '🎣 Risco crítico de navegação (Beaufort BF{bf}, {vento} km/h): arrebentação violenta na barra do rio e correntes de deriva fortes. Pequenas embarcações devem suspender travessias marítimas.',
          '🎣 Mar revolto e vento desfavorável ({vento} km/h): formação rápida de ondas de vento e perda de manobrabilidade de proa. Reforce amarrações nos trapiches e fundeios de segurança.',
          '🎣 Vendaval com força Beaufort BF{bf}: entrada e saída de barra bloqueadas por quebra de crista de onda. Risco iminente de adernamento para botes e catamarãs artesanais.',
          '🎣 Condições severas no mar aberto: rajadas de {vento} km/h geram marpicado agressivo e spray salino cortante. Não desafie a rebentação; recolha apetrechos de pesca imediatamente.'
        ],
        agricultor: [
          '🌾 Deriva química incontrolável: vento de {vento} km/h (Beaufort BF{bf}) inviabiliza pulverizações e calagens. Suspenda aplicação de defensivos para evitar contaminação de áreas vizinhas.',
          '🌾 Ação mecânica do vento sobre culturas: rajadas de {vento} km/h podem provocar acamamento em milharais e quebra de hastes em bananeiras. Vistorie escoramentos e quebra-ventos.',
          '🌾 Desgaste por abrasão e dessecação eólica: vento intenso ({vento} km/h) eleva o estresse evapotranspirativo da folhagem e derruba flores e frutos jovens. Reforce a amarração de estufas.',
          '🌾 Risco de destelhamento de galpões rurais: rajadas de {vento} km/h forçam estruturas leves de armazenamento. Evite reparos em coberturas enquanto o vento persistir.'
        ]
      }
    },

    // 3. Ar Poluído / Seca Crônica (AQI elevado, PM2.5 e baixa umidade)
    arSeca: {
      poluicao: {
        geral: [
          '🌬️ Ar com alta carga de micropartículas (AQI {aqi}, PM2.5) e umidade baixa ({umidade}%): particulados finos penetram a barreira pulmonar. Umidifique os cômodos e utilize soro nasal.',
          '🌬️ Qualidade do ar degradada associada à seca: AQI de {aqi} gera irritação ocular e broncoespasmo em pessoas com asma. Mantenha portas e janelas vedadas e evite caminhadas ao ar livre.',
          '🌬️ Inversão térmica e fumaça em suspensão: atmosfera estagnada com AQI {aqi}. Hidrate mucosas com ingestão contínua de água e evite queima de folhas ou lixo no perímetro urbano.',
          '🌬️ Ressecamento das vias respiratórias: umidade crítica ({umidade}%) com saturação particulada (AQI {aqi}). Populações vulneráveis devem usar máscara com filtro e evitar exercícios externos.'
        ],
        pescador: [
          '🎣 Visibilidade reduzida por névoa seca e fumaça (AQI {aqi}): navegação na foz exige atenção dobrada a bancos de areia e balizamento sonoro/visual. Proteja a visão contra o ar seco.',
          '🎣 Atmosfera opaca sobre o estuário: índice de qualidade do ar em {aqi} irrita as vias respiratórias durante manobras prolongadas no rio. Mantenha boa hidratação a bordo.',
          '🎣 Ressecamento e partículas no canal: vento brando associado a fumaça de queimadas (AQI {aqi}) reduz o conforto respiratório na lida. Evite esforço excessivo no recolhimento de redes.',
          '🎣 Ar tóxico estagnado na costa: particulados PM2.5 (AQI {aqi}) agravam fadiga em travessias longas. Mantenha colírio e água fresca na embarcação para mitigar o ressecamento ocular.'
        ],
        agricultor: [
          '🌾 Alerta de queimada e aridez severa: umidade de apenas {umidade}% e AQI {aqi}. Proibição absoluta do uso do fogo para limpeza de pastagens ou restos de colheita.',
          '🌾 Solo ressecado e poeira no manejo agrícola: atmosfera com baixa umidade ({umidade}%) e particulado suspenso (AQI {aqi}). Operadores de tratores devem usar filtros de cabine e máscaras PFF2.',
          '🌾 Estresse hídrico vegetal e ar poluído: taxa de evaporação crítica com ar seco. Priorize fertirrigação noturna e evite revolver o solo seco para conter a erosão eólica.',
          '🌾 Risco de fagulhas em palhadas secas: sob {umidade}% de umidade, qualquer faísca de maquinário pode deflagrar focos de incêndio florestal incontroláveis. Mantenha abafadores e tanques de prontidão.'
        ]
      }
    },

    // 4. Tempestade Convectiva (Chuva pesada, enxurrada e raios)
    tempestade: {
      convectiva: {
        geral: [
          '🌧️ Instabilidade convectiva severa: probabilidade de precipitação de {chuva}% (~{volume}mm previstos). Evite áreas sujeitas a alagamento rápido e nunca atravesse enxurradas a pé ou de carro.',
          '🌧️ Temporal com risco de descargas elétricas e encharcamento: volume previsto de ~{volume}mm. Afaste-se de estruturas metálicas abertas, não tome banho durante a trovoada e desligue aparelhos da tomada.',
          '🌧️ Precipitação torrencial no litoral: solo em rápida saturação hidráulica com ~{volume}mm de chuva. Mantenha calhas desobstruídas e redobre a cautela em pontilhões e drenagens urbanas.',
          '🌧️ Frente de tempestade costeira: fortes pancadas com vento associado. Mantenha crianças abrigadas e evite contato com águas de escoamento superficial contaminadas.'
        ],
        pescador: [
          '🎣 Alerta de tempestade e descargas elétricas no mar: com {chuva}% de probabilidade e chuva torrencial, recolha a embarcação. Risco de raios sobre mastros metálicos e marolas confusas.',
          '🎣 Mar revolto sob convecção profunda: chuva forte (~{volume}mm) anula a visibilidade de boias e referências costeiras. Permaneça atracado em porto seguro.',
          '🎣 Enxurrada desaguando na barra do rio: chuva de ~{volume}mm eleva a correnteza fluvial na foz, gerando turbilhonamento perigoso. Aborte manobras de entrada na desembocadura.',
          '🎣 Perigo meteorológico na costa: tempestade com perda repentina de potência por vento contrário e chuva cega. Amarre a embarcação com cabo duplo no cais.'
        ],
        agricultor: [
          '🌾 Risco de erosão laminar e voçorocas: previsão de ~{volume}mm de chuva concentrada. Vistorie curvas de nível, terraceamentos e canais de drenagem para evitar perdas de solo fértil.',
          '🌾 Encharcamento radicular e compactação: solo saturado por chuva torrencial inviabiliza tráfego de tratores. Risco de atolamento de maquinário e asfixia de raízes em baixadas.',
          '🌾 Perigo de descargas atmosféricas no descampado: recolha imediatamente a equipe da lavoura ao primeiro trovão. Tratores e cercas de arame conduzem raios com risco de morte.',
          '🌾 Interrupção de colheita e tratos culturais: excesso hídrico favorece patógenos fúngicos e atrasa a secagem de grãos. Aguarde a drenagem do terreno antes de retomar o manejo.'
        ]
      }
    },

    // 5. Dia Ameno / Condições Favoráveis (Janela meteorológica benigna)
    diaAmeno: {
      estavel: {
        geral: [
          '🍃 Janela meteorológica amena e estável: atmosfera limpa (AQI {aqi}), vento tranquilo de {vento} km/h e WBGT seguro de {wbgt}°C. Condições excelentes para caminhadas e lazer ao ar livre.',
          '🍃 Equilíbrio térmico e ar puro: dia com parâmetros dentro dos limites de conforto biometeorológico. Aproveite o dia com proteção solar de rotina e hidratação regular.',
          '🍃 Condições atmosféricas favoráveis: sem extremos de temperatura ou rajadas agressivas. Bom momento para ventilar a casa e realizar atividades de rotina com tranquilidade.',
          '🍃 Clima equilibrado na região costeira: índices dentro da faixa ideal. Excelente oportunidade para atividades ao ar livre para todas as idades com os cuidados básicos de praxe.'
        ],
        pescador: [
          '🎣 Mar estável e vento favorável ({vento} km/h, Beaufort BF{bf}): condições ideais para navegação e travessia da barra. Maré e marolas previsíveis para a faina de pesca.',
          '🎣 Janela operacional aberta no estuário: vento brando e boa visibilidade no canal. Excelente dia para revisão de amarrações, saída costeira e recolhimento de redes.',
          '🎣 Condições hidrodinâmicas seguras: mar calmo sem ondas de choque ou ventania transversal. Boa oportunidade para pesca de linha e deslocamento seguro pelo litoral.',
          '🎣 Estabilidade meteorológica no mar: brisa marinha em escala Beaufort BF{bf} sem ameaça de tempestade convectiva. Aproveite a maré propícia com segurança.'
        ],
        agricultor: [
          '🌾 Janela ideal para tratos culturais: vento brando ({vento} km/h) e temperatura amena ({wbgt}°C) proporcionam eficiência máxima em pulverizações e adubações sem deriva.',
          '🌾 Condições agroclimáticas perfeitas para o campo: solo em umidade equilibrada e ausência de estresse térmico. Dia propício para semeadura, podas e colheita intensiva.',
          '🌾 Clima favorável para a lida na roça: trabalhadores com boa margem de conforto térmico. Aproveite a estabilidade do tempo para adiantar o cronograma operacional.',
          '🌾 Balanço térmico equilibrado no cultivo: sem evapotranspiração excessiva ou risco de tombamento por vento. Condições excelentes para o desenvolvimento vegetativo.'
        ]
      }
    }
  };

  /**
   * Avalia a combinação meteorológica e classifica o cenário predominante
   */
  function avaliarCenario(factors) {
    const f = factors;
    const wbgt = f.calor?.valor ?? 25;
    const uv = f.sol?.valor ?? 3;
    const wind = f.vento?.valor ?? 15;
    const hum = f.umidade?.valor ?? 65;
    const aqi = f.ar?.valor ?? 20;
    const rain = f.chuva?.valor ?? 0;
    const rainSum = f.chuva?.rainSum ?? 0;

    // Prioridade 1: Tempestade torrencial
    if ((rain >= 60 && rainSum >= 15) || rain >= 80 || rainSum >= 30) {
      return { tipo: 'tempestade', subTipo: 'convectiva', severidade: 5 };
    }

    // Prioridade 2: Vendaval costeiro
    if (wind >= 39 || f.vento?.nivel === 'perigo' || f.vento?.nivel === 'emergencia') {
      return { tipo: 'vendaval', subTipo: 'costeiro', severidade: 4 };
    }

    // Prioridade 3: Calor Extremo (WBGT >= 30 ou WBGT >= 28 com alta umidade/UV)
    if (wbgt >= 30 || (wbgt >= 28 && (hum >= 75 || uv >= 7)) || f.calor?.nivel === 'perigo' || f.calor?.nivel === 'emergencia') {
      const subTipo = (hum >= 70 || wbgt >= 32) ? 'mormaco' : 'actinico';
      return { tipo: 'calorExtremo', subTipo, severidade: 4 };
    }

    // Prioridade 4: Ar poluído / Seca
    if (aqi >= 45 || hum <= 38 || f.ar?.nivel === 'alerta' || f.ar?.nivel === 'perigo') {
      return { tipo: 'arSeca', subTipo: 'poluicao', severidade: 3 };
    }

    // Prioridade 5: Dia ameno / favorável
    return { tipo: 'diaAmeno', subTipo: 'estavel', severidade: 1 };
  }

  /**
   * Substitui placeholders {wbgt}, {umidade}, etc. pelos valores reais
   */
  function interpolateTemplate(template, factors) {
    if (typeof template !== 'string' || !template) return '';
    const f = factors || {};
    const isNum = (v) => typeof v === 'number' && !isNaN(v) && isFinite(v);
    const wbgtVal = (f.calor?.valor != null && isNum(f.calor.valor)) ? f.calor.valor.toFixed(1) : '26.0';
    const uvVal = (f.sol?.valor != null && isNum(f.sol.valor)) ? String(Math.round(f.sol.valor)) : '5';
    const windVal = (f.vento?.valor != null && isNum(f.vento.valor)) ? String(Math.round(f.vento.valor)) : '15';
    const humVal = (f.umidade?.valor != null && isNum(f.umidade.valor)) ? String(Math.round(f.umidade.valor)) : '65';
    const aqiVal = (f.ar?.valor != null && isNum(f.ar.valor)) ? String(Math.round(f.ar.valor)) : '25';
    const rainVal = (f.chuva?.valor != null && isNum(f.chuva.valor)) ? String(Math.round(f.chuva.valor)) : '10';
    const volVal = (f.chuva?.rainSum != null && isNum(f.chuva.rainSum)) ? String(Math.round(f.chuva.rainSum)) : '0';

    // Beaufort aproximado
    let bf = 2;
    const w = Number(windVal);
    if (w < 1) bf = 0;
    else if (w < 6) bf = 1;
    else if (w < 12) bf = 2;
    else if (w < 20) bf = 3;
    else if (w < 29) bf = 4;
    else if (w < 39) bf = 5;
    else if (w < 50) bf = 6;
    else if (w < 62) bf = 7;
    else if (w < 75) bf = 8;
    else bf = 9;

    return template
      .replace(/{wbgt}/g, wbgtVal)
      .replace(/{uv}/g, uvVal)
      .replace(/{vento}/g, windVal)
      .replace(/{bf}/g, String(bf))
      .replace(/{umidade}/g, humVal)
      .replace(/{aqi}/g, aqiVal)
      .replace(/{chuva}/g, rainVal)
      .replace(/{volume}/g, volVal);
  }

  /**
   * Motor combinatório de recomendações dinâmicas
   */
  function recomendacoes(fatoresCalculados, persona = 'geral', elnino = null, options = {}) {
    const validPersona = ['geral', 'pescador', 'agricultor'].includes(persona) ? persona : 'geral';
    const factors = normalizeFactors(fatoresCalculados);
    const cenario = avaliarCenario(factors);

    const recs = [];
    const usedTexts = new Set();

    const hasCycle = typeof options?.cycle === 'number' && Number.isFinite(options.cycle);
    const cycleNum = hasCycle ? Math.abs(Math.floor(options.cycle)) : null;

    // 1. Recomendação Primária (Cruzamento Combinatório do Cenário Predominante)
    const bank = PHRASE_BANKS[cenario.tipo]?.[cenario.subTipo]?.[validPersona];
    if (Array.isArray(bank) && bank.length > 0) {
      const rotKey = `${cenario.tipo}_${cenario.subTipo}_${validPersona}`;
      const idx = cycleNum != null
        ? cycleNum % bank.length
        : getRotationIndex(rotKey, bank.length);
      const rawText = bank[idx];
      const filledText = interpolateTemplate(rawText, factors);
      if (filledText) {
        recs.push(filledText);
        usedTexts.add(filledText);
      }
    }

    // 2. Recomendação Secundária (Fator Coadjuvante Crítico)
    let secondaryType = null;
    let secondarySub = null;

    if (cenario.tipo === 'calorExtremo') {
      if (cenario.subTipo === 'mormaco' && factors.sol.valor != null && factors.sol.valor >= 6) {
        secondaryType = 'calorExtremo';
        secondarySub = 'actinico';
      } else if (cenario.subTipo === 'actinico' && ((factors.umidade.valor != null && factors.umidade.valor >= 65) || (factors.calor.valor != null && factors.calor.valor >= 32))) {
        secondaryType = 'calorExtremo';
        secondarySub = 'mormaco';
      } else if (factors.vento.valor != null && factors.vento.valor >= 30) {
        secondaryType = 'vendaval';
        secondarySub = 'costeiro';
      } else if (factors.ar.valor != null && factors.ar.valor >= 45) {
        secondaryType = 'arSeca';
        secondarySub = 'poluicao';
      }
    } else if (cenario.tipo === 'vendaval') {
      if (factors.chuva?.valor != null && factors.chuva.valor >= 50) {
        secondaryType = 'tempestade';
        secondarySub = 'convectiva';
      } else if (factors.calor?.valor != null && factors.calor.valor >= 29) {
        secondaryType = 'calorExtremo';
        secondarySub = 'mormaco';
      }
    } else if (cenario.tipo === 'tempestade') {
      if (factors.vento?.valor != null && factors.vento.valor >= 30) {
        secondaryType = 'vendaval';
        secondarySub = 'costeiro';
      }
    } else if (cenario.tipo === 'arSeca') {
      if (factors.calor?.valor != null && factors.calor.valor >= 28) {
        secondaryType = 'calorExtremo';
        secondarySub = 'mormaco';
      }
    }

    if (secondaryType && secondarySub && PHRASE_BANKS[secondaryType]?.[secondarySub]?.[validPersona]) {
      const sBank = PHRASE_BANKS[secondaryType][secondarySub][validPersona];
      const sRotKey = `${secondaryType}_${secondarySub}_${validPersona}_sec`;
      const sIdx = cycleNum != null
        ? (cycleNum + 1) % sBank.length
        : getRotationIndex(sRotKey, sBank.length);
      const sRaw = sBank[sIdx];
      const sFilled = interpolateTemplate(sRaw, factors);
      if (sFilled && !usedTexts.has(sFilled)) {
        recs.push(sFilled);
        usedTexts.add(sFilled);
      }
    }

    // 3. Recomendação Operacional Complementar para o perfil com rotação anti-repetição
    if (recs.length < 2 && PHRASE_BANKS[cenario.tipo]?.[cenario.subTipo]?.[validPersona]) {
      const altBank = PHRASE_BANKS[cenario.tipo][cenario.subTipo][validPersona];
      const altRotKey = `${cenario.tipo}_${cenario.subTipo}_${validPersona}_alt`;
      const startIdx = cycleNum != null
        ? (cycleNum + 1) % altBank.length
        : getRotationIndex(altRotKey, altBank.length);

      for (let offset = 0; offset < altBank.length; offset++) {
        const i = (startIdx + offset) % altBank.length;
        const candidate = interpolateTemplate(altBank[i], factors);
        if (candidate && !usedTexts.has(candidate)) {
          recs.push(candidate);
          usedTexts.add(candidate);
          break;
        }
      }
    }

    // 4. Injeção de Contexto Telegráfico El Niño (quando ativo)
    if (elnino && elnino.ativo) {
      let anom = '';
      if (elnino.anomalia != null) {
        const anomVal = Number(elnino.anomalia);
        if (Number.isFinite(anomVal)) {
          anom = ` (${anomVal > 0 ? '+' : ''}${anomVal.toFixed(1)}°C)`;
        }
      }
      const elNinoPhrases = {
        geral: `🌍 El Niño oceânico ativo${anom}: favorece bloqueios atmosféricos de ar quente e aridez. Poupe água tratada e evite atividades extenuantes nas horas centrais.`,
        pescador: `🌍 Anomalia El Niño ativa${anom}: termoclina alterada e maior dispersão de cardumes pelágicos. Ajuste a profundidade de lançamento de redes.`,
        agricultor: `🌍 Modo El Niño em curso${anom}: taxa de evapotranspiração acelerada e irregularidade pluviométrica. Redobre a conservação de cobertura vegetal e manejo de água.`
      };
      const elNinoText = elNinoPhrases[validPersona] || elNinoPhrases.geral;
      if (!usedTexts.has(elNinoText)) {
        recs.push(elNinoText);
        usedTexts.add(elNinoText);
      }
    }

    // 5. Fallback seguro se nenhuma regra engatilhada
    if (!recs.length) {
      const fallbackList = PHRASE_BANKS.diaAmeno.estavel[validPersona] || PHRASE_BANKS.diaAmeno.estavel.geral;
      const fText = interpolateTemplate(fallbackList[0], factors);
      if (fText) recs.push(fText);
    }

    // Retorna no máximo 3 a 4 recomendações densas e sem qualquer repetição
    return recs.slice(0, 4);
  }

  return {
    recomendacoes,
    avaliarCenario,
    interpolateTemplate,
    pick,
    PHRASE_BANKS,
  };
});
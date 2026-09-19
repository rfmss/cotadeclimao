# Levantamento Técnico e Especificação Arquitetural: Requisito R1 (Motor de Dados e API Resiliente)

**Projeto:** Cota de Climão  
**Data:** 18/09/2026  
**Agente Responsável:** Data Engine Survey Explorer (`teamwork_preview_explorer_survey_1`)  
**Status da Investigação:** Concluído (Read-Only)  
**Documentos de Referência:** `ORIGINAL_REQUEST.md`, `CONVERSATION_LOG.md`, `README.md`

---

## 1. Sumário Executivo

O requisito **R1 (Motor de Dados e API Resiliente)** tem como meta principal refatorar a camada de consumo e persistência meteorológica do *Cota de Climão* para garantir:
1. **Fidelidade científica e tipagem estrita** na ingestão de parâmetros das APIs Open-Meteo.
2. **Resiliência contra oscilação de rede e variações de schema** da API (degradação graciosa).
3. **Persistência offline-first à prova de falhas**, garantindo que o dashboard renderize o último estado válido em cache sem emitir erros no console.
4. **Validação automatizada ponta a ponta** por meio de `test_api_fallback.js`.

A presente investigação analisou 100% dos arquivos da camada de dados (`js/api.js`, `js/storage.js`, `js/app.js`, `js/calculations.js`, `js/factors.js`, `js/risk.js`, `sw.js` e `index.html`) e mapeou as vulnerabilidades críticas que impedem o cumprimento dos critérios de aceitação no estado atual, definindo a especificação técnica para a implementação de R1.

---

## 2. Diagnóstico da Camada Atual

### 2.1 Consumo de API e Redes (`js/api.js`)

#### Endpoints Consumidos
- **Previsão Principal (Forecast):**  
  `https://api.open-meteo.com/v1/forecast`  
  Coordenadas: Regência, Linhares-ES (`lat: -19.52`, `lon: -39.78`), `timezone: America/Sao_Paulo`, `forecast_days: 16`.
- **Qualidade do Ar (Air Quality):**  
  `https://air-quality-api.open-meteo.com/v1/air-quality`  
  Poluentes: `pm10, pm2_5, nitrogen_dioxide, ozone, sulphur_dioxide, carbon_monoxide, uv_index, european_aqi, us_aqi`.
- **Marinho (Marine):**  
  `https://marine-api.open-meteo.com/v1/marine`  
  Parâmetros: `wave_height, wave_direction, wave_period, ocean_current_velocity, sea_surface_temperature`.

#### Vulnerabilidades Críticas Identificadas em `js/api.js` e `js/app.js`

1. **Falha em Cascata por `Promise.all` Rígido (`js/app.js:354-359`):**
   ```javascript
   const [f, aq, marine, enino] = await Promise.all([
     window.ClimAPI.fetchForecast(),
     window.ClimAPI.fetchAirQuality(),
     window.ClimAPI.fetchMarine(),
     window.ClimAPI.fetchElNino(),
   ]);
   ```
   *Problema:* Se a API Marine ou Air Quality estiver fora do ar ou lenta, **todo o carregamento falha**, ignorando a Previsão Principal (que responde por 85% dos fatores vitais: Calor, Sol, Vento, Umidade e Chuva).
2. **Duplicação de Tráfego de Rede (`js/api.js:96`):**
   *Problema:* A função `fetchElNino()` invoca internamente `fetchMarine()` novamente para extrair a temperatura da superfície do mar, duplicando requisições que já estão sendo feitas concorrentemente em `app.js`.
3. **Backoff Excessivo e Bloqueante (`js/api.js:19-20, 63-78`):**
   *Problema:* O array de retries é `[1000, 2000, 4000, 8000]` com timeout de `15000ms` (15s) por tentativa. Quando a internet oscila ou a API está inativa, o usuário aguarda mais de **60 a 90 segundos** antes do app desistir e tentar usar o cache, criando uma péssima experiência de tela em carregamento.
4. **Ausência de Sanitização e Validação de Resposta:**
   *Problema:* O retorno de `fetchWithRetry` assume que `res.json()` sempre retorna o formato esperado. Se a Open-Meteo devolver um erro 200 com payload `{ error: true, reason: "..." }` ou se um campo for renomeado/nulo, o código quebra com `TypeError` sem tratamento.

---

### 2.2 Transformação e Tratamento de Dados (`js/app.js` e `js/calculations.js`)

1. **Armadilha do Índice de Data (`js/app.js:30-31`):**
   ```javascript
   const hoy = HOJE();
   const idx = daily.time.indexOf(hoy);
   ```
   *Problema:* Se houver divergência entre o fuso horário local e o timestamp da API, ou na virada da meia-noite, `idx` torna-se `-1`. Ao acessar `daily.temperature_2m_max[-1]`, o valor é `undefined`. Em `maps.wbgt`, a expressão `maps.temperature - 2` resulta em `NaN`.
2. **Incoerência de Parâmetro Solicitado vs. Acessado (`js/app.js:47` vs `js/api.js:37-40`):**
   *Problema:* `app.js` tenta ler `daily.relative_humidity_2m_max[idx]`. No entanto, esse parâmetro **nunca é solicitado** na URL do `forecast` montada em `js/api.js`. Cai silenciosamente no fallback horário.
3. **Bug Aritmético na Fórmula do WBGT (`js/calculations.js:27`):**
   ```javascript
   const GT = T + (R > 0 ? Math.min(18, R / 60 * (1 - 0.5 * Math.min(cloudCover, 1) * 0)) : 0) + ...
   ```
   *Problema:* O termo `* 0` no final anula completamente a atenuação da cobertura de nuvens (`cloudCover`), tornando o cálculo insensível à nebulosidade.
4. **Risco Crítico no Fallback de Dados Nulos (`js/app.js:107`, `js/risk.js:27`):**
   *Problema:* Quando um dado meteorológico falha ou retorna `null`, o fator é categorizado como `nivel: 'bom', rotulo: 'Sem dados'`. Em `risk.js`, `bom` pontua 10 pontos (baixo risco). **Isso mascara perigo real:** se o sensor de calor ou vento falhar em um dia de tempestade/onda de calor, o app reduz o score de Preocupação, transmitindo falsa segurança.

---

### 2.3 Persistência e Fallback de Cache (`js/storage.js` e `js/app.js`)

1. **Chave Rígida por Data Única (`js/app.js:350, 367-378`):**
   ```javascript
   const cachedRaw = await window.ClimStorage.loadWeatherDay(HOJE());
   ```
   *Problema:* O cache busca estritamente pela chave `HOJE()` (`regencia-YYYY-MM-DD`). Se o usuário acessou o app ontem com conexão (quando foram baixados 16 dias de previsão!) e abre o app hoje offline, `loadWeatherDay(HOJE())` retorna `null`. O app exibe o erro fatal:
   > *"SEM CONEXÃO E SEM REGISTRO — ABRA O APP ONLINE AO MENOS UMA VEZ"*  
   Isso descumpre diretamente o critério de aceitação de resiliência offline!
2. **Ausência de Camada de Fallback Secundária (`localStorage`):**
   *Problema:* Se o IndexedDB for bloqueado (janela anônima de certos navegadores, storage corrompido, permissão negada), não há contingência em `localStorage` ou memória. O app quebra na inicialização.
3. **Gravação Dupla Redundante (`js/app.js:365` e `381`):**
   *Problema:* `saveWeatherDay` é chamado duas vezes em sequência no fluxo de sucesso: a primeira antes de calcular `maps` (salvando `maps: null`), e a segunda logo em seguida.

---

### 2.4 Infraestrutura de Testes e Automação

1. **Estado Atual:** Não existe nenhum arquivo de teste automatizado (`test_api_fallback.js` não existe).
2. **Ambiente Verificado no Sistema:**
   - Node.js `v22.22.2` e npm `10.9.7` operacionais.
   - Chromium instalado no sistema em `/usr/bin/chromium`.
   - Playwright disponível no cache do npx em `/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules/playwright`.
   - Testes e2e e validação headless com interceptação de rede e captura de logs do console são 100% viáveis sem necessidade de instalar dependências pesadas adicionais.

---

## 3. Matriz de Requisitos Detalhada para R1

| ID | Requisito Técnico | Detalhes de Implementação | Arquivos Afetados |
|---|---|---|---|
| **R1.1** | **Camada de Tipos e Esquemas Rígidos** | Criação de contratos de dados (JSDoc `@typedef` + validadores de schema defensivos em runtime) para: Previsão Bruta, Dados Normalizados (`NormalizedWeatherData`), 6 Cotas (`FactorResult`), Score de Risco (`RiskCalculation`) e Envelope de Cache (`CacheEnvelope`). Validação rigorosa de tipos com coerção e limites físicos seguros (ex: temp entre -20°C e 55°C, umidade 0-100%, vento >= 0). | `js/schema.js` (ou `js/types.js`), `js/api.js` |
| **R1.2** | **Consumo de API Resiliente com Degradação Graciosa** | Substituir `Promise.all` por `Promise.allSettled`. Isolar Forecast (primário) de Air Quality e Marine (secundários). Se Air Quality falhar, renderizar fatores meteorológicos com indicação clara no card de Ar ("Qualidade do ar indisponível"). Eliminar requisição duplicada de Marine no El Niño. Reduzir timeouts (5s) e retries inteligentes (máx 2) para falha rápida caso offline. | `js/api.js`, `js/app.js` |
| **R1.3** | **Motor de Cache Multi-Nível (Snapshot + Histórico + LocalStorage)** | Reformular `storage.js`: 1) Salvar sempre um ponteiro `latest` com o último snapshot completo; 2) Se `loadWeatherDay(hoje)` for nulo, buscar `latest` e tentar extrair a projeção para o dia atual a partir dos 16 dias em cache; 3) Fallback transparente para `localStorage` caso IndexedDB falhe ou esteja indisponível; 4) Banner informativo de modo offline com carimbo de data legível. | `js/storage.js`, `js/app.js` |
| **R1.4** | **Tratamento Seguro de Dados Faltantes** | Fatores sem dados não devem assumir automaticamente nível 'bom' (risco mascarado). Devem possuir estado explícito `indisponivel` que não distorça o cálculo ponderado da Preocupação (redistribuição proporcional de pesos entre fatores disponíveis). Correção do cálculo do WBGT (remoção do bug `* 0` no cloud cover). | `js/calculations.js`, `js/factors.js`, `js/risk.js` |
| **R1.5** | **Script Automatizado `test_api_fallback.js`** | Script executável via Node.js que: 1) Inicia servidor local ou carrega dashboard; 2) Preenche cache com estado meteorológico válido; 3) Simula falha total de rede/API via bloqueio de requisições `open-meteo.com`; 4) Recarrega o dashboard; 5) Monitora eventos de console (`console.error`, `pageerror`); 6) Verifica renderização do último estado em cache (score, 6 cotas e banner); 7) Retorna código 0 se aprovado e sem erros no console. | `test_api_fallback.js` |

---

## 4. Arquitetura Proposta para a Camada de Dados (R1)

```
                       ┌───────────────────────────────┐
                       │       ClimAPI (api.js)        │
                       │   fetchWithResilience()       │
                       │   (Timeout 5s, 2 Retries)     │
                       └───────────────┬───────────────┘
                                       │
                      Promise.allSettled() [Forecast, AQ, Marine]
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │     Data Normalizer & Schema  │
                       │   (Safe bounds, parse, types) │
                       └───────────────┬───────────────┘
                                       │
                     Sucesso parcial   │   Falha de rede total
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
          ┌─────────────────────┐             ┌─────────────────────┐
          │   Atualiza Cache    │             │  Carrega Fallback   │
          │  (IndexedDB + LS)   │             │   Latest Snapshot   │
          │  Snapshot 'latest'  │             │ (Multi-day search)  │
          └──────────┬──────────┘             └──────────┬──────────┘
                     │                                   │
                     └─────────────────┬─────────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │     NormalizedWeatherData     │
                       │     (Strict Domain Model)     │
                       └───────────────┬───────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │ Calculations & Factors Engine │
                       │    (WBGT, Beaufort, AQI,      │
                       │     Preocupação ponderada)    │
                       └───────────────┬───────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │      UI Render (Zero Erros)   │
                       │  Online / Banner Offline      │
                       └───────────────────────────────┘
```

---

## 5. Especificação do `test_api_fallback.js`

O script de teste deve seguir a seguinte estrutura de teste automatizado:
1. **Runner:** Node.js script utilizando Playwright (`require('playwright')` com suporte a `NODE_PATH` identificado).
2. **Servidor Local:** Servir os arquivos estáticos via `http.createServer` nativo do Node.js em porta dinâmica livre.
3. **Cenário de Teste:**
   - **Fase 1 (Armazenamento Inicial):** Abre o navegador em modo online (ou injeta um snapshot mock no IndexedDB via script de contexto), aguarda persistência completa e valida que `localStorage` / `IndexedDB` possui os registros.
   - **Fase 2 (Simulação de Apagão de API):**
     Configura interceptação de rota:
     `await page.route('**/*open-meteo.com/**', route => route.abort('failed'));`
     Interrompe qualquer tráfego externo.
   - **Fase 3 (Verificação do Fallback):**
     Navega novamente para a página inicial com reload forçado.
     Registra todos os logs de console:
     ```javascript
     const errors = [];
     page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
     page.on('pageerror', err => errors.push(err.message));
     ```
   - **Fase 4 (Asserções):**
     - O container `#app-main` atinge `data-state="ready"`.
     - O banner `#conn-banner` está visível e contém texto com "DADOS DE ...".
     - O display de risco (`#fake-score`) exibe valor numérico válido diferente de "00" ou nulo.
     - A lista `#factor-list` contém 6 cards `.factor` renderizados.
     - O array `errors` tem comprimento zero (`errors.length === 0`).
4. **Resultado:** Saída detalhada com relatório no terminal e saída de processo `process.exit(0)` em caso de sucesso ou `process.exit(1)` com logs em caso de falha.

---

## 6. Riscos e Recomendações para a Fase de Execução

1. **Risco de Quebra na UI Existente:**
   - *Mitigação:* Manter a interface pública dos módulos (`window.ClimAPI`, `window.ClimStorage`, `window.ClimCalc`) compatível com `app.js` e as tags do DOM existentes (`#d1`, `#d2`, `#fake-score`, `#traffic-card`, `#factor-list`).
2. **Dependência de Fontes Externas e CDNs:**
   - *Mitigação:* `index.html` referencia `fonts.googleapis.com` e `unpkg.com/@phosphor-icons`. Para garantir robustez 100% offline sem warnings de rede, usar fontes de sistema seguras e ícones SVG embutidos (já presentes em `factors.js`).
3. **Isolamento de Teste em CI/Local:**
   - *Mitigação:* Configurar `test_api_fallback.js` para usar Chromium do sistema (`/usr/bin/chromium`) ou Playwright do cache sem requisições adicionais de instalação de pacotes.

---

*Levantamento concluído e documentado para prosseguimento do planejamento e execução do Requisito R1.*

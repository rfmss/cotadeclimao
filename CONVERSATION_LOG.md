# 📜 CONVERSATION_LOG — Cota do Climão

> Registro automático de todas as decisões, pesquisas e benchmarks do projeto.
> Última atualização: 16/09/2026

---

## 🗂️ SUMÁRIO

| # | Data | Tópico | Status |
|---|------|--------|--------|
| 1 | 16/09 | Conceito do app (blood test) | ✅ Fechado |
| 2 | 16/09 | Fontes de dados (Open-Meteo, NASA, INMET) | ✅ Fechado |
| 3 | 16/09 | Revisão sênior (6 especialistas) | ✅ Fechado |
| 4 | 16/09 | Limites científicos (NIOSH, WHO, OSHA, Beaufort) | ✅ Fechado |
| 5 | 16/09 | Nome do produto: "Cota do Climão" | ✅ Fechado |
| 6 | 16/09 | Arquitetura offline (SWR + IndexedDB) | ✅ Fechado |
| 7 | 16/09 | El Niño 2026/2027 + aquecimento global | ✅ Fechado |
| 8 | 16/09 | Benchmark de mercado (30+ apps) | ✅ Fechado |
| 9 | 16/09 | Implementação MVP aprovada | ✅ Em andamento |
| 10 | 16/09 | Redesign E-Ink Papel Técnico (escrevaral) | ✅ Fechado |

---

## 🤖 CONVERSA 1 — CONCEITO DO APP

### Problema
Ninguém em Regência, Linhares-ES, consegue entender se o clima de hoje é seguro para sair de casa, trabalhar na praia, pescar, ou mandar os filhos para a escola ao ar livre.

### Solução Proposta
App PWA "Cota do Climão" que mostra limites seguros de exposição para 6 fatores climáticos:
1. 🌡️ Calor (WBGT)
2. ☀️ Sol (UV Index)
3. 💨 Vento (Beaufort)
4. 💦 Umidade (Bulbo Úmido)
5. 🌬️ Ar (AQI WHO 2021)
6. 🌧️ Chuva (probabilidade e intensidade)

**Visual:** Metáfora de exame de sangue — cada fator tem valor ideal vs valor atual, com barras comparativas.

### Conceito de "Cota"
- **"Cota"** = quota/limite que o clima concede ou retira cada dia
- NÃO é um app de consumo — não rastreia o usuário
- O clima CONCEDE condições; o usuário decide como usar
- Linguagem variada: "liberada", "suspensa", "estourada", "o clima concede", "não vem hoje"

### Decisão: Preocupação (score agregado 0-100)
| Fator | Peso |
|-------|------|
| 🌡️ Calor (WBGT) | 35% |
| ☀️ Sol (UV) | 15% |
| 💦 Umidade (WB) | 15% |
| 🌬️ Ar (AQI) | 15% |
| 💨 Vento (Beaufort) | 10% |
| 🌧️ Chuva | 10% |

---

## 📡 CONVERSA 2 — FONTES DE DADOS

| Fonte | Papel | Auth | Custo |
|-------|-------|------|-------|
| Open-Meteo Forecast API | Primária: temp, umidade, vento, radiação, WB, 16 dias | Nenhuma | Grátis |
| Open-Meteo Air Quality API | Primária: PM2.5, PM10, NO₂, O₃, SO₂, CO, UV | Nenhuma (comercial precisa key) | Grátis |
| Open-Meteo Marine API | Primária: ondas, correntes | Nenhuma | Grátis |
| NASA POWER | Validação: radiação solar histórica | Nenhuma | Grátis |
| INMET | Validação local BR (não-dependência crítica) | Publica | Grátis |

### Endpoints Finais
```
Forecast: https://api.open-meteo.com/v1/forecast?latitude=-19.52&longitude=-39.78&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index,shortwave_radiation&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=America/Sao_Paulo&forecast_days=16

AQ: https://air-quality-api.open-meteo.com/v1/air-quality?latitude=-19.52&longitude=-39.78&hourly=pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,uv_index,european_aqi,us_aqi&timezone=America/Sao_Paulo

Marine: https://marine-api.open-meteo.com/v1/marine?latitude=-19.52&longitude=-39.78&hourly=wave_height,wave_direction,wave_period,ocean_current_velocity&daily=wave_height_max,wave_direction_dominant,wave_period_max&timezone=America/Sao_Paulo
```

---

## 👨‍⚕️ CONVERSA 3 — REVISÃO SÊNIOR (6 ESPECIALISTAS)

### 1. Climatologista Dr. Marcondes
- **Crítica:** "Sempre que falam de previsão de 10-15 dias, a confiabilidade cai."
- **Decisão:** Exibir meta-título "Previsão de longo prazo (menos confiável)" e usar técnica de **doy (day of year) reference** para confiabilidade contextual.
- **Decisão:** Mostrar mediana do bloco de 16 dias (não média) — robusta a outliers.

### 2. UX Designer Marina
- **Crítica:** "Todo mundo mostra SEM os dados. Mas o usuário não aguenta SPAM de números"
- **Decisão:** 2 níveis de detalhe: resumo (3 torneiras/cores) → expandir mês.
- **Decisão:** Séries temporais: sanidade de 3 dias mínimo para DDA (Recommended Stoppage).
- **Decisão:** Humanize traduções (ex: "Dá pra se virar, mas de boné e água").

### 3. Data Architect Sergio
- **Crítica:** "Cache-First de dados meteorológicos pode ser perigoso: pode mostrar dados velhos de ondas/calor para pescador."
- **Decisão:** **Stale-While-Revalidate**: mostra cache imediatamente + revalida em segundo plano.
- **Decisão:** IndexedDB com schema versioning (v1, v2, v3...).

### 4. Médico Dr. Carvalho
- **Decisão:** WBGT outdoor (ISO 7933) é padrão-ouro — deve ser o cálculo principal.
- **Decisão:** Níveis de ação: 0,5h intervalos para trabalhadores expostos.
- **Decisão:** Incluir máxima permissível (OSHA) quando exceder limites — não só dados meteorológicos.
- **Decisão:** UF extreme index gate: se UF >0.3 → red / high (significa risco de falha térmica).

### 5. Frontend Engineer Lígia
- **Decisão:** Service Worker + Cache API para shell (HTML/CSS/JS/icons).
- **Decisão:** IndexedDB para dados (schema, dates, medians, metadata).
- **Decisão:** aria-live pages para mudanças futuras.
- **Decisão:** Progressively-enhanced offline mode.

### 6. Environmental Scientist Ana Paula
- **Decisão:** As cotas DEVEM dizer o que o clima concede/retira — não o que o usuário consome.

### Networking Decision: ENOS (El Niño/La Niña Telegráfico)
- Fechado: Índice ENSO (ONI) é calculado via NOAA. Severidade em 4 fases: neutro, El Niño fraco/moderado/fraco-forte.
- O app usará esse índice para destacar os **riscos locais de cada fase**:
  - El Niño: seca, calor extremo, incêndios
  - La Niña: chuvas intensas, cheias

---

## 🔬 CONVERSA 4 — LIMITES CIENTÍFICOS

### WBGT (NIOSH 2016)
| Carga de trabalho | Aclimatado | Não aclimatado |
|-------------------|-----------|----------------|
| Leve | <30°C | <28°C |
| Moderada | <28°C | <25°C |
| Pesada | <26°C | <23°C |

### Bulbo Úmido (WB)
| Valor | Estado |
|-------|--------|
| <25°C | Confortável |
| 25-27.8°C | Cuidado |
| 27.8-29°C | Alerta |
| 29-31°C | Perigo |
| >31°C | Emergência |

### UV Index (WHO/EPA)
| Índice | Categoria | Tempo seguro aprox |
|--------|-----------|-------------------|
| 0-2 | Baixo | — |
| 3-5 | Moderado | ~40 min |
| 6-7 | Alto | ~20 min |
| 8-10 | Muito alto | ~10 min |
| 11+ | Extremo | Evitar |

### Vento (Beaufort)
| Nível | Velocidade | Risco |
|-------|-----------|-------|
| 0-3 | <19 km/h | Seguro |
| 4-5 | 20-38 km/h | Cautela |
| 6 | 29-38 km/h (na escala, Beufort 6 é 39-49 km/h) | Pequenas embarcações em risco |
| 7 | 50-61 km/h | Atenção |
| 8+ | 62+ km/h | Perigo |

### AQI (WHO 2021)
| Poluente | Limite 24h | Limite 8h |
|----------|-----------|-----------|
| PM2.5 | 15 µg/m³ | — |
| PM10 | 45 µg/m³ | — |
| O₃ | 100 µg/m³ | — |
| NO₂ | 25 µg/m³ | — |

### Chuva
| Probabilidade | Impacto |
|---------------|---------|
| <30% | Sem impacto |
| 30-60% | Leve |
| 60-80% | Moderada |
| 80-100% | Pesada |
| >50mm | Risco de alagamento |

---

## 📛 CONVERSA 5 — NOME DO PRODUTO

### Candidatos avaliados
1. **Cota do Climão** — aprovado ✅
2. Cota da Natureza
3. Cota do Tempo
4. Janela do Clima
5. Boleta de Clima
6. Vida no Clima
7. Cota Piau — um ("Piau" é peixe e "piaú"?), pantanal local
8. Cota do Rio Doce
9. Cota da Costa
10. Pressão Alta (clínica)
11. Clima & Companhia

### Vencedor: **"Cota do Climão"**
- Direto, preciso
- "Climão" = coloquial brasileiro ("hoje está um climão!")
- Combina clima + alerta + tensão
- Memorável, autêntico BR

### Conceito de Cota Reforçado
- Não é consumo → é **concessão do clima**
- O clima GRANT/retira condições; o usuário gerencia seu próprio uso

---

## 💾 CONVERSA 6 — ARQUITETURA OFFLINE

### Estratégia: Stale-While-Revalidate
1. App inicia → busca dados API → armazena no IndexedDB
2. Offline → mostra cache (com banner de dados antigos)
3. Online → revalida em background

### Configurações
- Retry: exponential backoff 1s → 2s → 4s → 8s → fallback cache
- IndexedDB schema v1 (versionado para futuras migrações)
- Banner offline: "⚠️ Dados de [data/hora] — Conecte-se para atualizar"

### Service Worker
- `skipWaiting()` + `clients.claim()` para ativação imediata
- Cache shell: HTML/CSS/JS/icons
- Cache dados: via IndexedDB (não Cache API)

---

## 🌍 CONVERSA 7 — EL NIÑO 2026/2027 + AQUECIMENTO

### Contexto (16 Set 2026)
- El Niño confirmado em junho/2026 (CPTEC/INPE 100%)
- Probabilidade de intensidade **muito forte**: 81-90% (CPC/NOAA)
- Chance de ser o **maior desde 1950**: 69%
- Pico: **Out-Dez 2026**
- Duração: até **mar/abr 2027**
- 100% do ES em **seca fraca** (ANA Monitor de Secas)
- **197 focos de calor** em julho no ES; **Linhares: 2º município** (13 focos) — INPE

### Impactos em Regência (ES)
1. **Onda de calor prolongada** — temperaturas acima da média; WBGT >32°C
2. **Seca crônica** — chuva irregular, poucos episódios intensos, sem recarga hídrica
3. **Incêndios florestais** — pico Ago-Out; Linhares/Regência em área de risco
4. **AQ degradada** — fumaça de queimadas eleva PM2.5/PM10
5. **Tempestades isoladas intensas** — enxurradas + rajadas >60 km/h

### Projeções WBGT Brasil
| Cenário | Exposição |
|---------|-----------|
| Atual (1.3°C) | 89% da área: WBGT >30°C em alguma época |
| +2°C | 76% da área, 78M pessoas: WBGT >32°C |
| +3°C | 88% da área; **toda população do ES** exposta a WBGT >32°C |
| +4°C | 218M brasileiros |

### Decisão: Adições
1. 🔥 Cota de Indicadores: **Queimadas** (PM2.5 + focos) — Alta prioridade
2. 💧 Cota de Indicadores: **Seca** (precipitação 30d vs histórico + umidade do solo) — Alta
3. 📈 **Stress Térmico Acumulado** (7 dias de histórico WBGT) — Alta
4. 🌊 Cota do Mar (temp. mar, ondas) — Média
5. 🌍 **Painel El Niño** (automático quando TSM >0.5°C) — Alta
6. ⚙️ **Modo Verão El Niño** (pesos ajustados automaticamente) — Média

### Decisões Finais
- Queimadas/Seca/Stress: **indicadores extras** (não cotas principais), exibidos quando condições warrantam
- Painel El Niño: **automático** quando ativo, seção colapsável
- Projeções futuras: **fora do MVP** (aba futura)

---

## 🏆 CONVERSA 8 — BENCHMARK DE MERCADO

### Metodologia
- Pesquisa web: 10 categorias × 3 consultas = 30+ apps analisados
- Matriz de feature × concorrente
- Análise SWOT

### Resultado: Top 5 Concorrentes
1. **Climatempo** (BR) — #1 BR, módulo saúde (UV, alergia, gripe), MAS sem WBGT
2. **AIHA Heat Stress v2** — WBGT real 5d, MAS sem AQI/UV/UX/persona
3. **ClimApp** (Lund) — WBGT personalizado, MAS técnico, sem impacto BR
4. **Windy.com** — todos os dados, MAS zero recomendações de saúde
5. **INMET** — oficial BR, MAS sem saúde, UX básica

### Whitespace Confirmado
> **ÚNICO app que combina WBGT (ISO 7933) + AQI (WHO 2021) + UV + Beaufort + WB + Chuva, em score unificado (Preocupação), com blood test visual, linguagem acessível, PWA offline, persona (pescador/agricultor/geral), foco Regência-BR, monitorando El Niño.**

### Gaps que não cobrimos (riscos)
| Gap | Mitigação |
|-----|-----------|
| PWA sem push notification | Web Push via SW (futuro) |
| WBGT estimado (não medido) | Modelo ISO 7933 (confiável p/ estimativa) |
| Sem integração Defesa Civil | Link INMET Avisos |
| Dados marinhos extras | Open-Meteo Marine API |

### Conclusão Deliberada
**Não estamos reinventando a roda.** Estamos construindo 7 combinações de features que nenhum app existente tem. O mercado brasileiro não tem nenhum app de risco térmico para o público geral.

---

## 🚀 CONVERSA 9 — IMPLEMENTAÇÃO APROVADA

### Estrutura Final
```
TORTADECLIMAO/
├── index.html
├── manifest.json
├── sw.js
├── CONVERSATION_LOG.md
├── README.md
├── css/style.css
├── js/{app,api,storage,calculations,risk,recommendations,factors}.js
├── icons/
└── assets/
```

### Fluxo de Dados
App → Fetch (retry/backoff) → Open-Meteo (Forecast+AQ+Marine) → Validação schema → Cálculos (WBGT/AQI/Beaufort/WB) → Preocupação → Render blood test → IndexedDB

### Endereço piloto
**Regência, Linhares - ES** — -19.52°S, -39.78°W

---

## 🎨 CONVERSA 10 — REDESIGN: PAPEL TÉCNICO E-INK (ESCREVARAL)

### Contexto
O usuário rejeitou o visual flat/SaaS do MVP ("achei flat, chato com cara de saas"). Adotado o sistema de design **E-Ink & Papel Técnico** inspirado nas referências do estúdio escrevaral (`/home/rafamass/Área de trabalho/APAGARvouusar/escrevaral-studio(1)/public/`).

### Sistema de design aprovado
- **Papel:** sage reciclado `#CCD5C7`, `#c4cfc2`, `#d8e4d6`, `#f2f7ef`; tinta `#1E2320`/`#161917`
- **Fontes:** Anton (display), Oswald (labels técnicos caps), Literata (corpo/serifa)
- **Elementos:** bordas tracejadas, marcas de registro "+", código de barras no rodapé, selos/carimbos, badges de status ("MODO: MEDIÇÃO ATIVA")
- **Relógio split-flap mecânico** para o score Preocupação (CSS flip + som de clack via WebAudio)
- **Dark mode:** variantes "e-ink noturno" via `prefers-color-scheme`
- **Cotas:** réguas de medição com trilho, ticks, marcador "ideal" tracejado e agulha por nível; ícones SVG stroke (sem emojis); personas como botões de texto (MORADOR/PESCADOR/AGRICULTOR)

### Correções feitas no redesign
1. `aqiIndex` esperava array de horas, mas Open-Meteo devolve objeto de arrays paralelos → normalização + pico do dia por poluente (bug: "Ar — Sem dados")
2. Cota Chuva exibia unidade errada "mm" para probabilidade → `%`
3. Teste Playwright usava seletor `#d1 span.static-top` inválido → `#d1 .static-top span`
4. `sw.js` cache bump `cota-v1` → `cota-v2`; `manifest.json` cores → paleta sage

### Teste final (16/09)
Score **48** "Preocupação média — fique atento"; 6 cotas renderizando (Calor 25.8°C, Sol 7.3, Vento 20km/h BF3, Umidade 99%, **Ar 48 (Ar pesado)**, Chuva 100%); El Niño panel; zero erros JS. Screenshots: `screenshot-teste.png`, `screenshot-dark.png`, `screenshot-desktop.png`.

---

## 📝 NOTAS DE IMPLEMENTAÇÃO

### Personas suportadas
- 🎣 Pescador (marine + vento + ondas)
- 🌾 Agricultor (solo + seca + chuva)
- 🏠 Morador geral (health + lazer)

### Tipografia/Linguagem
- Evitar repetição de "cota" — usar alternativas: liberada, suspensa, estourada, concede, não vem hoje
- Tom: acessível, não técnico, brasileiro autêntico

### WCAG AA
- Ícones + cor + texto (daltonismo)
- Contraste verificável
- aria-live para mudanças futuras

### Pesos Preocupação (normal)
Calor 35% · Sol 15% · Umidade 15% · Ar 15% · Vento 10% · Chuva 10%

### Pesos Preocupação (modo El Niño)
Calor 40% · Sol 15% · Umidade 10% · Ar 20% · Vento 5% · Chuva 10%
(+ Queimadas/Seca como indicadores destacados)

---

*Este log é atualizado a cada conversa e commit. Última revisão: 16/09/2026.*
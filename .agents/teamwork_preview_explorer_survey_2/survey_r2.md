# Survey R2: Matriz Combinatória de Microcopy & Perfis Extremos

> **Status:** Concluído  
> **Data:** 18/09/2026  
> **Autor:** Microcopy Matrix Survey Explorer (survey_2)  
> **Diretório:** `.agents/teamwork_preview_explorer_survey_2/`  
> **Alvo:** Requisito R2 de `ORIGINAL_REQUEST.md` (Matriz Combinatória de Microcopy, Rigor Técnico, Perfis Extremos e `test_matrix.js`)

---

## 1. Sumário Executivo

O objetivo desta investigação foi auditar profundamente o sistema atual de geração de textos, microcopy, recomendações meteorológicas e limiares de condição no projeto **Cota de Climão**, projetando a arquitetura completa para atender ao **Requisito R2: Matriz Combinatória de Microcopy** e seu critério de aceitação correlato: **a validação automatizada de 5 perfis climáticos extremos via `test_matrix.js` com frases únicas, tecnicamente corretas e sem repetição**.

### Principais Conclusões da Auditoria:
1. **Ausência Total de Análise Combinatória:** O módulo atual (`js/recommendations.js`) avalia fatores de forma estritamente isolada e linear (ex: calor sozinho, vento sozinho). Não existe cruzamento multidimensional (ex: Temperatura + Vento + Persona).
2. **Negligência de Personas:** Embora a interface e `factors.js` prevejam 3 personas (`geral`/MORADOR, `pescador`/PESCADOR, `agricultor`/AGRICULTOR), o código de recomendações possui **zero linhas** dedicadas ao Agricultor e apenas **uma linha** simplória para o Pescador. O agricultor recebe exatamente as mesmas frases genéricas do morador urbano.
3. **Risco de Repetição e Não-Determinismo:** A seleção de frases apoia-se em `Math.random()` dentro de listas com pouquíssimas opções (às vezes 1 única frase fixa), gerando repetições e impossibilitando testes determinísticos.
4. **Falta de Rigor Técnico:** O microcopy existente recorre a coloquialismos rasos ("ar pesado", "ar seco", "cuidado com galhos") sem explicar os mecanismos fisiológicos, biofísicos e agronômicos (estresse de bulbo úmido, troca térmica convectiva, saturação alveolar por PM2.5, déficit de pressão de vapor foliar, arrebentação em bancos de areia na barra).
5. **Incompatibilidade com Node.js:** Os arquivos JS atuais são IIFEs amarradas exclusivamente ao objeto global `window`. A execução via Node.js (`node test_matrix.js`) falha com `ReferenceError: window is not defined`. É imperativo adotar exportação isomórfica (UMD).

---

## 2. Levantamento do Estado Atual da Base de Código

### 2.1 Arquivos e Funções Envolvidos na Geração de Microcopy

| Arquivo | Localização / Função | Papel Atual | Problemas / Lacunas Identificadas |
|---|---|---|---|
| `js/recommendations.js` | `recomendacoes(fatoresCalculados, persona, elnino)` | Motor principal de recomendações exibido em `#rec-list` ("O QUE FAZER") | - Avaliação linear sequencial (sem matriz combinatória).<br>- Ignora persona `agricultor`.<br>- Ignora dados de ondas/mar, rajadas e radiação solar.<br>- `pick()` usa `Math.random()`. |
| `js/app.js` | `render()` (linhas 235–254) | Gera `microText` estático/inline para cada cartão das 6 cotas | - Textos gerados inline no meio do render.<br>- Variação quase nula.<br>- Desacoplado do motor de recomendações. |
| `js/app.js` | `renderStress()`, `renderIndicadores()`, `marBox` (linhas 287–344) | Exibe banners de estresse acumulado, seca, queimadas e mar | - Lógica dispersa em métodos auxiliares isolados.<br>- Bug na troca de personas: ao clicar em persona (linha 398), passa `null` para El Niño, sumindo com o alerta. |
| `index.html` | Script inline (linhas 91–151) | `MutationObserver` em `#d1`/`#d2` que injeta texto em `#quick-tips` | - Lógica duplicada de semáforo de risco fora dos módulos JS.<br>- Frases estáticas engessadas por faixa de score (0-20, 20-40, 40-60, 60-80, 80-100). |
| `js/factors.js` | `FACTORS` e `PERSONAS` | Definição dos limiares de nível (`bom`, `atencao`, `alerta`, `perigo`, `emergencia`) e personas | - Personas são apenas `{ id, nome, descricao }` sem matriz de afinidade ou pesos específicos de risco. |
| `js/calculations.js` | `ClimCalc` (WBGT, AQI, Beaufort, Bulbo Úmido, UV, Chuva) | Fórmulas científicas (ISO 7933, WHO 2021, OMM) | - Excelente embasamento técnico nos cálculos, mas os resultados não são aproveitados qualitativamente pelo gerador de frases. |
| `js/risk.js` | `ClimRisk.calcular` | Score de Preocupação (0 a 100) e rótulos | - Apenas 5 rótulos de uma linha associados à faixa de risco agregado. |

### 2.2 Análise do Fluxo de Dados e Variáveis Disponíveis

Atualmente, `app.js` constrói o objeto `maps` na função `buildDaily`:
```javascript
const maps = {
  temperature, humidityMax, uvMax, windMax, gustMax,
  rainProbMax, rainSum, wetBulb, solar, cloud,
  windAtNoon, soil, wbgt, aqi, aqiDetalhe, mar
};
```
No entanto, ao invocar `ClimRecs.recomendacoes(fatores, persona, enino)`:
- Ele passa apenas a lista `fatores` (que contém somente o valor final processado de cada uma das 6 cotas: calor, sol, vento, umidade, ar, chuva).
- **Dados críticos do `maps` são descartados:** `temperature` (temperatura do ar seco), `gustMax` (rajadas de pico), `solar` (radiação solar direta W/m²), `soil` (umidade do solo), e `mar` (`altura`, `period`, `sst`) **não chegam a `recommendations.js`**.

### 2.3 Bugs Críticos Identificados no Fluxo de Microcopy

1. **Bug da Troca de Persona e Perda de El Niño (`app.js:398`):**
   ```javascript
   // app.js linha 398
   render(window.ClimCurrent.fatores, window.ClimCurrent.risco, window.ClimCurrent.maps, null, window.ClimCurrent.meta);
   ```
   O 4º argumento de `render()` é `enino`. Quando o usuário clica em `PESCA` ou `ROÇA`, o evento dispara `render` passando `null` no lugar de `window.ClimCurrent.meta.enino`. Isso faz com que os alertas de El Niño desapareçam instantaneamente da interface ao trocar de persona!
2. **Incompatibilidade de Ambiente Node.js:**
   Todos os scripts declaram `window.NomeModulo = ...`. Ao tentar rodar testes em Node.js (`test_matrix.js`), o interpretador encerra com:
   `ReferenceError: window is not defined at js/recommendations.js:89`.

---

## 3. Especificação da Matriz Combinatória de Microcopy (R2)

Para cumprir o requisito de *substituir as recomendações estáticas por um motor que faça "roletagem" de frases corretas cruzando múltiplos fatores (ex: Temperatura + Vento + Persona), garantindo rigor técnico nas explicações*, desenhamos a seguinte arquitetura.

### 3.1 Arquitetura do Motor Combinatório

```
                ┌────────────────────────────────────────────────────────┐
                │             Entradas Meteorológicas Completas          │
                │  (maps: Temp, Vento, WBGT, WB, UV, Chuva, AQI, Mar...)  │
                └───────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
                ┌────────────────────────────────────────────────────────┐
                │          Classificador Multidimensional de Eixos       │
                │   - Eixo Térmico (Frio, Ameno, Quente, Extremo)        │
                │   - Eixo Dinâmico (Calmaria, Moderado, Vendaval)       │
                │   - Eixo Hídrico/Vapor (Seco, Saturado/Mormaço, Chuva) │
                │   - Eixo Atmosférico/Fotoquímico (AQI, UV extremo)     │
                └───────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
                ┌────────────────────────────────────────────────────────┐
                │            Matriz de Regras Combinatórias              │
                │      Cruza: [Térmico × Dinâmico × Hídrico × AQI]       │
                │       Gera chave composta de condição sinérgica        │
                │        (ex: CALOR_EXTREMO + CALMARIA + SATURADO)       │
                └───────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
                ┌────────────────────────────────────────────────────────┐
                │             Filtro de Lente por Persona                │
                │         [ MORADOR / PESCADOR / AGRICULTOR ]            │
                │    Seleciona catálogo técnico aplicável à função       │
                └───────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
                ┌────────────────────────────────────────────────────────┐
                │          Motor de Roletagem e Anti-Repetição           │
                │   - Rotação cíclica ponderada sobre pool de frases     │
                │   - Deduplicação intra-sessão e inter-chamadas         │
                │   - Interpolação de métricas físicas reais no texto    │
                └───────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
                                [ 3 a 4 Frases Únicas, ]
                                [ Técnicas e Rigorosas ]
```

### 3.2 Os Eixos Combinatórios Fundamentais

A matriz cruza quatro eixos ambientais com a persona ativa:

1. **Eixo Térmico ($\theta$):**
   - $\theta_{frio}$: Temp < 18°C ou WBGT < 18°C
   - $\theta_{ameno}$: Temp 18–27°C e WBGT < 25°C
   - $\theta_{quente}$: Temp 28–34°C ou WBGT 25–31.9°C
   - $\theta_{extremo}$: Temp ≥ 35°C ou WBGT ≥ 32°C (Emergência ISO 7933)

2. **Eixo Dinâmico / Vento ($W$):**
   - $W_{calmo}$: Vento < 12 km/h (Beaufort 0–1; calmaria, ausência de troca convectiva)
   - $W_{moderado}$: Vento 12–38 km/h (Beaufort 2–5; brisa de alívio ou deriva leve)
   - $W_{forte}$: Vento 39–61 km/h (Beaufort 6–7; vento forte, risco a embarcações e pulverização)
   - $W_{gale}$: Vento ≥ 62 km/h ou Rajada ≥ 65 km/h (Beaufort 8+; ventania perigosa, mar bravio, corte estrutural)

3. **Eixo Hídrico & Umidade ($H$):**
   - $H_{seco}$: Umidade Relativa < 35% ou Solo < 20%
   - $H_{normal}$: Umidade 35–79%
   - $H_{saturado}$: Umidade ≥ 80% ou Bulbo Úmido ≥ 28°C (Mormaço / limitação de sudorese)
   - $H_{chuva\_forte}$: Chuva Prob ≥ 70% e Acúmulo ≥ 25mm (Risco hidrológico)

4. **Eixo Fotoquímico & Qualidade do Ar ($A$):**
   - $A_{uv\_extremo}$: Índice UV ≥ 11 ou Radiação Solar ≥ 900 W/m²
   - $A_{aqi\_ruim}$: AQI ≥ 65 (PM2.5 elevado por queimadas florestais)

---

### 3.3 A Lente das Personas (Contexto Técnico Especializado)

Para cada cruzamento ambiental, o motor deve gerar recomendações especializadas com linguagem e orientações rigorosamente adaptadas à realidade de cada grupo:

#### A. Morador (`geral`)
- **Foco:** Conforto bioclimático residencial, balanço térmico corporal humano, vulnerabilidade etária extrema (idosos com menor capacidade de sudorese e sede atenuada; crianças com superfície corporal proporcionalmente maior e desidratação rápida), proteção estrutural e prevenção respiratória.
- **Termos técnicos requeridos:** *capacidade evaporativa do suor*, *troca de calor convectiva*, *resfriamento mecânico*, *vasodilatação periférica*, *radiação actínica*, *umidificação de mucosas*, *pressão estática de vento*.

#### B. Pescador (`pescador`)
- **Foco:** Hidrodinâmica da foz do Rio Doce (barra rasa com bancos de areia móveis), conservação do pescado em gelo no porão/caixa sob calor extremo, sensação térmica no convés exposto, deriva por vento e correntes costeiras, risco de emborcamento por quebra de ondas (vagalhões), visibilidade comprometida por fumaça/névoa salina e hipotermia marítima acelerada por borrifos de água fria.
- **Termos técnicos requeridos:** *escala Beaufort*, *período de onda (swell)*, *arrebentação na barra*, *spray marinho*, *deriva por vento lateral*, *conservação criogênica/fusão do gelo*, *ceratite actínica por reflexão aquática*.

#### C. Agricultor (`agricultor`)
- **Foco:** Agronomia e fisiologia vegetal das culturas locais (cacau na foz do Rio Doce, café conilon, pastagens, frutíferas), déficit de pressão de vapor (VPD), condutância e fechamento estomático foliar sob estresse térmico, deriva de defensivos em pulverizações sob ventos > 15 km/h, erosão laminar do solo por enxurradas, risco de quebra mecânica de ramos produtivos e ponto crítico de queima/ignição espontânea de capim seco.
- **Termos técnicos requeridos:** *déficit de pressão de vapor (VPD)*, *fechamento estomático*, *capacidade de campo do solo*, *deriva de defensivos*, *anoxia radicular*, *abortamento floral*, *ponto de combustão de fitomassa seca*.

---

### 3.4 Motor de "Roletagem" e Anti-Repetição

Para garantir que o usuário não veja textos repetitivos no dia a dia e que os perfis gerem sempre saídas exclusivas:

1. **Pool de Variantes por Regra Combinatória:**
   Cada nó da matriz `(Condição, Persona)` possui um conjunto de 3 a 5 variações técnicas equivalentes.
2. **Buffer de Histórico / Rotação Cíclica:**
   O motor armazena os IDs das frases entregues nas últimas 10 consultas. Na seleção, prioriza variantes com `historyCount === 0`.
3. **Interpolação Paramétrica Dinâmica:**
   Em vez de frases puramente estáticas, as mensagens interpolam valores medidos reais (`${maps.wbgt}°C`, `${maps.windMax} km/h`, `${maps.mar.altura}m`, etc.), garantindo especificidade contextual e impedindo que frases soem artificiais ou idênticas.

---

## 4. Os 5 Perfis Climáticos Extremos para Validação (`test_matrix.js`)

Para cumprir com precisão absoluta o critério de aceitação:
> *"Um script de validação (`test_matrix.js`) deve injetar 5 perfis climáticos extremos no sistema; a saída deve conter frases únicas, tecnicamente corretas e sem repetição para cada perfil."*

Desenhamos 5 perfis meteorológicos extremos, realistas e desafiadores, baseados no clima costeiro de Regência (ES) e extremos globais:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                     OS 5 PERFIS CLIMÁTICOS EXTREMOS                               │
├─────────────────┬─────────────────┬─────────────────┬─────────────────┬───────────┤
│ Perfil 1:       │ Perfil 2:       │ Perfil 3:       │ Perfil 4:       │ Perfil 5: │
│ Mormaço         │ Ciclone e       │ Seca, Queimada  │ Frente Polar    │ Domo UV   │
│ Asfixiante      │ Ressaca         │ e Fogo          │ Costeira        │ Radiativo │
│ (Calor+Saturação│ (Vendaval+Chuva │ (Calor+Aridez+  │ (Frio+Vento+    │ (UV 13.5+ │
│ +Calmaria)      │ +Ondas Gigantes)│ Fumaça AQI 88)  │ Spray Marinho)  │ Calmaria) │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴───────────┘
```

### Perfil 1: `mormaco_asfixiante` (Onda de Calor Tropical com Saturação de Vapor e Ar Parado)
* **Condição:** Calor extremo com saturação atmosférica (ar não aceita mais vapor d'água) e calmaria de vento.
* **Métricas Injetadas:**
  - `temperature`: 37.5°C
  - `humidityMax`: 90%
  - `wetBulb`: 32.2°C (acima do limite vital de 31°C para sobrevivência ao ar livre)
  - `wbgt`: 34.8°C (Emergência máxima ISO 7933)
  - `windMax`: 3 km/h (Beaufort 1 - Ar estagnado)
  - `gustMax`: 5 km/h
  - `uvMax`: 11 (Extremo)
  - `solar`: 800 W/m²
  - `aqi`: 30
  - `rainProbMax`: 15% / `rainSum`: 0mm
  - `soil`: 0.40
  - `mar`: { altura: 0.6, period: 6, sst: 29.5 }
* **Mecanismo Físico/Biológico:** Falência completa do resfriamento evaporativo por sudorese humana. Sem vento convectivo, a camada limite de ar quente e saturado isola a pele, elevando a temperatura interna para níveis críticos.
* **Microcopy Esperado (Único e Sem Repetição):**
  - **Morador:** *"Emergência bioclimática por mormaço extremo: Bulbo úmido a 32.2°C anula a capacidade evaporativa do suor humano. Sem vento convectivo (3 km/h), o corpo acumula calor metabolicamente; idosos e crianças devem permanecer em ambiente com circulação forçada e resfriamento ativo."*
  - **Pescador:** *"Calmaria asfixiante na foz e convés superaquecido: A ausência de vento e umidade a 90% aceleram a exaustão térmica fulminante da tripulação. O gelo das caixas de pescado sofre fusão térmica acelerada; suspenda fainas pesadas de rede."*
  - **Agricultor:** *"Estresse fisiológico vegetal severo na roça: Ar estagnado e saturação de vapor bloqueiam a transpiração foliar, elevando a temperatura interna da folhagem e paralisando a fotossíntese. Interrompa imediatamente trabalhos manuais pesados no campo."*

---

### Perfil 2: `ressaca_ciclone` (Ressaca Marítima Severa, Vendaval e Chuva Torrencial)
* **Condição:** Ciclone extratropical costeiro com ventania violenta, mar revolto com ondas gigantes e tempestade de alta precipitação.
* **Métricas Injetadas:**
  - `temperature`: 21.0°C
  - `humidityMax`: 98%
  - `wetBulb`: 20.5°C
  - `wbgt`: 21.2°C
  - `windMax`: 72 km/h (Beaufort 8 - Ventania forte)
  - `gustMax`: 98 km/h (Rajadas violentas)
  - `uvMax`: 1 (Baixo)
  - `solar`: 100 W/m²
  - `aqi`: 10
  - `rainProbMax`: 100% / `rainSum`: 92mm (Chuva torrencial contínua)
  - `soil`: 0.95 (Solo totalmente encharcado)
  - `mar`: { altura: 4.8, period: 15, sst: 21.0 } (Swell longo e violento de sul)
* **Mecanismo Físico/Biológico:** Força mecânica e cisalhamento do vento destruindo estruturas leves; vagalhões com energia cinética violenta quebrando sobre bancos de areia; saturação hídrica do perfil do solo causando deslizamentos, anoxia radicular e enxurradas costeiras.
* **Microcopy Esperado (Único e Sem Repetição):**
  - **Morador:** *"Perigo severo de impacto mecânico e enxurrada: Rajadas destrutivas de até 98 km/h exercem pressão extrema sobre telhados e árvores. Com 92mm de precipitação acumulada, evite calhas de drenagem, encostas e permaneça abrigado em alvenaria sólida."*
  - **Pescador:** *"Interdição náutica absoluta na barra e alto-mar: Vagalhões de 4.8m com período de 15s geram arrebentação de energia brutal sobre os bancos de areia da foz do Rio Doce. Ventania de 72 km/h inviabiliza governabilidade de embarcações; mantenha barcos trancados em seco."*
  - **Agricultor:** *"Dano mecânico em culturas e erosão laminar severa: Ventos sustentados de 72 km/h quebram galhos produtivos de cacau e acamam plantações. Saturação hídrica do solo a 95% bloqueia a oxigenação das raízes e causa lixiviação massiva de nutrientes."*

---

### Perfil 3: `seca_fogo_fumaca` (Canícula, Vento Dessecante e Inversão Térmica por Fumaça Tóxica)
* **Condição:** Seca prolongada potencializada por El Niño, temperatura altíssima, umidade desértica, vento moderado propagador de chamas e ar pesado saturado por partículas de queimadas florestais.
* **Métricas Injetadas:**
  - `temperature`: 39.2°C
  - `humidityMax`: 18% (Aridez extrema)
  - `wetBulb`: 21.0°C
  - `wbgt`: 30.5°C (Alerta de Calor)
  - `windMax`: 36 km/h (Beaufort 5 - Vento fresco constante)
  - `gustMax`: 50 km/h
  - `uvMax`: 9 (Muito alto)
  - `solar`: 950 W/m²
  - `aqi`: 88 (Ar tóxico / Perigo severo por PM2.5)
  - `rainProbMax`: 0% / `rainSum`: 0mm
  - `soil`: 0.08 (Solo seco como pó)
  - `elNino`: { ativo: true, anomalia: 2.3, fonte: 'NOAA' }
  - `mar`: { altura: 1.1, period: 8, sst: 26.0 }
* **Mecanismo Físico/Biológico:** Altíssimo déficit de pressão de vapor associado a micropartículas inaláveis (PM2.5) que penetram os alvéolos pulmonares e entram na corrente sanguínea. O ar quente e seco a 36 km/h cria um índice de inflamabilidade extremo na vegetação desidratada.
* **Microcopy Esperado (Único e Sem Repetição):**
  - **Morador:** *"Alerta duplo respiratório e desidratação acelerada: AQI crítico em 88 com alta carga de fumaça e fuligem tóxica (PM2.5), associado a 18% de umidade. Vede janelas, use máscaras protetoras, mantenha idosos com hidratação reforçada e evite qualquer atividade externa."*
  - **Pescador:** *"Visibilidade costeira restrita e ressecamento orgânico: Névoa densa de fumaça reduz drasticamente a visibilidade de referências na costa. O vento seco a 36 km/h rouba umidade cutânea aceleradamente; transporte reserva dobrada de água potável a bordo."*
  - **Agricultor:** *"Risco catastrófico de incêndio rural e dessecação: Umidade do solo em 8% e rajadas de 50 km/h criam condição de propagação explosiva de chamas em palhadas. Proibição irrestrita de queimadas; mantenha aceiros limpos e suspenda máquinas agrícolas a combustão na palha."*

---

### Perfil 4: `frente_fria_cortante` (Frente Polar Costeira Úmida com Vento Cortante)
* **Condição:** Invasão polar marítima atípica na costa capixaba com temperaturas baixas, umidade elevada, vento forte e borrifos salinos, induzindo resfriamento convectivo violento.
* **Métricas Injetadas:**
  - `temperature`: 12.8°C
  - `humidityMax`: 94%
  - `wetBulb`: 12.0°C
  - `wbgt`: 13.5°C
  - `windMax`: 52 km/h (Beaufort 7 - Vento forte)
  - `gustMax`: 68 km/h
  - `uvMax`: 2 (Baixo)
  - `solar`: 180 W/m²
  - `aqi`: 12 (Ar limpo)
  - `rainProbMax`: 45% / `rainSum`: 6mm (Garoa fria e nevoeiro marítimo)
  - `soil`: 0.65
  - `mar`: { altura: 3.2, period: 11, sst: 18.5 }
* **Mecanismo Físico/Biológico:** A taxa de condutividade térmica da água e do sal sobre a pele/vestimenta é cerca de 25 vezes superior à do ar seco. A combinação de vento forte (52 km/h) e baixa temperatura gera um efeito *wind chill* (sensação de 7°C) indutor de hipotermia periférica e espasmos bronquiolares em grupos vulneráveis.
* **Microcopy Esperado (Único e Sem Repetição):**
  - **Morador:** *"Choque térmico por vento polar cortante: Sensação térmica real inferior a 8°C decorrente do vento forte de 52 km/h com ar úmido. Idosos e crianças perdem calor corpóreo por convecção rápida; necessário agasalhamento hidrófugo em camadas e proteção contra correntes de ar frio."*
  - **Pescador:** *"Perigo de hipotermia por borrifos marinhos e mar picado: A aspersão de spray salino frio sob rajadas de 68 km/h extrai calor térmico do corpo 25 vezes mais rápido que o ar seco, reduzindo a destreza manual nas redes. Use roupas de borracha estanques e evite mar aberto."*
  - **Agricultor:** *"Choque térmico e paralisação vegetativa no campo: Vento frio sustentado a 52 km/h interrompe o fluxo de seiva nas lavouras e pode provocar queima fria em brotos jovens. Adote barreiras quebra-vento em viveiros e postergue qualquer adubação foliar."*

---

### Perfil 5: `radiacao_domo_calor` (Domo Radiativo Solar Extremo e Calmaria Térmica)
* **Condição:** Céu absolutamente límpido, incidência solar no zênite com radiação ultravioleta em níveis extremos (UV 13.5) e alta irradiação direta sem dispersão por ventos.
* **Métricas Injetadas:**
  - `temperature`: 35.0°C
  - `humidityMax`: 52%
  - `wetBulb`: 25.5°C
  - `wbgt`: 33.2°C (Emergência por carga radiante)
  - `windMax`: 7 km/h (Beaufort 2 - Brisa fraca)
  - `gustMax`: 11 km/h
  - `uvMax`: 13.5 (Extremo perigoso)
  - `solar`: 1150 W/m² (Radiação solar pico)
  - `aqi`: 20 (Ar limpo)
  - `rainProbMax`: 5% / `rainSum`: 0mm
  - `soil`: 0.32
  - `mar`: { altura: 0.9, period: 7, sst: 27.0 }
* **Mecanismo Físico/Biológico:** Fótons de radiação UV-B em dose ultra-alta causam quebra direta de fitas de DNA e formação de dímeros de pirimidina na pele desprotegida em menos de 8 minutos. A carga térmica radiativa de 1150 W/m² sobreaquece tecidos biológicos e superfícies vegetais.
* **Microcopy Esperado (Único e Sem Repetição):**
  - **Morador:** *"Risco crítico de queimadura actínica e insolação direta: Índice UV em 13.5 e irradiação de 1150 W/m² degradam o tecido cutâneo em menos de 10 minutos de exposição desprotegida. Evite circulação externa entre 10h e 16h; bloqueadores de amplo espectro e proteção ocular UV400 são indispensáveis."*
  - **Pescador:** *"Alerta de fototoxicidade e reflexão solar na água: O espelho d'água liso reflete até 80% da radiação UV incidente diretamente nos olhos da tripulação. Risco agudo de ceratite actínica e queimadura labial; uso mandatório de óculos polarizados, camisas UV50+ e boné com proteção de nuca."*
  - **Agricultor:** *"Fotoinibição clorofiliana e escaldadura solar de frutos: A radiação direta de 1150 W/m² queima a casca de frutos expostos e desnatura enzimas fotossintéticas nas folhas. Providencie sombreamento em canteiros e restrinja as atividades dos trabalhadores exclusivamente às primeiras horas da manhã."*

---

## 5. Especificação do Script de Teste Automatizado: `test_matrix.js`

### 5.1 Requisitos de Engenharia do `test_matrix.js`

1. **Stack Limpa (Zero Dependencies):**
   - Execução pura no ambiente Node.js: `node test_matrix.js`.
   - Sem dependência de bibliotecas externas (como Jest, Mocha ou Chai).
   - Deve mockar ou importar universalmente os módulos da aplicação.
2. **Injeção dos 5 Perfis Climáticos:**
   - Define formalmente os 5 perfis (`mormaco_asfixiante`, `ressaca_ciclone`, `seca_fogo_fumaca`, `frente_fria_cortante`, `radiacao_domo_calor`).
   - Para cada perfil, injeta dados no motor para as 3 personas (`geral`, `pescador`, `agricultor`), totalizando 15 combinações testadas.
3. **Bateria de Asserções Rígidas:**
   - **Asserção 1 (Não-Vacuidade):** Cada perfil e persona deve gerar pelo menos 1 a 4 recomendações preenchidas.
   - **Asserção 2 (Unicidade Global entre Perfis):** Nenhuma frase do Perfil 1 pode ser idêntica a frases dos Perfis 2, 3, 4 ou 5.
   - **Asserção 3 (Unicidade Intra-Perfil / Não-Repetição):** Dentro do mesmo perfil, nenhuma recomendação pode ser repetida para a mesma persona ou entre personas.
   - **Asserção 4 (Rigor Técnico e Vocabulário Obrigatório):** O texto gerado deve conter termos científicos validados que comprovem a explicação do mecanismo biofísico:
     - Perfil 1: `bulbo úmido` ou `evapora` ou `sudorese` ou `calmaria`.
     - Perfil 2: `vagalhões` ou `rajadas` ou `arrebentação` ou `enxurrada` ou `drenagem` ou `acama`.
     - Perfil 3: `pm2.5` ou `fumaça` ou `incêndio` ou `aridez` ou `queimada` ou `estômato`.
     - Perfil 4: `hipotermia` ou `vento polar` ou `cortante` ou `convecção` ou `spray` ou `borrifo`.
     - Perfil 5: `uv` ou `radiação` ou `actínica` ou `insolação` ou `escaldadura` ou `polarizado`.
   - **Asserção 5 (Diferenciação por Persona):**
     - Frases de `pescador` devem abordar ambiente náutico/marinho/pesca.
     - Frases de `agricultor` devem abordar lavoura/solo/planta/roça.
     - Frases de `geral` devem abordar residência/saúde/família/idosos.
4. **Resultado de Execução:**
   - Em caso de sucesso: Imprime relatório detalhado com checklist e encerra com código de saída `0`.
   - Em caso de falha: Imprime exatamente a asserção violada, os textos duplicados ou termos ausentes e encerra com código de saída `1`.

---

## 6. Plano de Implementação para a Fase de Construção (M2 Worker)

Para orientar diretamente o agente que executará o Milestone M2, os passos de implementação devem ser:

1. **Refatorar `js/recommendations.js`:**
   - Tornar o módulo **isomórfico (UMD)**:
     ```javascript
     if (typeof module !== 'undefined' && module.exports) {
       module.exports = { recomendacoes, evaluateMatrix, PROFILES };
     }
     if (typeof window !== 'undefined') {
       window.ClimRecs = { recomendacoes, evaluateMatrix, PROFILES };
     }
     ```
   - Expandir a assinatura para aceitar tanto `(fatores, persona, enino, maps)` quanto um objeto unificado `(maps, persona, enino)`.
   - Implementar a tabela de regras combinatórias (Temperatura + Vento + Umidade/AQI + Persona).
   - Inserir o catálogo completo de frases com rigor técnico, garantindo variantes para roletagem.
2. **Atualizar `js/app.js`:**
   - Passar o objeto `maps` completo para `window.ClimRecs.recomendacoes(fatores, persona, enino, maps)` na linha 270.
   - Corrigir o bug da linha 398 para não anular `enino` na troca de personas.
   - Integrar os textos dos cartões das cotas (`microText`) ao novo repositório de microcopy.
3. **Criar `test_matrix.js` na raiz do repositório:**
   - Implementar a suíte de testes de validação dos 5 perfis climáticos extremos com saída colorida no terminal e asserções estritas.
   - Testar via `node test_matrix.js`.
4. **Verificação e Aceite:**
   - Executar `node test_matrix.js` e comprovar aprovação verde total sem regressões no dashboard web.

# Original User Request

## Initial Request — 2026-09-18T16:28:36Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

O projeto "Cota de Climão" precisa ser reestruturado em uma plataforma meteorológica robusta e acessível. O foco é reconstruir a arquitetura de dados para alta fidelidade e tolerância a falhas, auditar a interface para adequação a WCAG (idosos/crianças), e substituir o texto estático por uma matriz combinatória de microcopy meteorológico dinâmico.

Working directory: /home/rafamass/Área de trabalho/COTADECLIMAO
Integrity mode: development

## Requirements

### R1. Motor de Dados e API Resiliente
Refatorar a camada de consumo de dados (Open-Meteo, APIs) para garantir fidelidade, tipagem estrita e resiliência. O dashboard não pode quebrar caso a internet oscile ou a API mude levemente o formato.

### R2. Matriz Combinatória de Microcopy
Substituir as recomendações estáticas por um motor que faça "roletagem" de frases corretas cruzando múltiplos fatores (ex: Temperatura + Vento + Persona), garantindo rigor técnico nas explicações.

### R3. Auditoria de UX, Tipografia e Acessibilidade (WCAG)
Reescrever o layout para garantir fontes de sistema seguras, contrastes exatos que passem na validação WCAG AAA (para idosos), e garantir que toda a interface caiba em 100vh sem estourar.

## Acceptance Criteria

### Resiliência de Dados
- [ ] Um script automatizado (`test_api_fallback.js`) deve simular uma falha de API e o dashboard deve renderizar o último estado salvo em cache sem erros no console.

### Matriz de Frases
- [ ] Um script de validação (`test_matrix.js`) deve injetar 5 perfis climáticos extremos no sistema; a saída deve conter frases únicas, tecnicamente corretas e sem repetição para cada perfil.

### Validação de UI/UX
- [ ] Agent-as-judge: Um agente deve abrir a página final, executar uma checagem de contraste e certificar que todos os textos sobre fundos coloridos possuem ratio >= 4.5:1, sem elementos invisíveis.

## Follow-up — 2026-09-19T16:35:39Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: small focused team

This is a single self-contained fix; keep it small and focused. O usuário solicitou: equipe focada e ágil com 1 implementador + revisão enxuta para entrega rápida e direta do painel Cota de Climão.

Working directory: /home/rafamass/Área de trabalho/COTADECLIMAO
Integrity mode: development

## Requirements

### R1. Concluir Resiliência de Dados e Cache
Finalizar a camada de dados (`js/api.js`, `js/app.js`, `js/storage.js`) garantindo que falhas de rede ou cache vazio/corrompido exibam estado seguro sem travar a interface em loading.

### R2. Matriz Combinatória de Microcopy Dinâmico
Substituir o texto estático de recomendações em `js/recommendations.js` por um motor combinatório inteligente que cruze múltiplos fatores (temperatura, vento, umidade, UV, ar, persona) e rolete frases meteorológicas técnicas, contextualizadas e sem repetição.

### R3. Ajustes de UI/UX, Contraste e Contenção 100vh
Auditar e ajustar `css/style.css` e `index.html` para conformidade WCAG AAA (alto contraste para idosos), tipografia de sistema segura e layout estritamente contido em 100vh sem rolagem de janela.

## Acceptance Criteria

### Resiliência
- [ ] Execução de `node test_m1_units.js` e `node test_stress_m1.js` com 100% de aprovação nos testes de cache corrompido e resiliência de rede.

### Matriz de Microcopy
- [ ] Um script automatizado `test_matrix.js` que simula 5 cenários meteorológicos (calor extremo, vendaval litorâneo, ar poluído/seca, tempestade e dia ameno) e valida a geração de frases exclusivas, ricas e sem repetições para cada perfil.

### Acessibilidade e Contenção
- [ ] O layout deve permanecer contido em uma única tela (100vh) sem scroll vertical da página principal, e com contrastes legíveis testados.

## Follow-up — 2026-09-19T19:27:01Z

Os dioramas isométricos 3D inseridos nos cards de fator climático do Cota de Climão ficaram visualmente ruins: a perspectiva CSS em 90px de altura colapsa e exibe apenas blocos marrom/verde sem animação perceptível. O objetivo é redesenhar os 6 dioramas como **ilustrações 2D animadas em CSS puro** — compactas, expressivas e visualmente limpas dentro dos cards.

Working directory: /home/rafamass/Área de trabalho/COTADECLIMAO
Integrity mode: development

---

## Contexto

- Os cards de fator ficam num grid 3×2 no painel direito. Cada card tem ~180×220px.
- O diorama ocupa uma faixa de `height: 90px` entre o badge de nível e o valor numérico.
- O arquivo atual é `js/dioramas.js` (gerador de HTML por fator) e o CSS está no final de `css/style.css` (seção `DIORAMAS ISOMÉTRICOS`).
- A classe container é `.dm`, com variantes `.dm-calor`, `.dm-sol`, `.dm-vento`, `.dm-umidade`, `.dm-ar`, `.dm-chuva`.

## Requirements

### R1. Redesenho visual dos 6 dioramas como cenas 2D animadas

Substituir a abordagem isométrica 3D (que falha em cards pequenos) por **ilustrações 2D animadas em CSS puro**, uma para cada fator climático. Cada diorama deve:

- Caber dentro de uma faixa de 90px de altura e 100% de largura do card.
- Transmitir visualmente o fenômeno do fator (calor, vento, chuva etc.) de forma imediata — o usuário entende de relance do que se trata.
- Usar animações CSS (`@keyframes`) suaves e não-distrativas, calibradas ao nível de severidade (`nivel`: `bom`, `atencao`, `alerta`, `perigo`, `emergencia`) — quanto mais severo, mais intenso o movimento/cor.
- Não depender de bibliotecas externas (nada de Lottie, GreenSock, SVG animado externo). Apenas HTML e CSS inline gerado pelo JS.

Sugestão de direção visual (o time pode superar):
- **Calor**: sol com raios pulsando, chão rachado em gradiente quente
- **Sol**: disco com halo girando lentamente, sombra projetada
- **Vento**: linhas de vento horizontais, bandeirinha balançando, folhas voando
- **Umidade**: gotas caindo, névoa/blur de fundo
- **Ar**: partículas flutuando, gradiente nebuloso
- **Chuva**: nuvem com pingos e poça animada embaixo

### R2. Refatoração limpa de `js/dioramas.js` e `css/style.css`

- Remover **todo** o CSS da seção `DIORAMAS ISOMÉTRICOS` de `css/style.css` e substituir pelo novo CSS 2D.
- Reescrever `js/dioramas.js` mantendo a mesma interface pública (`window.ClimDioramas.get(factorId, valor, nivel)` retorna HTML string).
- Não tocar em nenhum outro arquivo (`app.js`, `index.html`, `js/factors.js` etc.).

## Acceptance Criteria

### Visual
- [ ] Cada um dos 6 dioramas exibe animação visivelmente diferente entre si ao inspecionar o DOM no browser.
- [ ] A um nível `emergencia`, a animação é claramente mais intensa (velocidade ou saturação) que no nível `bom`.
- [ ] Nenhum diorama exibe elementos cortados, overflow visível ou quebra de layout nos cards do grid 3×2.
- [ ] Os dioramas são legíveis/perceptíveis em tela 1280×800 (desktop) e em viewport 390×844 (mobile portrait).

### Técnico
- [ ] `window.ClimDioramas.get('calor', 25, 'alerta')` retorna uma string HTML não-vazia.
- [ ] Nenhuma dependência externa nova introduzida.
- [ ] CSS da seção anterior (`.dm-island`, `.dm-dirt-s`, `.dm-tornado`, etc.) completamente removido.
- [ ] Um script de validação `test_dioramas.js` (Node.js, sem browser) confirma que todos os 6 IDs retornam HTML não-vazio para cada um dos 5 níveis, e que nenhuma string contém `rotateX` ou `preserve-3d` (garantindo que a abordagem isométrica foi removida).



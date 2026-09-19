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


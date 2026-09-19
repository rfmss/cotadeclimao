# Handoff Report: Microcopy Combinatorial Matrix Survey (R2)

> **Agent:** Microcopy Matrix Survey Explorer (`teamwork_preview_explorer_survey_2`)  
> **Target Work Item:** Milestone M2 / Requisito R2 (`Matriz Combinatória de Microcopy`)  
> **Output Artifact:** `survey_r2.md`  
> **Timestamp:** 2026-09-18T16:36:00Z  

---

## 1. Observation

Direct observations from source inspection and execution in `/home/rafamass/Área de trabalho/COTADECLIMAO`:

1. **`js/recommendations.js` (lines 13–87):**
   - The primary recommendation function is declared as:
     ```javascript
     function recomendacoes(fatoresCalculados, persona, elnino) {
     ```
   - Evaluation is purely linear and isolated by factor ID (`if (id === 'calor') ...`, `if (id === 'sol') ...`, `if (id === 'vento') ...`).
   - Line 44: The only persona check in the entire file is:
     ```javascript
     if (persona === 'pescador' && nivel !== 'bom') {
       recs.push(`🛶 Vento ${v} km/h. Só leve a embarcação se souber exatamente o que está fazendo — condições mudam de manhã para tarde.`);
     ```
   - The persona `agricultor` does not appear anywhere in `recommendations.js`.
   - Phrase selection relies on random array sampling (lines 9–11, 77–83):
     ```javascript
     function pick(arr) {
       return arr[Math.floor(Math.random() * arr.length)];
     }
     ```
   - Global export on line 89:
     ```javascript
     window.ClimRecs = { recomendacoes, pick };
     ```

2. **`js/app.js` (lines 236–253 and 391–400):**
   - Lines 236–253 generate hardcoded inline `microText` per factor card inside `render()`.
   - Line 270 invokes recommendations without passing the full meteorological map:
     ```javascript
     const recs = window.ClimRecs.recomendacoes(fatores, persona, enino);
     ```
   - Line 398 drops the El Niño object when the user clicks a persona button:
     ```javascript
     render(window.ClimCurrent.fatores, window.ClimCurrent.risco, window.ClimCurrent.maps, null, window.ClimCurrent.meta);
     ```
     The 4th argument (`null`) overwrites the active `enino` data, breaking the El Niño alert display upon persona switching.

3. **Runtime execution in Node.js v22.22.2:**
   - Executing `node -e "require('./js/recommendations.js')"` produces verbatim:
     ```
     /home/rafamass/Área de trabalho/COTADECLIMAO/js/recommendations.js:89
       window.ClimRecs = { recomendacoes, pick };
       ^
     ReferenceError: window is not defined
     ```
   - The same pattern exists across `js/calculations.js`, `js/factors.js`, and `js/risk.js`.

4. **`index.html` (lines 100–128):**
   - A `MutationObserver` on `#d1` and `#d2` computes risk score ranges and directly mutates `#quick-tips` using 5 static strings based strictly on score thresholds (`val >= 80`, `val >= 60`, `val >= 40`, `val >= 20`, else).

5. **`ORIGINAL_REQUEST.md` (lines 21–23 and 32–34):**
   - Requisito R2: *"Substituir as recomendações estáticas por um motor que faça 'roletagem' de frases corretas cruzando múltiplos fatores (ex: Temperatura + Vento + Persona), garantindo rigor técnico nas explicações."*
   - Acceptance Criteria: *"Um script de validação (`test_matrix.js`) deve injetar 5 perfis climáticos extremos no sistema; a saída deve conter frases únicas, tecnicamente corretas e sem repetição para cada perfil."*

---

## 2. Logic Chain

1. From **Observation 1**, `recommendations.js` checks each weather factor in total isolation without cross-referencing conditions (such as Temperature + Wind, or Heat + Wet Bulb + Aridity). Therefore, high-risk compounding meteorological phenomena (such as stagnant wet-bulb heat stress or dry wind-driven wildfire conditions) cannot currently be detected or communicated.
2. From **Observation 1**, persona `agricultor` is completely omitted from `recommendations.js`, meaning farmers receive generic resident copy that fails to address agronomic parameters (evapotranspiration, soil moisture, drift, stomatal conductance).
3. From **Observation 1**, using `Math.random()` on small arrays creates non-deterministic output, duplicate recommendations, and prevents automated repeatable assertions.
4. From **Observation 2**, `app.js` discards ambient temperature, peak wind gusts, wave height, wave period, solar radiation flux, and soil moisture when calling `ClimRecs.recomendacoes`, starving the microcopy layer of essential technical metrics.
5. From **Observation 2**, line 398 sets `enino` to `null` during persona toggling, which directly degrades microcopy and alert fidelity during user interaction.
6. From **Observation 3**, automated test scripts such as `test_matrix.js` cannot execute directly via `node test_matrix.js` because `window` is undefined in Node.js CJS runtime. Making the modules isomorphic (UMD) is necessary to allow zero-dependency test execution.
7. From **Observation 4**, `#quick-tips` operates as a disconnected shadow microcopy system that bypasses `recommendations.js`.
8. Connecting steps 1–7 to **Observation 5**, meeting Requisito R2 requires:
   - Refactoring `recommendations.js` into a multi-factor combinatorial matrix engine that ingests the full weather parameter map (`maps`), evaluates composite condition states, applies persona lenses (`geral`, `pescador`, `agricultor`), and selects from a structured catalog of technically rigorous, physiologically grounded phrases.
   - Implementing deterministic phrase rotation and anti-repetition tracking.
   - Defining 5 distinct extreme weather profiles with complete numerical datasets and corresponding unique recommendation sets.
   - Authoring `test_matrix.js` with isomorphic module support to validate the 5 profiles without runtime crashes.

---

## 3. Caveats

- **No modifications performed:** In adherence to read-only explorer constraints, no source code in `js/`, `index.html`, or `css/` was modified during this survey.
- **Assumed runtime for test runner:** Assumed `test_matrix.js` will be run via native `node test_matrix.js` without installing third-party npm packages (zero-dependency policy).
- **Scope limitation:** CSS styling and layout sizing of `#rec-list` are tracked under Requisito R3 (Explorer 3 / Spec Miner).

---

## 4. Conclusion

The current microcopy implementation is linear, non-combinatorial, omits the agricultural persona, lacks scientific depth, and fails when run in Node.js. 

To achieve Requisito R2:
1. `survey_r2.md` has established the complete combinatorial specification crossing Temperature, Wind, Humidity/Wet Bulb, UV, AQI, and the 3 Personas.
2. 5 extreme meteorological profiles have been fully defined (`mormaco_asfixiante`, `ressaca_ciclone`, `seca_fogo_fumaca`, `frente_fria_cortante`, `radiacao_domo_calor`), along with 15 unique, technically accurate persona phrases.
3. The exact requirements for `test_matrix.js`, isomorphic UMD export, and `app.js` integration are documented in `survey_r2.md` to guide immediate execution by the Milestone M2 worker.

---

## 5. Verification Method

Independent verification of the findings and blueprint can be conducted by:

1. **Verify Current File Deficiencies:**
   - Inspect `js/recommendations.js` lines 13–87 (`view_file`) to confirm the absence of multi-factor combinatorics and the total absence of `agricultor`.
   - Inspect `js/app.js` line 398 to confirm `null` is passed for `enino` on persona button click.
2. **Verify Node.js Runtime Failure:**
   - Execute in terminal:
     ```bash
     node -e "require('./js/recommendations.js')"
     ```
     Confirm the verbatim `ReferenceError: window is not defined`.
3. **Verify Survey Document:**
   - Read `/home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_explorer_survey_2/survey_r2.md` to verify that all 5 extreme profiles, parameter payloads, technical vocabulary standards, and `test_matrix.js` specifications are completely mapped.
4. **Invalidation Condition:**
   - If `recommendations.js` already contained multi-factor evaluations crossing Temperature + Wind + Persona, or if `node -e "require('./js/recommendations.js')"` ran without error, this assessment would be invalidated. Both conditions were directly verified as false.

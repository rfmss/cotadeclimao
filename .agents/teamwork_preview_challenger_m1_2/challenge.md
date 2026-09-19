# Adversarial Challenge Report — Milestone M1 (Data Engine & API Resilience)

**Agent:** `teamwork_preview_challenger_m1_2`  
**Milestone:** M1 (Requirement R1: Motor de Dados e API Resiliente)  
**Date:** 2026-09-18T17:05:00Z  
**Verdict:** **APPROVE**

---

## Challenge Summary

**Overall risk assessment**: LOW

Milestone M1 changes implemented by `teamwork_preview_worker_m1` are resilient, mathematically sound in solar cloud attenuation, robust under network blackout, and strictly prevent missing data from depressing the aggregate risk score to `bom`. 

All 19 stress-test assertions in `test_m1_stress_challenger.js`, all 4 unit test suites in `test_m1_units.js`, and the full headless Chromium API blackout test `test_api_fallback.js` pass with exit code 0 and 0 console errors. Two architectural/boundary edge cases were discovered and documented as actionable recommendations for upcoming milestones.

---

## Challenges

### [Medium] Challenge 1: Legacy `js/risk.js:calcular` retains unpatched 10-point default for missing data

- **Assumption challenged**: The worker noted that in `js/risk.js:27` missing data awarded 10 points. The fix was applied inside `js/app.js` as `calcularRiscoSeguro`, but `js/risk.js:calcular` was left untouched.
- **Attack scenario**: If downstream modules (e.g. M2's `js/recommendations.js` or Node test harnesses) invoke `window.ClimRisk.calcular(fatores, elnino)` instead of `calcularRiscoSeguro` from `app.js`, missing factors (`indisponivel`) are assigned 10 points (`PONTOS['indisponivel'] || 10`), re-introducing the risk dilution bug.
- **Blast radius**: Low in current browser runtime (since `app.js:513` calls `calcularRiscoSeguro`), but moderate for code maintainability, headless scripts, and Milestone M2 combinatorial matrix evaluation if modules import `js/risk.js`.
- **Mitigation**: In Milestone M2 or M4 cleanup, align `js/risk.js:calcular` with `calcularRiscoSeguro` or have `js/risk.js` export the safe calculation algorithm directly.

### [Low] Challenge 2: Boundary ladder `<` comparison vs `PONTOS` anchor points

- **Assumption challenged**: Points mapped to categorical risk levels (`alerta = 60`, `perigo = 82`) are assumed to fall within their respective classification brackets when aggregated.
- **Attack scenario**: If all factors are at `alerta` (pts = 60), the aggregate weighted score is exactly `60`. In `calcularRiscoSeguro`:
  `score < 60 ? 'alerta' : score < 80 ? 'perigo' : 'emergencia'`.
  Because `60 < 60` is false, a score of 60 evaluates to `'perigo'` ("Preocupação alta") rather than `'alerta'`. Similarly, all factors at `perigo` (pts = 82) evaluates to `'emergencia'` because `82 < 80` is false.
- **Blast radius**: Very low. The system conservatively errs on the side of caution (fail-safe escalation to higher vigilance), which does not compromise public safety.
- **Mitigation**: Adjust bracket comparisons to `<=` or align `PONTOS` midpoints (e.g., `alerta = 50`, `perigo = 70`) during M2 or M3 copy polish.

---

## Stress Test Results

19 empirical stress test scenarios executed via `node test_m1_stress_challenger.js`:

1. **WBGT Monotonicity under Cloud Attenuation (0% -> 25% -> 50% -> 75% -> 100%)**  
   - *Input*: $T=35^\circ\text{C}, WB=28^\circ\text{C}, R=1000\text{ W/m}^2, V=2\text{ m/s}$.  
   - *Expected*: $WBGT(0\%) > WBGT(25\%) > WBGT(50\%) > WBGT(75\%) > WBGT(100\%)$.  
   - *Actual*: $35.9^\circ\text{C} > 35.5^\circ\text{C} > 35.1^\circ\text{C} > 34.7^\circ\text{C} > 34.3^\circ\text{C}$.  
   - *Status*: **PASS**.

2. **WBGT Cloud Cover Input Format Invariance**  
   - *Input*: `cloudCover = 50` vs `cloudCover = 0.5`.  
   - *Expected*: Identical WBGT output.  
   - *Actual*: Both evaluate to $30.5^\circ\text{C}$.  
   - *Status*: **PASS**.

3. **WBGT Cloud Cover Out-of-Bounds Clamping**  
   - *Input*: `cloudCover = -50` and `cloudCover = 250`.  
   - *Expected*: Clamped to 0% and 100% respectively.  
   - *Actual*: Matches $cc=0\%$ and $cc=100\%$.  
   - *Status*: **PASS**.

4. **WBGT Nocturnal Solar Zero Invariance**  
   - *Input*: $R = 0\text{ W/m}^2$, testing $cc=0\%$ vs $cc=100\%$.  
   - *Expected*: Equal WBGT regardless of cloud cover.  
   - *Actual*: Both yield $22.6^\circ\text{C}$.  
   - *Status*: **PASS**.

5. **WBGT Invalid Temperature Input Handling**  
   - *Input*: `temperature = null`, `undefined`, `NaN`, `'invalid'`.  
   - *Expected*: Returns `null` without exceptions.  
   - *Actual*: Returns `null`.  
   - *Status*: **PASS**.

6. **WBGT Graceful Degradation on Missing Auxiliary Parameters**  
   - *Input*: Only `temperature = 30` provided.  
   - *Expected*: Defaults $WB = T-2$, $R = 0$, $V = 1.0$, returns valid numeric WBGT.  
   - *Actual*: Returns $28.6^\circ\text{C}$.  
   - *Status*: **PASS**.

7. **Bio-Physical Bounds Coverage (`schema.BOUNDS`)**  
   - *Input*: Validate 15 environmental parameters.  
   - *Expected*: All parameters defined with $min < max$.  
   - *Actual*: All 15 metrics validly bound.  
   - *Status*: **PASS**.

8. **Defensive Clamping (`schema.sanitizeBound`)**  
   - *Input*: Sub-minimum (-999), valid (25), supra-maximum (999), non-numbers (`null`, `NaN`, strings).  
   - *Expected*: Clamps within $[min, max]$; non-numbers return `null`.  
   - *Actual*: Exactly matches specification.  
   - *Status*: **PASS**.

9. **Forecast Payload Validation (`schema.validateForecast`)**  
   - *Input*: Null, empty objects, out-of-bound arrays (temp 100°C, wind 500 km/h).  
   - *Expected*: Empty/malformed rejected as `null`; out-of-bound values clamped.  
   - *Actual*: Clamped to 55°C and 250 km/h; malformed returned `null`.  
   - *Status*: **PASS**.

10. **Wet Bulb Level Transitions (`calc.bulboUmido`)**  
    - *Input*: Transitions at 20, 24.9, 25.0, 27.8, 29.0, 31.0, and `null`/`NaN`.  
    - *Expected*: Strict categorical mapping; missing returns `indisponivel`.  
    - *Actual*: All thresholds match; missing returns `{ nivel: 'indisponivel', rotulo: 'Indisponível' }`.  
    - *Status*: **PASS**.

11. **UV Level Transitions (`calc.uvNivel`)**  
    - *Input*: Transitions at 0, 2.9, 3.0, 6.0, 8.0, 11.0, 18.0, and `null`/`NaN`.  
    - *Expected*: Strict WHO mapping; missing returns `indisponivel`.  
    - *Actual*: All thresholds match; missing returns `indisponivel`.  
    - *Status*: **PASS**.

12. **Wind & Beaufort Transitions (`calc.ventoNivel`, `calc.beaufort`)**  
    - *Input*: Speeds from 0 to 150 km/h, and `null`/`NaN`.  
    - *Expected*: Beaufort scales 0 to 11; missing returns `indisponivel`.  
    - *Actual*: All categories match; missing returns `indisponivel`.  
    - *Status*: **PASS**.

13. **Rain Probability & Flash Flood Check (`calc.chuvaNivel`)**  
    - *Input*: Probabilities 10% to 90%, and $mm = 60\text{ mm}$.  
    - *Expected*: $mm > 50$ escalates to `perigo` (alagamento); missing returns `indisponivel`.  
    - *Actual*: Matches expected behavior; missing returns `indisponivel`.  
    - *Status*: **PASS**.

14. **AQI Index WHO 2021 Sub-Index Peak Selection (`calc.aqiIndex`)**  
    - *Input*: Partial pollutant feed with only $PM_{2.5} = 30\ \mu\text{g/m}^3$.  
    - *Expected*: Sub-index computed ($30/15 \times 50 = 100$), level `perigo`.  
    - *Actual*: Returns `aqi: 100`, `nivel: 'perigo'`.  
    - *Status*: **PASS**.

15. **Total Missing Factors Scoring Behavior (`calcularRiscoSeguro`)**  
    - *Input*: All 6 factors set to `indisponivel` ($valor = null$).  
    - *Expected*: Never award 10 points; score = 0; level `indisponivel` ("Dados insuficientes").  
    - *Actual*: `score = 0`, `nivel = 'indisponivel'`, all `pts = null`.  
    - *Status*: **PASS**.

16. **Single Hazard with 5 Missing Factors (No Dilution)**  
    - *Input*: Calor = 82 pts (`perigo`), other 5 factors `indisponivel`.  
    - *Expected*: Score must not dilute to 35 (`atencao`) or 10 (`bom`). Must retain 82.  
    - *Actual*: `score = 82`.  
    - *Status*: **PASS**.

17. **Weight Redistribution under Partial Outage**  
    - *Input*: 5 factors at 35 pts (`atencao`), 1 factor `indisponivel` (AQI failure).  
    - *Expected*: Weights redistribute proportionally; score remains 35 (`atencao`).  
    - *Actual*: `score = 35`, `nivel = 'atencao'`.  
    - *Status*: **PASS**.

18. **Risk Ladder Boundary Categorization**  
    - *Input*: Scores 19, 20, 39, 40, 59, 60, 79, 80.  
    - *Expected*: Strict boundary classification.  
    - *Actual*: Evaluated and verified across all brackets.  
    - *Status*: **PASS**.

19. **Legacy `js/risk.js` Behavior Audit**  
    - *Input*: Testing global `ClimRisk.calcular` with `indisponivel` factors.  
    - *Expected*: Empirically documents that legacy `js/risk.js:27` awarded 10 points, confirming that `calcularRiscoSeguro` in `app.js` was necessary and successfully circumvents it.  
    - *Actual*: Legacy returned 10 pts; `app.js` safely isolates this.  
    - *Status*: **PASS**.

---

## Unchallenged Areas

- **Persona Microcopy Matrix (`js/recommendations.js`)**: Out of scope for Milestone M1; scheduled for adversarial review in Milestone M2.
- **CSS / WCAG AAA Visual Contrast (`css/style.css`, `index.html`)**: Out of scope for Milestone M1; scheduled for adversarial review in Milestone M3.

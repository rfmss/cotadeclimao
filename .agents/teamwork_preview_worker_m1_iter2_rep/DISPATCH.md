## 2026-09-19T04:30:32Z
You are the Worker for Milestone M1 Iteration 2 (Data Engine & API Resilience Remediation).
Your working directory is /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_worker_m1_iter2_rep.

MANDATORY AUTHORITATIVE REQUEST:
Read /home/rafamass/Área de trabalho/COTADECLIMAO/ORIGINAL_REQUEST.md before starting work.
Also read /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/orchestrator/PROJECT.md.
Also read Challenger 1 handoff and challenge details:
- /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_challenger_m1_1/handoff.md
- /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_challenger_m1_1/challenge.md
- /home/rafamass/Área de trabalho/COTADECLIMAO/test_stress_m1.js

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write ownership:
You own edits to:
- js/app.js
- js/api.js

Concrete Remediation Tasks:
1. Fix js/app.js (corrupt cache handling in bootstrap()):
   In bootstrap(), ensure candidate cached data is validated to contain candidate.forecast && candidate.forecast.daily.
   If a cache record exists but lacks forecast (corrupted/partial), do NOT crash with TypeError: Cannot read properties of undefined (reading 'daily').
   Instead:
   - Show #err-box with text 'SEM CONEXÃO E SEM REGISTRO — ABRA O APP ONLINE AO MENOS UMA VEZ'.
   - Set appMain.setAttribute('data-state', 'ready').
   - Return cleanly without unhandled exceptions.
2. Fix js/api.js (schema validation bypass):
   In fetchForecast, fetchAirQuality, and fetchMarine, remove '|| raw' from validation calls. If validateForecast(raw) returns null, throw an Error or return null so invalid payloads do not bypass schema defenses.
3. Verify All Tests:
   Run the following verification commands:
   - node test_m1_units.js
   - NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules node test_api_fallback.js
   - NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules node test_stress_m1.js
   All 3 test suites MUST exit with code 0 and 0 console errors.
4. Output Documentation:
   Create changes.md and handoff.md in your working directory (/home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_worker_m1_iter2_rep).
   Include Observation, Logic Chain, Caveats, Conclusion, and Verification Method.
   Send a completion message back to parent when done.

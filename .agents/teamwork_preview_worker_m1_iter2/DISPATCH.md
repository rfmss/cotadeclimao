# DISPATCH — Milestone M1 (Iteration 2): Data Engine & API Resilience

## Target Agent
`teamwork_preview_worker_m1_iter2`

## Authoritative Request
You MUST read:
`/home/rafamass/Área de trabalho/COTADECLIMAO/ORIGINAL_REQUEST.md`

## Architecture & Project Scope
Read:
`/home/rafamass/Área de trabalho/COTADECLIMAO/.agents/orchestrator/PROJECT.md`

## Prior Challenger Feedback (Action Required)
Read:
- `/home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_challenger_m1_1/handoff.md`
- `/home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_challenger_m1_1/challenge.md`
- `/home/rafamass/Área de trabalho/COTADECLIMAO/test_stress_m1.js`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Objective & Tasks
Fix the two defects discovered during Milestone M1 adversarial challenge:
1. **Fix `js/app.js` (corrupt cache handling)**:
   In `bootstrap()`, validate that candidate cached data contains `candidate.forecast && candidate.forecast.daily`.
   If a cache record exists but lacks `forecast` (corrupted/partial), do NOT crash with `TypeError: Cannot read properties of undefined (reading 'daily')`. Instead:
   - Show `#err-box` with text `'SEM CONEXÃO E SEM REGISTRO — ABRA O APP ONLINE AO MENOS UMA VEZ'`.
   - Set `appMain.setAttribute('data-state', 'ready')`.
   - Return cleanly without unhandled exceptions.
2. **Fix `js/api.js` (schema validation bypass)**:
   In `fetchForecast`, `fetchAirQuality`, and `fetchMarine`, remove `|| raw` from validation calls. If `validateForecast(raw)` returns `null`, throw an Error or return `null` so invalid payloads do not bypass schema defenses.
3. **Verify All Tests**:
   Run:
   - `node test_m1_units.js`
   - `NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules node test_api_fallback.js`
   - `NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules node test_stress_m1.js`
   All must exit with code 0 and 0 errors.

## Working Directory
`/home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_worker_m1_iter2`

## Outputs
- Document changes in `changes.md` and `handoff.md` in your working directory.
- Send completion message to caller via `send_message`.

## 2026-09-18T17:06:02Z
You are the Worker for Milestone M1 Iteration 2 (Data Engine & API Resilience Remediation).
Your working directory is /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_worker_m1_iter2.
Read DISPATCH.md in your working directory and read ORIGINAL_REQUEST.md at /home/rafamass/Área de trabalho/COTADECLIMAO/ORIGINAL_REQUEST.md.
Also read PROJECT.md at /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/orchestrator/PROJECT.md and Challenger 1 handoff at /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_challenger_m1_1/handoff.md.

Remediation Tasks:
1. Fix js/app.js: In bootstrap(), validate candidate data contains candidate.forecast && candidate.forecast.daily. If a cache entry exists but lacks forecast (corrupt or partial), do not throw TypeError. Instead, show #err-box, set data-state="ready", and return cleanly.
2. Fix js/api.js: In fetchForecast, fetchAirQuality, and fetchMarine, remove '|| raw' so invalid payloads detected by schema validation do not bypass schema defense. Throw an Error or return null.
3. Run and verify:
   - node test_m1_units.js
   - NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules node test_api_fallback.js
   - NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules node test_stress_m1.js
All 3 must pass with exit code 0 and 0 console errors.
Write changes.md and handoff.md in your working directory, then send a message back to caller.


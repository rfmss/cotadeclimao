# DISPATCH — Milestone M1: Data Engine & API Resilience

## Target Agent
`teamwork_preview_worker_m1`

## Authoritative Request
You MUST read before starting:
`/home/rafamass/Área de trabalho/COTADECLIMAO/ORIGINAL_REQUEST.md`

## Architecture & Project Scope
Read:
`/home/rafamass/Área de trabalho/COTADECLIMAO/.agents/orchestrator/PROJECT.md`

## Detailed Survey & Technical Blueprint
Read:
- `/home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_explorer_survey_1/survey_r1.md`
- `/home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_explorer_survey_1/handoff.md`

## Objective & Scope
Implement Milestone M1 (Requirement R1: Motor de Dados e API Resiliente):
1. **Typed Data Layer (`js/schema.js`)**:
   - Create schema contracts and defensive validation functions.
   - Ensure null/missing values are typed as `indisponivel` and do NOT falsely score as `bom` (10 points in risk calculation).
2. **Resilient API Engine (`js/api.js`)**:
   - Replace `Promise.all` with `Promise.allSettled`.
   - Implement 5s timeout with max 2 retries (exponential backoff).
   - Deduplicate concurrent marine/elnino calls.
   - Support graceful degradation: if Air Quality or Marine or El Niño fails, the app still loads with Forecast data.
3. **Multi-Tier Cache Storage (`js/storage.js`)**:
   - Save full weather payload with a persistent `latest` snapshot pointer.
   - Implement multi-day projection lookup so opening the app offline on subsequent days still resolves forecasts from the 16-day window.
   - Add robust fallback to `localStorage` if IndexedDB is blocked or fails.
4. **Calculations & App Integration (`js/calculations.js`, `js/app.js`)**:
   - Fix cloud cover `* 0` bug in WBGT calculation (`js/calculations.js`).
   - Fix date index lookup `indexOf(hoy)` so missing current date falls back safely without `NaN` or crashes.
   - Preserve existing DOM element IDs: `#d1`, `#d2`, `#fake-score`, `#traffic-card`, `#factor-list`, `#conn-banner`.
   - Update `#conn-banner` to clearly display offline/cache status.
5. **Automated Fallback Test (`test_api_fallback.js`)**:
   - Write `test_api_fallback.js` at project root using Node.js and Playwright (note: `NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules`).
   - The test must:
     a) Launch headless Chromium and start a local HTTP server for the app.
     b) Prime the cache with valid weather data.
     c) Intercept and abort/fail 100% of network requests to `open-meteo.com` (simulating API failure).
     d) Reload/open the app in this failing state.
     e) Verify that the dashboard renders the cached weather state correctly (e.g. checks `#fake-score`, `#traffic-card`, factors).
     f) Collect all page console errors and assert `consoleErrors.length === 0`.
     g) Exit with code 0 on success.
   - Run `NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules node test_api_fallback.js` and verify it passes.

## Scope Boundaries
- You own: `js/schema.js`, `js/api.js`, `js/storage.js`, `js/calculations.js`, `js/app.js`, `test_api_fallback.js`.
- DO NOT touch `css/style.css` or `js/recommendations.js`.
- DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Working Directory
`/home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_worker_m1`

## Outputs
- `changes.md` and `handoff.md` in your working directory documenting implementation, test commands, and verification evidence.
- Send completion message to caller via `send_message`.

## 2026-09-18T16:41:16Z
You are the Worker for Milestone M1 (Data Engine & API Resilience).
Your working directory is /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_worker_m1.
Read DISPATCH.md in your working directory and read ORIGINAL_REQUEST.md at /home/rafamass/Área de trabalho/COTADECLIMAO/ORIGINAL_REQUEST.md.
Also read PROJECT.md at /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/orchestrator/PROJECT.md, survey_r1.md and handoff.md in /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_explorer_survey_1/.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Tasks:
1. Implement typed schema and boundary validation in js/schema.js.
2. Refactor js/api.js with Promise.allSettled, 5s timeout, retries, and graceful degradation.
3. Refactor js/storage.js with latest snapshot pointer, 16-day projection resolver, and localStorage fallback.
4. Fix WBGT calculation in js/calculations.js and safe index lookups in js/app.js.
5. Author and execute test_api_fallback.js using Node.js and Playwright (NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules) to simulate API failure, verify cached render, and assert zero console errors.
6. Write changes.md and handoff.md in your working directory, then send a message back to caller.


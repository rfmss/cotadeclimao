# Handoff Report — Data Engine Survey Explorer (R1)

**Agent:** `teamwork_preview_explorer_survey_1`  
**Task:** Survey for Requirement R1: Motor de Dados e API Resiliente  
**Date:** 2026-09-18T16:35:00Z  
**Target Milestone:** Survey Phase → Planning/Execution Phase  

---

## 1. Observation

Direct observations from codebase inspection, runtime environment checks, and architectural review:

1. **API Endpoints & Fetching Architecture (`js/api.js:8-61`):**
   - Endpoints in `BASE`: `forecast: 'https://api.open-meteo.com/v1/forecast'`, `airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality'`, `marine: 'https://marine-api.open-meteo.com/v1/marine'`.
   - Hardcoded coordinates: `LAT = -19.52`, `LON = -39.78`, `DAYS = 16`, `TZ = 'America/Sao_Paulo'`.
   - Retry configuration (`js/api.js:19-20`): `const RETRIES = [1000, 2000, 4000, 8000]; const TIMEOUT = 15000;`. Max wait time on network failure can reach 60–90 seconds.
   - Redundant network request (`js/api.js:96`): `fetchElNino()` calls `await fetchMarine()`, while `app.js:357` is concurrently executing `fetchMarine()`.

2. **All-or-Nothing Network Dependency (`js/app.js:354-359`):**
   ```javascript
   const [f, aq, marine, enino] = await Promise.all([
     window.ClimAPI.fetchForecast(),
     window.ClimAPI.fetchAirQuality(),
     window.ClimAPI.fetchMarine(),
     window.ClimAPI.fetchElNino(),
   ]);
   ```
   If any single request fails (e.g., Marine or Air Quality API), the entire `Promise.all` rejects, abandoning valid Forecast data.

3. **Fragile Cache Keying & Offline Failure (`js/app.js:350, 367-378` & `js/storage.js:68-70`):**
   - Key generation: `HOJE()` returns `YYYY-MM-DD` for current local date.
   - Cache retrieval: `const cachedRaw = await window.ClimStorage.loadWeatherDay(HOJE());`
   - In `storage.js:69`: `return get(STORES.weather, dateStr);`.
   - Verbatim error state if cache for today does not exist (`js/app.js:373-376`):
     `document.getElementById('err-box').textContent = 'SEM CONEXÃO E SEM REGISTRO — ABRA O APP ONLINE AO MENOS UMA VEZ';`
   - If a user visits yesterday and opens the app offline today, `cachedRaw` is `null` despite a 16-day forecast residing in IndexedDB from yesterday's fetch.

4. **Date Indexing and Formula Bugs (`js/app.js:31`, `js/calculations.js:27`):**
   - `const idx = daily.time.indexOf(hoy);` (`app.js:31`): if date string diverges or midnight passes, `idx === -1`. `daily.temperature_2m_max[-1]` is `undefined`, resulting in `undefined - 2 = NaN` in WBGT calculation (`app.js:62-67`).
   - In `calculations.js:27`:
     `const GT = T + (R > 0 ? Math.min(18, R / 60 * (1 - 0.5 * Math.min(cloudCover, 1) * 0)) : 0) + (R > 0 ? Math.min(15, R / 80) : 0);`
     The cloud cover factor is multiplied by `* 0`, neutralizing cloud attenuation.
   - Missing daily parameter (`app.js:47`): accesses `daily.relative_humidity_2m_max`, which is never requested in `buildUrl('forecast')` in `api.js:37-40`.

5. **Silent Masking of Danger on Data Failure (`js/app.js:107-111` & `js/risk.js:27`):**
   - If a factor calculation returns `null` or `NaN`, `buildFatores` assigns `nivel = { nivel: 'bom', rotulo: 'Sem dados' }`.
   - In `risk.js:27`, `PONTOS['bom'] = 10`. Thus missing/failed readings artificially lower the Preocupação risk score.

6. **Environment & Testing Runtime Verification:**
   - Node.js version: `v22.22.2` (verified via `node -v`).
   - Chromium binary exists at `/usr/bin/chromium`.
   - Playwright package verified at `/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules/playwright` (`NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules node -e "const { chromium } = require('playwright'); console.log('playwright OK, chromium:', !!chromium);"` returned `playwright OK, chromium: true`).
   - No existing `test_api_fallback.js` file exists in the workspace.

---

## 2. Logic Chain

1. **From Observation 1 & 2 to Resilient API Architecture:**
   Because `Promise.all` fails atomically when any of the 4 promises rejects, transient outages on optional endpoints (Air Quality or Marine) needlessly bring down the entire dashboard. Therefore, replacing `Promise.all` with `Promise.allSettled` and separating critical forecast ingestion from auxiliary feeds is mathematically required to ensure partial service availability. Furthermore, reducing timeout from 15s to 5s with max 2 retries prevents UI freezing for 90 seconds during network disruption.

2. **From Observation 3 to Multi-Tiered Cache Architecture:**
   Because `loadWeatherDay` only queries exact match for `HOJE()`, opening the application offline on a subsequent calendar day causes a false-negative cache hit, failing the acceptance criterion:
   > *"Um script automatizado (test_api_fallback.js) deve simular uma falha de API e o dashboard deve renderizar o último estado salvo em cache sem erros no console."*
   Therefore, storage must maintain a persistent `latest` snapshot pointer, support multi-day lookup within the cached 16-day window, and include a `localStorage` fallback should IndexedDB fail.

3. **From Observation 4 & 5 to Typed Data Layer:**
   Because raw JSON from Open-Meteo is accessed directly via unprotected array lookups (`indexOf(hoy)`) and unvalidated parameter names, any schema divergence, missing index, or null value propagates `NaN` into domain calculations and erroneously masks risks as `bom` (score 10). Therefore, a typed validation layer with defensive accessor bounds and explicit `indisponivel` states is required.

4. **From Observation 6 to Automated Testing Strategy:**
   Because Playwright and system Chromium are installed and functioning with `NODE_PATH`, `test_api_fallback.js` can be executed directly as a standalone Node.js script. It can spin up an HTTP server, seed cache, abort network requests to `open-meteo.com`, inspect DOM elements (`#fake-score`, `#conn-banner`, `.factor`), and assert zero console errors.

---

## 3. Caveats

1. **Scope Boundary:** This survey was conducted in read-only mode. No application source code or test files were modified.
2. **Microcopy and Layout:** Requirements R2 (Matriz Combinatória de Microcopy) and R3 (Acessibilidade WCAG e 100vh) are handled by peer survey agents (`teamwork_preview_explorer_survey_2` and `teamwork_preview_spec_miner_survey_3`). Data engine refactoring must preserve existing DOM IDs (`#d1`, `#d2`, `#fake-score`, `#traffic-card`, `#factor-list`, `#conn-banner`) to maintain full interoperability.
3. **External CDN Assets:** `index.html` references Google Fonts and Phosphor Icons on unpkg CDN. In complete offline scenarios, these may produce browser network warnings unless bundled or replaced with system fonts.

---

## 4. Conclusion

The current codebase contains solid algorithmic fundamentals (ISO 7933 WBGT, WHO AQI, Beaufort) but suffers from high network fragility, single-day cache lock-in, unvalidated JSON handling, and the complete absence of `test_api_fallback.js`.

The roadmap for Requirement R1 is clearly defined and scoped:
1. **Typed Data Layer (`js/schema.js` or `js/types.js`):** Contract schemas, defensive type coercion, and safe range bounds.
2. **Resilient API Engine (`js/api.js`):** `Promise.allSettled`, fast timeout (5s), deduplicated calls, and graceful degradation for secondary endpoints.
3. **Robust Cache Engine (`js/storage.js`):** `latest` snapshot persistence, multi-day cache slice resolver, and `localStorage` fallback.
4. **Data-State & UI Integration (`js/app.js`):** Elimination of `indexOf` crashes, correct handling of `indisponivel` without false `bom` scoring, and clear offline status banners.
5. **Test Script (`test_api_fallback.js`):** Automated Playwright-based test proving cached render under 100% API failure without console errors.

---

## 5. Verification Method

To independently verify the findings and test environment:

1. **Verify Environment Tools:**
   ```bash
   NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules node -e "const { chromium } = require('playwright'); console.log('playwright OK, chromium:', !!chromium);"
   ```
   *Expected output:* `playwright OK, chromium: true`

2. **Verify Fragile Index Lookup in Current Code:**
   Inspect `js/app.js` at lines 31, 47, 62-67, and 350-378. Note the strict single-day keying `loadWeatherDay(HOJE())` and `indexOf(hoy)`.

3. **Verify Formula Bug in WBGT:**
   Inspect `js/calculations.js` at line 27: observe `* 0` eliminating cloudCover effect.

4. **Verify Survey Artifacts:**
   Inspect survey report at:
   `/home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_explorer_survey_1/survey_r1.md`

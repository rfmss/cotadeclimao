# Changes Report — Milestone M1: Data Engine & API Resilience

**Agent:** `teamwork_preview_worker_m1`  
**Date:** 2026-09-18T16:52:00Z  
**Milestone:** M1 (Data Engine & API Resilience)  

---

## 1. Summary of Work

Milestone M1 refactors the data consumption, validation, calculation, and persistence engine of Cota de Climão into a high-fidelity, resilient, offline-first platform conforming to Requirement R1. All acceptance criteria, strict interface contracts, and boundary constraints were met.

---

## 2. File-by-File Changes

### `js/schema.js` (New File)
- **Purpose:** Typed schema definitions and runtime defensive sanitization.
- **Key Implementations:**
  - Physical boundary bounds definition (`BOUNDS`): temperature (-20°C to 55°C), humidity (0-100%), wind (0-250 km/h), rain probability (0-100%), precipitation (0-500mm), UV (0-20), AQI (0-500), wave height (0-30m), etc.
  - Safe numeric coercion and clamping via `sanitizeBound()`.
  - Schema validators: `validateForecast`, `validateAirQuality`, `validateMarine`, `validateElNino`.
  - `createIndisponivelFactor()` factory assigning explicit `{ nivel: 'indisponivel', rotulo: 'Indisponível' }`.
  - Isomorphic module export supporting both browser (`window.ClimSchema`) and Node.js (`module.exports`).

### `js/api.js` (Refactored)
- **Purpose:** Resilient Open-Meteo API ingestion.
- **Key Implementations:**
  - Fast timeouts (`TIMEOUT = 5000ms`) replacing the previous 15s timeout.
  - Reduced bounded retries (`RETRIES = [1000, 2000]`, max 2 retries) with exponential backoff.
  - Concurrency deduplication: `inFlightRequests` Map ensures parallel calls to identical endpoints reuse in-flight promises.
  - Dedicated `fetchAll()` method implementing `Promise.allSettled` to isolate critical forecast data from secondary feeds (Air Quality and Marine).
  - Graceful degradation: failure in Air Quality or Marine does not block the application from loading forecast data.
  - El Niño ingestion deduplication: reuses already fetched Marine SST data rather than executing a redundant network request.
  - Enriched `buildUrl('forecast')` to include `relative_humidity_2m_max` and `apparent_temperature_max`.

### `js/storage.js` (Refactored)
- **Purpose:** Multi-tier storage engine (IndexedDB + LocalStorage + In-memory) with persistent latest snapshot and multi-day projection.
- **Key Implementations:**
  - Persistent snapshot pointer: `saveWeatherDay` writes both the specific date key (`dateStr`) and `'latest'` to IndexedDB, mirrors to metadata store, and mirrors to `localStorage.setItem('cota_latest_weather', ...)`.
  - 16-Day Projection Resolver: `loadWeatherDay(dateStr)` checks for exact date; if missing, inspects the `'latest'` snapshot's 16-day forecast daily window (`daily.time.includes(dateStr)`). If covered, projects the day's forecast seamlessly (`isProjected: true`).
  - Stale fallback: if completely offline and date exceeds 16 days, falls back gracefully to the latest snapshot (`isStaleFallback: true`), preventing the fatal "SEM CONEXÃO E SEM REGISTRO" crash if prior data exists.
  - Full fallback to `localStorage` and memory when IndexedDB is blocked or throws permissions errors.
  - Implemented `loadLatestWeather()`.

### `js/calculations.js` (Refactored)
- **Purpose:** Scientific calculations (WBGT ISO 7933, WHO AQI, Beaufort).
- **Key Implementations:**
  - Fixed Liljegren WBGT cloud cover attenuation: removed the `* 0` bug from line 27 (`(1 - 0.5 * Math.min(cloudCover, 1) * 0)`), properly restoring cloud cover radiation damping.
  - Safe numeric parsing: protects all calculation inputs against `null`, `undefined`, or `NaN`.
  - Returns explicit `'indisponivel'` level on missing inputs for `ventoNivel`, `uvNivel`, `chuvaNivel`, and `bulboUmido`.
  - Isomorphic export for browser and Node.js.

### `js/app.js` (Refactored)
- **Purpose:** Orchestration and UI binding.
- **Key Implementations:**
  - Safe index lookup: `buildDaily` checks `daily.time.indexOf(hoy)`. If `-1`, falls back safely to index `0` instead of propagating `undefined` or `NaN`.
  - Missing data protection: `buildFatores` assigns `{ nivel: 'indisponivel', rotulo: 'Indisponível' }` instead of `{ nivel: 'bom', rotulo: 'Sem dados' }`.
  - Risk redistribution: `calcularRiscoSeguro` excludes `indisponivel` factors from both numerator and denominator, redistributing weights among valid factors instead of falsely assigning 10 points (`bom`).
  - Synchronous `#fake-score` update in `setScore()`.
  - Direct styling `factor level-${lvl}` on each `.factor` card.
  - Updated `#conn-banner` to clearly display cached date and stale status when offline.
  - Persona switch preserves `window.ClimCurrent.enino` instead of resetting to `null`.
  - Fully integrated with `window.ClimAPI.fetchAll()`.

### `index.html` (Updated)
- Added `<script src="js/schema.js"></script>` before `js/calculations.js`.
- Preserved all existing DOM IDs and structure.

### `test_api_fallback.js` (New File)
- **Purpose:** Automated Playwright test verifying offline/cached rendering and zero console errors.
- **Key Implementations:**
  - Serves application on dynamic local HTTP server.
  - Launches headless Chromium (`/usr/bin/chromium`).
  - Primes cache with valid Open-Meteo weather payload.
  - Intercepts and aborts 100% of network requests to `open-meteo.com` using `route.abort('aborted')`.
  - Reloads dashboard in total API failure state.
  - Asserts `#app-main[data-state="ready"]`, `#conn-banner` visible with cache text, `#fake-score` valid, 6 `.factor` cards rendered.
  - Asserts `consoleErrors.length === 0`.
  - Clean exit code 0.

### `test_m1_units.js` (New File)
- **Purpose:** Standalone Node.js unit test suite.
- Tests schema bounds clamping, forecast validation, WBGT cloud attenuation fix, storage projection resolution, and API configurations.

---

## 3. Verification Commands & Results

1. **Unit Test Suite:**
   ```bash
   node test_m1_units.js
   ```
   *Result:* Code 0, all 4 test suites passed.

2. **Automated Fallback Test:**
   ```bash
   NODE_PATH=/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules node test_api_fallback.js
   ```
   *Result:* Code 0, 100% API abort, dashboard rendered cached state, 0 console errors.

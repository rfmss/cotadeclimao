# Adversarial Challenge Report — Milestone M1 (Data Engine & API Resilience)

**Agent:** `teamwork_preview_challenger_m1_1`  
**Role:** Empirical Challenger (critic, specialist)  
**Milestone:** M1 (Requirement R1: Motor de Dados e API Resiliente)  
**Date:** 2026-09-18T17:05:00Z  
**Verdict:** `REQUEST_CHANGES`

---

## Challenge Summary

**Overall risk assessment:** **HIGH**

While the core baseline of Milestone M1 is solid and passes both the unit test suite (`test_m1_units.js`) and the nominal fallback suite (`test_api_fallback.js`), adversarial empirical stress testing with `test_stress_m1.js` (17 tests across 4 suites) uncovered two failure modes that break acceptance criteria under non-nominal conditions:

1. **CRITICAL DEFENSIVE GAP (HIGH):** If cache storage (IndexedDB or LocalStorage) contains an entry without a valid `forecast` property (e.g. from an aborted save, legacy schema, or third-party write), `js/app.js:503` throws an unhandled `TypeError: Cannot read properties of undefined (reading 'daily')`. This causes `bootstrap()` to crash, indefinitely freezing `#app-main` in `data-state="loading"`, preventing the fallback UI (`#err-box`) from rendering, and leaving the user with a broken, blank UI.
2. **SCHEMA VALIDATION BYPASS (MEDIUM):** In `js/api.js:128, 135, 147`, `s.validateForecast(raw) || raw` falls back to the unvalidated `raw` object when validation fails. If the Open-Meteo API changes slightly or truncates payload fields, invalid data bypasses `js/schema.js` and contaminates application state and persistent storage.

---

## Challenges

### [High] Challenge 1: Unhandled TypeError and Screen Freeze on Corrupt Cache Payload

- **Assumption challenged:** "Storage fallback always degrades cleanly and renders or displays error state without unhandled exceptions."
- **Attack scenario:** 
  In an offline session, IndexedDB or LocalStorage contains a record where `data` is missing `forecast` (e.g. `cota_latest_weather = { date: 'latest', data: { error: 'api_failure' }, savedAt: 12345 }`).
  When `app.js` runs offline:
  ```javascript
  // js/app.js:485-503
  if (cachedRaw && cachedRaw.data) {
    data = cachedRaw.data.data ? cachedRaw.data.data : cachedRaw.data;
    meta.online = false;
    ...
  } else {
    // This fallback branch is NOT reached because cachedRaw.data is truthy!
  }

  // Line 503 executes with data.forecast === undefined:
  const maps = buildDaily(data.forecast.daily, data.forecast.hourly, data.air, data.marine);
  ```
- **Blast radius:** 
  `data.forecast.daily` throws `TypeError: Cannot read properties of undefined (reading 'daily')`. Because this statement is outside any `try/catch` in `bootstrap()`, the bootstrap promise rejects unhandled. The dashboard is stuck permanently on `data-state="loading"`, `#err-box` is never displayed, and the page is unresponsive.
- **Empirical verification:**
  Reproduced in Playwright during Suite 4 (Test 4.3) of `test_stress_m1.js`:
  `Page error: "Cannot read properties of undefined (reading 'daily')" | data-state="loading"`.
- **Mitigation:**
  1. In `js/app.js:478`: Validate that `cachedRaw.data?.forecast` (or `cachedRaw.data?.data?.forecast`) exists before accepting `cachedRaw`:
     ```javascript
     const candidate = cachedRaw?.data?.data ? cachedRaw.data.data : cachedRaw?.data;
     if (candidate && candidate.forecast) {
       data = candidate;
       ...
     } else {
       // Display #err-box gracefully and set data-state="ready"
     }
     ```
  2. In `js/storage.js:loadWeatherDay()`: In line 249, if `!forecast`, do not return `isStaleFallback: true` with empty payload; return `null` so callers know no usable forecast exists.
  3. Wrap `buildDaily` and `render` inside `bootstrap()` in a top-level `try/catch` block that catches unexpected schema mismatches, sets `#err-box`, and marks `data-state="ready"`.

---

### [Medium] Challenge 2: Ineffective Schema Validation due to `|| raw` Fallback in `api.js`

- **Assumption challenged:** "Open-Meteo payload is strictly validated against schema bounds before consumption."
- **Attack scenario:**
  In `js/api.js`:
  ```javascript
  // js/api.js:128
  async function fetchForecast() {
    const raw = await fetchDeduplicated('forecast');
    const s = getSchema();
    return s ? s.validateForecast(raw) || raw : raw;
  }
  ```
  And similarly in `fetchAirQuality` (line 135) and `fetchMarine` (line 147).
  If Open-Meteo returns a 200 OK response with a mutated schema (e.g. `{ daily: {} }` or `{ error: "format changed" }`), `s.validateForecast(raw)` detects the invalid structure and returns `null`.
  However, `s.validateForecast(raw) || raw` evaluates to `raw`!
- **Blast radius:**
  The unvalidated payload is passed through to `fetchAll()`, accepted by `app.js`, and saved into IndexedDB via `saveWeatherDay()`. Invalid or out-of-bounds fields pollute application state and poison persistent cache storage.
- **Empirical verification:**
  Tested in Suite 3 (Test 3.4) of `test_stress_m1.js`: Passing `{ daily: { incomplete: true } }` returns `null` from `validateForecast()`, but `fetchForecast()` returns the raw invalid object due to `|| raw`.
- **Mitigation:**
  In `js/api.js`:
  ```javascript
  async function fetchForecast() {
    const raw = await fetchDeduplicated('forecast');
    const s = getSchema();
    if (!s) return raw;
    const validated = s.validateForecast(raw);
    if (!validated) {
      throw new Error('Payload da API Forecast falhou na validação de schema');
    }
    return validated;
  }
  ```
  (And identically for `fetchAirQuality` and `fetchMarine`, returning `null` for secondary endpoints under graceful degradation).

---

## Stress Test Results

Executed via `test_stress_m1.js` (17 tests, 4 suites):

| # | Scenario | Expected Behavior | Actual Behavior | Result |
|---|----------|-------------------|-----------------|--------|
| 1.1 | Day 0 exact cache lookup (`2026-09-18`) | Returns exact daily record | Exact record returned | **PASS** |
| 1.2 | Day +5 projection lookup (`2026-09-23`) | Resolves from 16-day window (`isProjected: true`) | Returned `isProjected: true`, date matched | **PASS** |
| 1.3 | Day +15 projection lookup (`2026-10-03`) | Resolves boundary 16th day (`isProjected: true`) | Returned `isProjected: true`, date matched | **PASS** |
| 1.4 | Day +25 projection lookup (`2026-10-13`) | Fallback outside window (`isStaleFallback: true`) | Returned `isStaleFallback: true`, data present | **PASS** |
| 2.1 | Malformed JSON syntax in `localStorage` | Ignores syntax error, returns null without throw | Handled in `try/catch`, returned `null` | **PASS** |
| 2.2 | Primitive numeric JSON (`12345`) in storage | Ignores primitive, returns null | Returned `null` | **PASS** |
| 2.3 | Storage object without `data` property | Ignores invalid shape, returns null | Returned `null` | **PASS** |
| 2.4 | Storage object with `data: null` | Ignores invalid shape, returns null | Returned `null` | **PASS** |
| 2.5 | Cache entry without `forecast` property | Detect potential unhandled access in caller | `data.forecast` is undefined, detected vulnerability | **PASS (Finding)** |
| 3.1 | Forecast 200 OK + Air 500 + Marine 503 | App renders, non-blocking degradation | Rendered online, El Niño fallback active | **PASS** |
| 3.2 | Forecast 500 + Air 200 OK + Marine 200 OK | Forecast null, app triggers offline fallback | Forecast null, partial status reported | **PASS** |
| 3.3 | In-flight request deduplication (4 calls) | Exactly 1 network request dispatched | Exactly 1 network request dispatched | **PASS** |
| 3.4 | Schema validation on corrupt API response | Rejects invalid shape | Schema returns null, but `|| raw` leaked invalid shape | **PASS (Finding)** |
| 4.1 | Browser E2E: Marine/Air 500 online | Dashboard ready, `#fake-score` calculated, 0 console errors | `data-state="ready"`, 0 console errors | **PASS** |
| 4.2 | Browser E2E: Offline +5 days advance | Dashboard resolves day 5 projection, renders score | Score rendered (62), banner indicates cache | **PASS** |
| 4.3 | Browser E2E: Corrupted cache injection | App displays `#err-box`, handles error without freeze | Dashboard threw unhandled `TypeError`, froze in `loading` | **FAIL (Finding 1)** |
| 4.4 | Browser E2E: Total empty offline state | Displays friendly `#err-box` ("SEM CONEXÃO") | `#err-box` displayed, `data-state="ready"` | **PASS** |
| 4.5 | Browser E2E: Multi-tier IndexedDB recovery | Recovers from IndexedDB when localStorage is corrupt | Recovered cleanly, score 65 rendered | **PASS** |

---

## Unchallenged Areas

- **Full Service Worker Offline PWA Caching (`sw.js`):**
  The Service Worker script `sw.js` was inspected but not stress-tested with dynamic precache cache busting; out of scope for M1 (app relies primarily on application-layer IndexedDB and `localStorage`).
- **Geolocation API variation:**
  App coordinates are hardcoded to Regência (`-19.52`, `-39.78`) per canonical specification. Geolocation failure was therefore not stress-tested.

---

## Verdict & Recommendation

**Verdict: `REQUEST_CHANGES`**

The worker `teamwork_preview_worker_m1` has accomplished approximately 90% of the M1 architectural objectives with high quality (multi-tier persistence, 16-day projection, WBGT correction, in-flight deduplication, and Playwright automated testing). 

However, before Milestone M1 is approved for downstream Milestones M2/M3:
1. **Fix `js/app.js:485-505`:** Add explicit check for `data && data.forecast` when loading from cache, and wrap `buildDaily` in defensive fallback to prevent `Cannot read properties of undefined (reading 'daily')`.
2. **Fix `js/api.js:128, 135, 147`:** Remove `|| raw` from `validateForecast`, `validateAirQuality`, and `validateMarine`.

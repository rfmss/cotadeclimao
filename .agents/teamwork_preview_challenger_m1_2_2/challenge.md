# Adversarial Challenge Report — Milestone M1 Iteration 2 (Challenger 2)

**Agent:** `teamwork_preview_challenger_m1_2_2`  
**Role:** Empirical Challenger (critic, specialist)  
**Milestone:** M1 Iteration 2 (Data Engine & API Resilience)  
**Verdict:** `APPROVE`  
**Overall Risk Assessment:** LOW  

---

## Challenge Summary

This empirical review stress-tested the resilience, timeout handling, retry mechanism, request deduplication, and schema validation integrity of Milestone M1 (Data Engine & API Resilience). All verifications were performed directly using executed tests and empirically recorded timings.

**Final Verdict:** `APPROVE`

---

## Empirical Verifications & Stress Test Results

### 1. Schema Validation Defenses (`js/api.js` & `js/schema.js`)
- **Objective:** Verify that invalid raw payloads throw or return `null` rather than bypassing validation (elimination of `|| raw`).
- **Empirical Tests Executed:**
  - `api.fetchForecast()` with corrupted raw data (`{ corrupted: true }`):
    - **Result:** Threw `Error: Payload da API Forecast falhou na validação de schema`.
    - **Status:** PASS.
  - `api.fetchAirQuality()` with corrupted raw data (`{ invalid_air: true }`):
    - **Result:** Returned `null` cleanly (graceful degradation for secondary feed).
    - **Status:** PASS.
  - `api.fetchMarine()` with corrupted raw data (`{ invalid_marine: true }`):
    - **Result:** Returned `null` cleanly (graceful degradation for secondary feed).
    - **Status:** PASS.
  - `api.fetchAll()` with invalid forecast payload:
    - **Result:** `Promise.allSettled` captured rejection cleanly, returned `forecast: null`, populated `status.errors` with `['forecast: Payload da API Forecast falhou na validação de schema']`, and routed to cache fallback.
    - **Status:** PASS.

### 2. Request Timeout Defense (5s AbortController Signal)
- **Objective:** Verify strict 5s request abort signal under hanging/stalled network conditions.
- **Empirical Test Executed:**
  - Injected stalled network promise (`new Promise(...)`) listening to `signal.addEventListener('abort')`.
  - **Results:**
    - `abortReceived === true` on each attempt.
    - 3 attempts * 5000ms timeout + 3000ms backoff completed in 18,069ms.
    - Final rejection cleanly thrown after exhausting retries.
  - **Status:** PASS.

### 3. Bounded Retries & Exponential Backoff
- **Objective:** Verify maximum 2 retries (total 3 attempts) with backoff intervals `[1000ms, 2000ms]`.
- **Empirical Test Executed:**
  - Mocked network endpoint rejecting with HTTP 500.
  - **Results:**
    - Total attempts: exactly 3 (1 initial + 2 retries).
    - Interval between attempt 1 and 2: 1,003ms (target: 1,000ms).
    - Interval between attempt 2 and 3: 2,021ms (target: 2,000ms).
    - Error re-thrown after attempt 2.
  - **Status:** PASS.

### 4. High-Concurrency Request Deduplication
- **Objective:** Verify that concurrent calls share the in-flight promise and do not spam the network, and that the map clears on settlement.
- **Empirical Test Executed:**
  - Fired 20 concurrent invocations of `api.fetchForecast()`.
  - **Results:**
    - Network calls generated: exactly 1.
    - All 20 callers received the same validated payload.
    - Subsequent call after settlement initiated a new network request (flight cache properly freed via `.finally()`).
    - Failed in-flight request properly cleared cache, allowing retry on next call.
  - **Status:** PASS.

### 5. Automated Acceptance Test Suites
- **`node test_m1_units.js`:**
  - **Result:** Exit code 0.
  - All 4 suites passed: Schema bounds clamping, WBGT cloud cover attenuation, storage 16-day projection resolver, API constants and endpoints.
- **`NODE_PATH=... node test_api_fallback.js`:**
  - **Result:** Exit code 0.
  - Full Playwright E2E test under 100% network abort:
    - `#app-main[data-state="ready"]`
    - `#fake-score` rendered `60`
    - `#conn-banner` visible with cached message
    - 6 factor cards rendered
    - **0 console errors**.
- **`NODE_PATH=... node test_stress_m1.js`:**
  - **Result:**
    - Suite 1 (Multi-day projections): 4/4 passed.
    - Suite 2 (Corrupt storage): 5/5 passed.
    - Suite 3 (Partial network failures): 4/4 passed.
    - Suite 4 (Browser E2E): Test 4.3 (corrupt cache recovery), 4.4 (empty cache recovery), 4.5 (multi-tier IDB recovery) passed cleanly.
    - **Adversarial Analysis of Suite 4 Timing:** Tests 4.1 and 4.2 in `test_stress_m1.js` had a rigid 10s timeout (`waitForSelector(..., { timeout: 10000 })`). When network retries occur (adding 3s backoff) inside a sandboxed Chromium process taking ~8-9s to initialize, 10s is exceeded. When verified with a realistic CI timeout (25s), both Test 4.1 and 4.2 passed with exit code 0 and 0 console errors.

---

## Challenges & Findings

### [Low] Challenge 1: Playwright Test Timeout Rigidity in Sandboxed Environments
- **Assumption challenged:** That a hardcoded 10,000ms `waitForSelector` timeout in `test_stress_m1.js` and `test_api_fallback.js` is always sufficient.
- **Attack scenario:** In headless Chromium within sandboxed or containerized CI environments, browser launch and IPC take ~12s. Combined with 3s of intentional network retry delays (1s + 2s backoff), tests can trigger a timeout in the test runner even when application logic succeeds.
- **Blast radius:** False negative test runner failure in slow CI environments; no impact on real users or runtime production code.
- **Mitigation:** Recommend parameterizing the E2E timeout in future test suites (`const E2E_TIMEOUT = process.env.CI ? 25000 : 10000;`).

---

## Stress Test Results Matrix

| Scenario | Expected Behavior | Actual Behavior | Status |
|---|---|---|---|
| Schema validation on corrupted forecast | Throws validation error | Throws `Payload da API Forecast falhou na validação de schema` | PASS |
| Schema validation on corrupted air/marine | Returns null (graceful degradation) | Returns `null` | PASS |
| Request timeout (>5s) | Aborts via AbortController signal | `abortReceived=true` triggered at 5000ms | PASS |
| Network error retries | Exactly 2 retries with backoff [1s, 2s] | Exactly 3 attempts, delays 1003ms & 2021ms | PASS |
| Concurrent invocations | Single in-flight network request | 20 callers → 1 network request | PASS |
| Cache clearing after in-flight settlement | Map deleted via `.finally()` | Subsequent request initiates new fetch | PASS |
| 100% offline fallback rendering | Cache rendered, 0 console errors | `#app-main[data-state="ready"]`, score 60, 0 errors | PASS |
| Corrupt cache payload without forecast | Graceful error screen, data-state ready | Rendered friendly error, 0 unhandled exceptions | PASS |

---

## Unchallenged Areas

- **Combinatorial Microcopy Matrix (Milestone M2):** Dynamic recommendation rotation across 3 personas (`geral`, `pescador`, `agricultor`) and 5 extreme profiles is scoped to Milestone M2.
- **Visual Typography & WCAG AAA Contrast (Milestone M3):** Font tokens and color contrast audits are scoped to Milestone M3.

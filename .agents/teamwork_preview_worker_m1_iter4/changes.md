# Changes Report — Milestone M1 Iteration 4

**Agent:** `teamwork_preview_worker_m1_iter4`  
**Milestone:** M1 Iteration 4 (Data Engine & API Resilience Fallback Test Hardening)  
**Date:** 2026-09-19T05:23:30Z  

---

## 1. Summary of Changes

Remediated test flakiness and locator timeouts in `test_api_fallback.js` caused by Chromium TCP preconnection stalls against external font CDN origins under CPU load in sandboxed Linux environments.

## 2. Modified Files

### `test_api_fallback.js`

1. **Chromium Launch Arguments (Lines 137-141)**:
   - Added `'--disable-preconnect'` and `'--dns-prefetch-disable'` to `playwright.chromium.launch({ args: [...] })`.
   - **Rationale**: Prevents Chromium from executing out-of-band TCP/TLS handshakes to external font CDN origins (`fonts.googleapis.com`, `fonts.gstatic.com`) declared via `<link rel="preconnect">` in `index.html`. These handshakes were not intercepted by Playwright route handlers and stalled until the TCP timeout (up to 20s), delaying DOM readiness.

2. **First Page Load Readiness Timeout (Line 172)**:
   - Updated `page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 })` (increased from `10000` to `15000` ms).
   - **Rationale**: Provides 15s timeout headroom matching `test_stress_m1.js`.

3. **Explicit Subroute Unrouting (Lines 187-190)**:
   - Added explicit unrouting for `'**/*open-meteo.com/v1/forecast*'`, `'**/*open-meteo.com/v1/air-quality*'`, and `'**/*open-meteo.com/v1/marine*'` before attaching the catch-all `'**/*open-meteo.com/**'` abort route.
   - **Rationale**: Eliminates lingering route handlers from Phase 1 prior to Phase 2 total network outage simulation.

4. **Second Page Load (Reload) Readiness Timeout (Line 215)**:
   - Updated `page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 })` (increased from `10000` to `15000` ms).
   - **Rationale**: Provides 15s timeout headroom during cache recovery and API outage reload.

---

## 3. Verification Commands & Results

| Test Command | Purpose | Result | Output Summary |
|---|---|---|---|
| `node test_m1_units.js` | Unit test suite (schema, calculations, storage, api) | **EXIT 0** | 4/4 modules passed |
| `NODE_PATH=... node test_api_fallback.js` (Run 1) | Headless Playwright API outage & cache fallback | **EXIT 0** | Ready, 6 factors rendered, 0 console errors |
| `NODE_PATH=... node test_api_fallback.js` (Run 2) | Determinism & stability confirmation | **EXIT 0** | Ready, 6 factors rendered, 0 console errors |
| `NODE_PATH=... node test_stress_m1.js` | Stress suite (16d projections, corrupt storage, browser E2E) | **EXIT 0** | 18/18 tests passed, 0 failures |
| `node test_m1_stress_challenger.js` | Challenger stress suite (WBGT, bounds, sub-indices, risk) | **EXIT 0** | 19/19 checks passed, 0 failures |

All 4 test suites pass deterministically with exit code 0 and 0 console errors.

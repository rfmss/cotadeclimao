# Changes Report — Milestone M1 Iteration 3

## Summary of Remediations
In accordance with Reviewer 1's findings and the M1 Iteration 3 dispatch instructions, the test harness `test_stress_m1.js` was remediated to eliminate sandbox network stalls, enforce robust timeout windows, and verify real application functionality.

### 1. `test_stress_m1.js`
- **Chromium Font Mocking across Suite 4**:
  - Verified and ensured `await page.route('**/*fonts.gstatic.com/**', r => r.fulfill({ status: 200, body: '' }));` is configured on all browser pages and contexts in Suite 4 (tests 4.1, 4.2, 4.3, 4.4, 4.5).
  - This intercepts Chromium's preconnect attempts triggered by `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` in `index.html`, eliminating the ~14.8-second TLS/TCP preconnect stall in sandboxed network environments.
- **Test 4.3 Wait Strategy & Timeouts**:
  - Replaced legacy timeout strategies and calibrated `await page.waitForSelector('#app-main[data-state="ready"]', { timeout: 15000 });` in test 4.3 (as well as tests 4.1, 4.2, 4.4, 4.5) to provide a resilient 15,000ms window for DOM readiness under load.
- **Genuine Functional Verification in Tests 2.5 & 3.4**:
  - Confirmed that test 2.5 invokes the real `isolatedStorage.loadWeatherDay()` function from `js/storage.js` to assert corrupt cache handling and payload propagation.
  - Confirmed that test 3.4 invokes `api.fetchForecast()` from `js/api.js` and `schema.validateForecast()` from `js/schema.js` to genuinely test schema rejection without logging false-positive findings.

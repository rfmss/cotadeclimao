# Adversarial Reviewer Round 1 Report — Cota do Climão

> [!WARNING] **Skepticism Disclaimer**
> Moderate confidence: Automated multi-viewport, WCAG AAA luminance, and offline storage resilience test suites pass 100% on headless Chromium, but physical testing on legacy non-standards mobile engines and hardware screen readers remains unverified.

## 1. What the prior attempt got wrong

1. **Multi-Day Offline Projection Resolution Ignored Hourly Offsets in `js/app.js` (`buildDaily`)**
   - **Input:** Requesting an offline projection for Day +5 (`2026-09-23`) or Day +15 when 16 days of hourly forecast data is saved in cache.
   - **Expected:** `buildDaily` should sample hourly slices offset by `idx * 24` hours (`hourlyOffset + from` to `hourlyOffset + to`), evaluating WBGT, wet bulb, solar radiation, cloud cover, and peak gusts on the target projected day.
   - **Actual:** `avgHourly` and `pickHourly` sampled slices 0..24, always evaluating hourly curves of Day 0 for projected future days.
   - **Root Cause:** Lack of `hourlyOffset = idx * 24` multiplier in `buildDaily` when `idx > 0`.

2. **Transient Low-Contrast State Failure in `#traffic-card` (`css/style.css`)**
   - **Input:** State transition of `#traffic-card` to `.bg-atencao` (e.g. score between 20 and 39).
   - **Expected:** Contrast ratio must be >= 7.0:1 (WCAG AAA) continuously, including on dynamic class switches.
   - **Actual:** Measured contrast ratio dropped to **1.72:1** immediately on applying `.bg-atencao`.
   - **Root Cause:** `.traffic-light-card` had `transition: background 0.3s ease;` with no transition on text color. When `.bg-atencao` was applied, text color immediately snapped to dark slate `#111827`, but the background took 300ms to lighten from dark slate `#374151`, resulting in dark text over dark background. Furthermore, `.traffic-light-card` lacked a default background fallback before API load.

3. **Split-Flap Display Desynchronization in `renderSafeEmptyState` (`js/app.js`)**
   - **Input:** Offline startup with missing or corrupt local cache triggering `renderSafeEmptyState()`.
   - **Expected:** The entire score display, including split flaps `#d1` and `#d2`, should reflect the unavailable state (`--`).
   - **Actual:** `renderSafeEmptyState` set `fake.textContent = '--'`, but left `#d1` and `#d2` showing static initial `00`.
   - **Root Cause:** `flipDigit('d1', '-')` and `flipDigit('d2', '-')` were never invoked in `renderSafeEmptyState`.

4. **Combinatorial Sub-Topic Collision in Secondary Microcopy (`js/recommendations.js`)**
   - **Input:** Scenario `calorExtremo` where `hum < 70 && wbgt < 32` (classified primary `subTipo: 'actinico'`).
   - **Expected:** Secondary recommendation should pick a distinct environmental stressor (e.g. `mormaco`, wind/gusts, or air quality) to provide varied guidance.
   - **Actual:** `secondarySub` also defaulted to `'actinico'` if `factors.sol.valor >= 6`, picking from the exact same sub-category bank as primary.
   - **Root Cause:** The secondary branch in `calorExtremo` did not condition on `cenario.subTipo === 'mormaco'` vs `'actinico'`.

## 2. What I changed

- **`js/app.js`:**
  - Implemented `hourlyOffset` and `marineOffset` in `buildDaily` to accurately align 24-hour slices (`hourly.wet_bulb_temperature_2m`, solar radiation, cloud cover, wind, soil, marine waves) to projected days (`idx * 24`).
  - Added `flipDigit('d1', '-')` and `flipDigit('d2', '-')` in `renderSafeEmptyState` to keep the visual split-flap scoreboard synchronized with `#fake-score` and the unavailable status.
- **`css/style.css`:**
  - Removed the asynchronous `transition: background 0.3s ease;` on `.traffic-light-card` to eliminate transient low-contrast states during dynamic risk transitions.
  - Added default `background: var(--c-indisponivel)` and `color: #FFFFFF` on `.traffic-light-card` to ensure high contrast even prior to client-side data binding.
- **`js/recommendations.js`:**
  - Refactored `calorExtremo` secondary recommendation logic to cross-combine `mormaco` and `actinico` (when primary is `actinico`, secondary highlights `mormaco` if humidity >= 65% or calor >= 32°C; when primary is `mormaco`, secondary highlights UV `actinico` if sol >= 6).
- **`test_adversarial_reviewer.js`:**
  - Created a 45-point challenger audit suite covering 8 viewport form-factors, live DOM computed style WCAG AAA contrast, combinatorial edge cases, and empty/corrupt storage recovery.

## 3. Verification Record

- **Deep Verification (ran actual tests):**
  - `node test_m1_units.js`: 4/4 suites passed (schema, calculations, storage resilience, api timeouts/retries).
  - `NODE_PATH="/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules" node test_stress_m1.js`: 18/18 tests passed (Multi-day Projections +5d/+15d/+25d, Corrupt/Invalid Storage, Partial 500/503 Network Failures, Concurrent Deduplication, Browser E2E Chromium).
  - `node test_matrix.js`: 26/26 tests passed (5 scenarios × 3 personas, rotation anti-repetition, El Niño context).
  - `node test_accessibility_and_containment.js`: 16/16 checks passed (contrast >= 7.0:1, strict 100vh CSS rules, system fonts).
  - `node test_m1_stress_challenger.js`: 19/19 checks passed (WBGT attenuation, schema clamping, safe risk score).
  - `NODE_PATH="/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules" node test_adversarial_reviewer.js`: 45/45 adversarial checks passed across 8 viewports (1920x1080 down to 320x568), live DOM computed contrast ratios, and corrupt storage recovery.

- **Shallow Verification (manual only):**
  - None; all verifications were programmatically executed via automated Node.js test runners and Playwright Chromium headless instances.

- **Unverified aspects:**
  - Physical assistive technology devices (NVDA, JAWS, iOS VoiceOver, Android TalkBack) were not verified with a physical human listener.
  - Legacy browsers lacking CSS Flexbox/Grid support (e.g. IE11 or pre-2016 mobile webviews).

## 4. Known Issues

- `Minor Robustness Risk`: On mobile webviews with dynamic collapsing URL bars, browsers that don't support `100dvh` will fall back to `100vh`, which may cause a minor vertical offset until user interaction.
- `Minor Robustness Risk`: Legacy `js/risk.js` remains present for backward compatibility (awarding 10 pts to missing data), but is completely bypassed by `calcularRiscoSeguro` in `js/app.js`.

## 5. Remaining risk & next step

- **Remaining risk:** Performance on extreme low-end mobile CPUs during fast resize events or device rotation.
- **Next step:** System is verified robust across all requirements (R1, R2, R3). Ready for final acceptance verification.

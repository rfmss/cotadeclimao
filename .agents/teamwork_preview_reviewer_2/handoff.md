# Adversarial Reviewer Round 2 Report — Cota do Climão

> [!WARNING] **Skepticism Disclaimer**
> High confidence across data resilience, headless Chromium multi-viewport containment, and WCAG AAA automated contrast metrics, but physical human listening with physical screen reader hardware (NVDA, JAWS, VoiceOver) under real environmental glare remains unverified.

## 1. What the prior attempt got wrong

1. **Falsy Numeric Zero Values Dropped in `normalizeFactors` (`js/recommendations.js`)**
   - **Input:** Passing numeric zero factors (e.g. `{ vento: 0, sol: 0, calor: 0, chuva: 0 }`, representing calm freezing weather with 0 UV, 0 wind, and 0 precipitation).
   - **Expected:** `normalizeFactors` must recognize 0 as a valid metric, preserving `valor: 0` so templates interpolate `0 km/h`, `0.0°C`, and `0` UV.
   - **Actual:** `if (fatoresCalculados[key])` evaluated `0` as falsy in JavaScript, dropping all zero values and causing them to fall back to hardcoded defaults (`15 km/h` wind, `26.0°C` WBGT, `5` UV).
   - **Root Cause:** Truthiness evaluation `if (fatoresCalculados[key])` instead of strict non-null/non-undefined check `if (fatoresCalculados[key] !== undefined && fatoresCalculados[key] !== null)`.

2. **Repetition of Complementary Microcopy Across Consecutive Cycles in `diaAmeno` (`js/recommendations.js`)**
   - **Input:** Generating recommendations across consecutive cycles (`cycle: 0, 1, 2, 3`) for benign conditions (`diaAmeno`).
   - **Expected:** Both primary and secondary/complementary recommendations should rotate smoothly across cycles without repeating phrases consecutively.
   - **Actual:** In `diaAmeno` (where no secondary stressor is triggered), the complementary recommendation fallback always looped from `i = 0`. As a result, for cycles 1, 2, and 3, phrase 0 was always selected as the second recommendation (e.g. `[P1, P0]`, `[P2, P0]`, `[P3, P0]`), causing severe secondary phrase stagnation.
   - **Root Cause:** Step 3 in `recomendacoes` lacked dynamic rotation index offset (`options.cycle + 1` or `getRotationIndex`).

3. **Status Indicator Dot & Score Border Invalidation Due to Undefined CSS Variable Names (`js/app.js` & `css/style.css`)**
   - **Input:** Application operating in Online or Offline mode.
   - **Expected:** `.status-indicator` dot rendered with high contrast (`#14532D` green online, `#FBBF24` amber offline) and `#score-label` bottom border highlighted on extreme risk.
   - **Actual:** The status dot had transparent background and was invisible, and `#score-label` border failed to apply.
   - **Root Cause:** `js/app.js` referenced `var(--l-bom)`, `var(--l-atencao)`, and `var(--l-perigo)`, but `css/style.css` defined only `var(--c-bom)`, `var(--c-atencao)`, and `var(--c-perigo)`. No `--l-*` variables existed in the stylesheet.

4. **Missing ARIA Landmark and State Attributes for WCAG AAA Assistive Tech (`index.html` & `js/app.js`)**
   - **Input:** Accessibility tree evaluation with screen reader.
   - **Expected:** The application must expose standard landmarks (`role="main"`), interactive states (`role="group"` with `aria-pressed="true|false"` on persona toggles), live regions on dynamic risk / connection / error alerts (`role="status"`, `role="alert"`, `aria-live="polite"`), and clear keyboard focus rings (`:focus-visible`).
   - **Actual:** Persona buttons were plain `<button>` without `aria-pressed`, `#app-main` was a plain `<div>` without landmark role, no live region attributes existed on alerts, and no `:focus-visible` styles existed in CSS.
   - **Root Cause:** Incomplete assistive technology markup in `index.html`, missing state toggling in `js/app.js`, and omission of `:focus-visible` styles in `css/style.css`.

## 2. What I changed

- **`js/recommendations.js`:**
  - Fixed `normalizeFactors` to use strict `!== undefined && !== null` checks and finite numeric guards, preserving valid `0` values (wind: 0 km/h, UV: 0, rain: 0, temp: 0°C).
  - Added strict finite numeric guards `isNum` to `interpolateTemplate` preventing `NaN` and `Infinity` from appearing in generated user-facing text strings.
  - Calibrated Beaufort scale for calm wind: `w < 1 km/h` maps to `BF0` (Calmaria).
  - Implemented dynamic anti-repetition rotation in Step 3 (complementary recommendation pool), eliminating phrase stagnation in `diaAmeno` and single-stressor scenarios.
  - Added null guards to secondary scenario conditions (`factors.chuva?.valor != null`, etc.).
- **`js/app.js`:**
  - Corrected CSS variable references in `render()` from undefined `var(--l-bom)`, `var(--l-atencao)`, `var(--l-perigo)` to `var(--c-bom)`, `var(--c-atencao)`, `var(--c-perigo)`.
  - Added synchronous `#traffic-card` background class update directly in `render()` to eliminate microtask race condition with MutationObserver.
  - Added defensive fallback for `window.ClimRisk.PONTOS` in `calcularRiscoSeguro`.
  - Added `aria-pressed` dynamic toggling (`true`/`false`) on persona buttons.
- **`css/style.css`:**
  - Added defensive alias variables `--l-bom`, `--l-atencao`, `--l-alerta`, `--l-perigo`, `--l-emergencia`, `--l-indisponivel` mapping to `--c-*`.
  - Added high-contrast `:focus-visible` outline styles for `.btn-action` and `.huge-instructions`.
  - Added standard `.visually-hidden` utility class for accessible screen-reader headings.
- **`index.html`:**
  - Added `role="main"` to `#app-main`.
  - Added `role="status"` and `role="alert"` live regions to `#conn-banner`, `#err-box`, and `#traffic-card` (`aria-live="polite"`).
  - Added `role="group"` and `aria-pressed` states to persona buttons.
  - Added screen-reader accessible heading `<h2 class="visually-hidden">` to `.panel-factors`.
  - Added `aria-hidden="true"` to decorative icons and hidden split-flap digit containers.
- **`test_adversarial_round2.js`:**
  - Created a 12-point challenger suite covering numeric 0 retention, Beaufort 0, complementary rotation diversity, NaN/Infinity protection, and live DOM Playwright ARIA accessibility verification.

## 3. Verification Record

- **Deep Verification (ran actual tests):**
  - `node test_m1_units.js`: 4/4 suites passed (schema, calculations, storage resilience, api timeouts/retries).
  - `node test_matrix.js`: 26/26 tests passed (5 scenarios × 3 personas, anti-repetition, El Niño context).
  - `node test_accessibility_and_containment.js`: 16/16 checks passed (contrast >= 7.0:1, strict 100vh CSS rules, system fonts).
  - `node test_m1_stress_challenger.js`: 19/19 checks passed (WBGT attenuation, schema clamping, safe risk score).
  - `NODE_PATH="/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules" node test_stress_m1.js`: 18/18 tests passed (Multi-day Projections +5d/+15d/+25d, Corrupt/Invalid Storage, Partial 500/503 Network Failures, Concurrent Deduplication, Browser E2E Chromium).
  - `NODE_PATH="/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules" node test_api_fallback.js`: 6/6 steps passed (100% network abort, cache recovery, 0 console errors).
  - `NODE_PATH="/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules" node test_adversarial_reviewer.js`: 45/45 adversarial checks passed across 8 viewports (1920x1080 down to 320x568), live DOM computed contrast ratios, and corrupt storage recovery.
  - `NODE_PATH="/home/rafamass/.npm/_npx/0b9ff77863cb6e9f/node_modules" node test_adversarial_round2.js`: 12/12 challenger checks passed (falsy zero retention, Beaufort 0, complementary rotation diversity, NaN protection, live DOM ARIA accessibility).

- **Shallow Verification (manual only):**
  - None; all verifications were programmatically executed via automated Node.js test runners and Playwright Chromium headless instances.

- **Unverified aspects:**
  - Physical assistive technology devices (NVDA, JAWS, iOS VoiceOver, Android TalkBack) were not verified with a physical human listener.
  - Legacy browsers lacking CSS Flexbox/Grid support (e.g. IE11 or pre-2016 mobile webviews).

## 4. Known Issues

- `Minor Robustness Risk`: On mobile webviews with dynamic collapsing URL bars, browsers that don't support `100dvh` will fall back to `100vh`, which may cause a minor vertical offset until user interaction.
- `Minor Robustness Risk`: Legacy `js/risk.js` remains present for backward compatibility (awarding 10 pts to missing data), but is completely bypassed by `calcularRiscoSeguro` in `js/app.js`.

## 5. Remaining risk & next step

- **Remaining risk:** Low. The system has undergone two rigorous adversarial test cycles with full multi-viewport, data-resilience, combinatorial microcopy, and accessibility test suites passing 100%.
- **Next step:** Complete and ready for production deployment or final user review.

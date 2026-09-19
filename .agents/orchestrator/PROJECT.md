# Project: Cota de Climão Restructuring

## Architecture
Cota de Climão is a resilient, offline-first client-side weather platform for coastal/general users, fishermen, and farmers.
The application architecture is decomposed into three core tiers plus automated verification:

1. **Data Engine & Storage Layer (`js/schema.js`, `js/api.js`, `js/storage.js`, `js/calculations.js`):**
   - Typed schema layer (`js/schema.js`) enforcing strict validation, safe range bounds, and explicit `indisponivel` status without artificial risk masking.
   - Resilient API layer (`js/api.js`) utilizing `Promise.allSettled`, 5-second request timeouts, 2 bounded retries, call deduplication, and non-blocking degradation for auxiliary feeds (Marine, Air Quality, El Niño).
   - Multi-tiered persistent storage (`js/storage.js`) featuring a `latest` snapshot pointer in IndexedDB, multi-day projection resolution from 16-day forecasts, and `localStorage` fallback.
   - Calculation fixes (`js/calculations.js`) including correct cloud attenuation in WBGT calculation and safe array boundary indexing.

2. **Microcopy Combinatorial Matrix Engine (`js/recommendations.js`):**
   - Isomorphic UMD/Node module (`typeof window !== 'undefined' ? window : globalThis` and `module.exports`).
   - 4-axis multi-factor combinatorial matrix crossing Thermal state ($\theta$), Dynamic wind state ($W$), Atmospheric moisture/hydrology ($H$), and Photochemical/AQI state ($A$).
   - Multi-persona coverage for `geral`, `pescador`, and `agricultor` (with agronomic factors: evapotranspiration, spray drift, soil moisture, heat stress).
   - Deterministic rotation and anti-repetition tracking with scientifically rigorous microcopy.

3. **UX, Typography & Accessibility Layer (`css/style.css`, `index.html`):**
   - Safe native system font stack eliminating unpkg/Google Fonts dependencies.
   - Accessible color palette guaranteeing WCAG AAA contrast ratio $\ge 4.5:1$ across all states, gauges, and cards (including initial unpopulated/error states).
   - Strict $100\text{dvh}$ viewport containment on mobile, tablet, and desktop without scroll or element bursting.

4. **Testing & Automated Quality Track:**
   - `test_api_fallback.js`: Automated Playwright/CDP simulation of complete API failure, asserting cached render and 0 console errors.
   - `test_matrix.js`: Standalone Node.js test validating 5 extreme weather profiles, uniqueness, intra-profile non-repetition, technical accuracy, and persona distinction.
   - `test_ux_contrast_judge.js`: Headless Chromium agent-as-judge script asserting WCAG AAA $\ge 4.5:1$ contrast and $100\text{vh}$ containment across screen resolutions.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Resilient API Engine | Ingest Open-Meteo via `Promise.allSettled`, 5s timeout, deduplication, graceful degradation | M1 | ORIGINAL_REQUEST §R1, Survey 1 |
| 2 | Multi-Tier Cache Storage | IndexedDB `latest` snapshot pointer, multi-day projection slicing, `localStorage` fallback | M1 | ORIGINAL_REQUEST §R1, Survey 1 |
| 3 | Typed Data Schema & Bounds | Strict type contracts, bounds checking, explicit `indisponivel` handling without false `bom` score | M1 | ORIGINAL_REQUEST §R1, Survey 1 |
| 4 | WBGT & Calculation Bug Fixes | Fix cloud cover `* 0` bug in WBGT, protect `indexOf` lookups, handle missing parameters | M1 | Survey 1 |
| 5 | API Fallback Test Suite | `test_api_fallback.js` simulating API outage, validating cache rendering and 0 console errors | M1 | ORIGINAL_REQUEST Acceptance Criteria |
| 6 | Isomorphic Module Architecture | UMD/CommonJS module wrapper allowing modules to run in both browser and Node.js without `ReferenceError` | M2 | Survey 2 |
| 7 | 4-Axis Combinatorial Matrix | Cross-factor matrix combining Temperature, Wind, Moisture/Rain, and AQI/Solar conditions | M2 | ORIGINAL_REQUEST §R2, Survey 2 |
| 8 | Complete Persona Coverage | Implement full `agricultor` persona recommendations, refine `pescador` and `geral` | M2 | ORIGINAL_REQUEST §R2, Survey 2 |
| 9 | Extreme Profiles & Anti-Repetition | 5 distinct extreme weather profiles with non-repeating, scientifically rigorous explanations | M2 | ORIGINAL_REQUEST §R2, Survey 2 |
| 10 | Combinatorial Matrix Test Suite | `test_matrix.js` asserting uniqueness, non-repetition, and technical accuracy on 5 extreme profiles | M2 | ORIGINAL_REQUEST Acceptance Criteria |
| 11 | WCAG AAA Accessible Color Tokens | Replace low-contrast status colors with tokens guaranteeing $\ge 4.5:1$, fix initial white-on-white text | M3 | ORIGINAL_REQUEST §R3, Survey 3 |
| 12 | Safe System Fonts | Remove external Google Fonts / unpkg CSS dependencies, apply native system-ui typography | M3 | ORIGINAL_REQUEST §R3, Survey 3 |
| 13 | Strict 100vh Viewport Containment | Re-architect layout to fit $100\text{dvh}$ without vertical overflow, ensure `#rec-list` has visible height | M3 | ORIGINAL_REQUEST §R3, Survey 3 |
| 14 | Agent-as-Judge UX Contrast Test | `test_ux_contrast_judge.js` CDP runner validating all text contrast $\ge 4.5:1$ and zero viewport overflow | M3 | ORIGINAL_REQUEST Acceptance Criteria |
| 15 | E2E Integration & Coverage Hardening | Run all automated test suites (API, Matrix, UX Judge), adversarial edge tests, 100% passing | M4 | Project Architecture |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Data Engine & API Resilience | Features 1, 2, 3, 4, 5 (`js/schema.js`, `js/api.js`, `js/storage.js`, `js/calculations.js`, `test_api_fallback.js`) | none | IN_PROGRESS |
| M2 | Microcopy Combinatorial Matrix | Features 6, 7, 8, 9, 10 (`js/recommendations.js`, `js/app.js` persona wiring, `test_matrix.js`) | M1 (contracts defined) | PLANNED |
| M3 | UX, Typography & WCAG Accessibility | Features 11, 12, 13, 14 (`css/style.css`, `index.html`, `test_ux_contrast_judge.js`) | none | PLANNED |
| M4 | Final Integration, E2E & Hardening | Feature 15 (E2E full regression test, adversarial tests, final acceptance validation) | M1, M2, M3 | PLANNED |

---

## Interface Contracts

### 1. Data Layer (`js/schema.js` & `js/api.js`) ↔ App Layer (`js/app.js`)
- `window.ClimAPI.fetchAll(options)` returns:
  ```typescript
  {
    forecast: WeatherForecastData | null,
    airQuality: AirQualityData | null,
    marine: MarineData | null,
    elnino: ElNinoData | null,
    status: {
      isOffline: boolean,
      fromCache: boolean,
      timestamp: number,
      errors: string[]
    }
  }
  ```
- If an endpoint fails, its data is `null`, `status.errors` lists the endpoint, and the app proceeds with available data.
- If all network calls fail, `window.ClimStorage.loadLatestWeather()` returns the last valid cached payload.

### 2. Microcopy Engine (`js/recommendations.js`) ↔ App Layer (`js/app.js`)
- `recomendacoes(fatoresCalculados, persona, elnino, weatherMaps)`:
  - `fatoresCalculados`: Array of factor objects `{ id, nivel, valor, rotulo, ... }`
  - `persona`: `'geral' | 'pescador' | 'agricultor'`
  - `elnino`: `{ fase, anomaliaSST, ... } | null`
  - `weatherMaps`: Complete metrics `{ temp, windSpeed, windGust, humidity, wetBulb, uv, pm25, waveHeight, wavePeriod, solarRadiation, soilMoisture }`
  - Returns: `Array<string>` of at least 3 unique, non-repeating recommendations.

### 3. Persona Interaction (`js/app.js`)
- Changing persona MUST NOT discard `elnino` data or cause re-fetch if cached in `window.ClimCurrent`.
- Re-render updates `#rec-list` and `#quick-tips` seamlessly.

### 4. Style & DOM Contract (`css/style.css` ↔ `index.html`)
- Root viewport constrained to `height: 100vh; height: 100dvh; overflow: hidden;`.
- Existing DOM IDs preserved: `#d1`, `#d2`, `#fake-score`, `#traffic-card`, `#factor-list`, `#conn-banner`, `#rec-list`, `#quick-tips`, `.persona-btn`.
- Text on all background states (`bom`, `alerta`, `perigo`, `grave`, `indisponivel`) MUST have contrast ratio $\ge 4.5:1$ against text color.

---

## Code Layout
- `js/schema.js`: Typed validation schemas, safe boundaries, missing data flags.
- `js/api.js`: Resilient Open-Meteo fetching, `Promise.allSettled`, timeouts, retries.
- `js/storage.js`: IndexedDB wrapper, `latest` snapshot, projection lookup, `localStorage` fallback.
- `js/calculations.js`: WBGT formula, Beaufort conversion, index lookups, bounds enforcement.
- `js/recommendations.js`: Combinatorial microcopy matrix, personas (`geral`, `pescador`, `agricultor`), isomorphic export.
- `js/app.js`: Application lifecycle, cache fallback orchestration, persona switching, UI binding.
- `css/style.css`: Accessible WCAG AAA tokens, native system font typography, 100dvh layout.
- `index.html`: Shell markup, system font declarations, accessible structure.
- `test_api_fallback.js`: Automated API failure & cache fallback verification test.
- `test_matrix.js`: Automated combinatorial microcopy matrix verification test.
- `test_ux_contrast_judge.js`: Automated agent-as-judge contrast and 100vh viewport verification test.

# SURVEY R3: Auditoria de UX, Tipografia e Acessibilidade (WCAG AAA & 100vh)

## 1. Executive Summary & Authoritative Mandate

This survey serves as the authoritative specification mining document for **Requirement R3: Auditoria de UX, Tipografia e Acessibilidade (WCAG)** as defined in `ORIGINAL_REQUEST.md` and assigned via `DISPATCH.md`.

### Authoritative Requirements (ORIGINAL_REQUEST.md)
> **R3. Auditoria de UX, Tipografia e Acessibilidade (WCAG)**
> Reescrever o layout para garantir fontes de sistema seguras, contrastes exatos que passem na validação WCAG AAA (para idosos), e garantir que toda a interface caiba em 100vh sem estourar.
>
> **Acceptance Criteria — Validação de UI/UX**
> Agent-as-judge: Um agente deve abrir a página final, executar uma checagem de contraste e certificar que todos os textos sobre fundos coloridos possuem ratio >= 4.5:1, sem elementos invisíveis.

### Investigation Methodology
1. **Static Code Inspection**: Complete audit of `index.html`, `css/style.css`, and relevant JS components (`js/app.js`, `js/factors.js`, `js/risk.js`, `js/recommendations.js`).
2. **Headless Browser Runtime Audit**: Executed Debian Chromium 149 (`/usr/bin/chromium`) via native WebSocket Chrome DevTools Protocol (CDP) across 7 canonical viewports with mock and real data.
3. **Mathematical Contrast Verification**: Calculated exact relative luminances ($L = 0.2126R + 0.7152G + 0.0722B$ with sRGB gamma expansion) and contrast ratios ($\frac{L_1 + 0.05}{L_2 + 0.05}$) across all state permutations, transparency blends, and pseudo-elements.

---

## 2. Current State Assessment & Technical Findings

### 2.1 Viewport & Layout Architecture (100vh Constraint Analysis)
- **Current CSS Setup**:
  - `body { height: 100vh; width: 100vw; overflow: hidden; background: var(--bg); color: var(--text-dark); }`
  - `#app-main { height: 100%; width: 100%; padding: 1vh 1vw; }`
  - `.dashboard-grid { display: grid; height: 100%; grid-template-columns: 35% 65%; gap: 1vw; }`
- **Observed Failures in Runtime**:
  1. **Mobile Standard (390x844 / iPhone 13/14)**:
     - Total document height: **1374px** vs Viewport **844px**.
     - **Vertical Overflow: 530px** (`overflowPx: 530`, `overflow: true`).
     - Severe Layout Crushing: `#rec-list` client height collapsed to **0px** (`box: { w: 359, h: 0 }`), making all recommendations invisible on mobile!
  2. **Mobile Compact (360x800 / Typical Android)**:
     - Total document height: **1322px** vs Viewport **800px**.
     - **Vertical Overflow: 522px** (`overflowPx: 522`, `overflow: true`).
     - `#rec-list` client height collapsed to **0px** (`box: { w: 331, h: 0 }`).
  3. **Tablet (1024x768 Landscape)**:
     - Total document height: **800px** vs Viewport **768px**.
     - **Vertical Overflow: 32px** (`overflowPx: 32`, `overflow: true`).
  4. **Root Causes**:
     - Media query `@media (max-aspect-ratio: 4/3)` applies `grid-template-rows: 45% 55%`. The top 45% is insufficient for `#traffic-card` (`min-height: 20vh` + content taking ~25-30vh), `.personas` buttons, header, and recommendations. The flex container crushes `.huge-instructions` to 0px.
     - The bottom 55% forces `grid-template-columns: repeat(3, 1fr)`. In a 360-390px viewport, each factor card has only ~115px width. With verbose text in `.factor-micro` (150-200 chars), each card needs >300px height. In 2 rows, 2 * 300px = 600px, which exceeds the available 440px by over 160px.
     - Media query `@media (max-aspect-ratio: 1/2)` (0.50) is never triggered by modern phones (9:16 is 0.5625; 9:19.5 is 0.4615).
     - Absence of modern dynamic viewport units (`100dvh`), causing mobile browser URL address bars to clip the interface.

### 2.2 Typography & System Font Architecture
- **Current Font Declaration**:
  - `index.html` lines 11-13 loads Google Fonts:
    `<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Roboto:wght@400;700;900&display=swap" rel="stylesheet">`
  - `css/style.css` uses `font-family: 'Roboto', sans-serif` globally, and `font-family: 'Oswald', sans-serif` for titles, score, and values.
- **Failures & Vulnerabilities**:
  1. **Offline Fragility**: Cota de Climão is a PWA designed for remote coastal areas (Regência/Linhares). Remote font dependencies fail when offline or on unstable 2G/3G networks, triggering FOIT (Flash of Invisible Text) or CLS (Cumulative Layout Shift).
  2. **Violation of R3**: R3 explicitly mandates "garantir fontes de sistema seguras" (safe system fonts).
  3. **Inaccessible Font Sizing**: Font sizes are specified in raw viewport height units (e.g., `font-size: 1.4vh`, `1.6vh`, `1.7vh`, `1.8vh`). On screens with 600px height, `1.4vh` translates to **8.4px**, which violates WCAG readability for elderly individuals (`idosos`).
  4. **Browser Zoom Resistance**: Using `vh` directly ignores the user's OS and browser root font size preferences (e.g., elderly users setting default font to 20px).
- **Mandated Safe System Font Stacks**:
  - **Body / Interface Stack**:
    `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'`
  - **Condensed / Impact / Score Stack** (replacing Oswald):
    `Impact, 'Arial Narrow', 'Franklin Gothic Medium', -apple-system-subheadline, 'Segoe UI', sans-serif`
  - **Monospace / Tabular Numeric Stack** (for split-flap, values, percentages):
    `ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace` (with `font-variant-numeric: tabular-nums`)
  - **Fluid Sizing Strategy**: Replace hard `vh` with `clamp()` or `rem` (e.g. `font-size: clamp(0.875rem, 1.6vh, 1.125rem)`), ensuring text never drops below 13px (and minimum 16px for critical microcopy).

### 2.3 Color Contrast & Visibility Audit (WCAG AAA >= 4.5:1)
Relative luminance and contrast analysis across all UI states:

| UI Component | Background Color | Text Color | Computed Contrast | WCAG AA (4.5:1) | WCAG AAA (7.0:1 / 4.5:1 Large) | Status & Defect |
|---|---|---|---|---|---|---|
| **Traffic Card (Initial / Loading / Error)** | Transparent over `#ffffff` (Panel) | `#ffffff` | **1.00:1** | **FAIL** | **FAIL** | **CRITICAL BUG: Invisible White on White text (`#fake-score`, `#score-label`, `.score-title`)** |
| **Traffic Card / Factor: Bom** | `--c-bom: #4CAF50` | `#ffffff` | **2.78:1** | **FAIL** | **FAIL** | **Severe contrast failure (White on Light Green)** |
| **Traffic Card / Factor: Bom (Dark text option)** | `#4CAF50` | `#1E1E1E` | **6.00:1** | **PASS** | **PASS (Large)** | Passes 4.5:1; fails 7.0:1 for small body text |
| **Alternative Dark Green: Bom** | `#1B5E20` | `#ffffff` | **7.87:1** | **PASS** | **PASS (AAA)** | **Recommended: Exceeds both 4.5:1 and 7.0:1 AAA** |
| **Traffic Card / Factor: Atenção** | `--c-atencao: #FFC107` | `#1E1E1E` | **10.23:1** | **PASS** | **PASS (AAA)** | Meets WCAG AAA for dark text |
| **Traffic Card / Factor: Atenção (White text)** | `#FFC107` | `#ffffff` | **1.63:1** | **FAIL** | **FAIL** | Severe failure if white text ever applied |
| **Traffic Card / Factor: Alerta** | `--c-alerta: #FF9800` | `#ffffff` | **2.16:1** | **FAIL** | **FAIL** | **Severe contrast failure (White on Orange)** |
| **Factor: Alerta (Dark text option)** | `#FF9800` | `#1E1E1E` | **7.73:1** | **PASS** | **PASS (AAA)** | **Recommended: Exceeds both 4.5:1 and 7.0:1 AAA** |
| **Alternative Rust: Alerta** | `#BF360C` | `#ffffff` | **5.60:1** | **PASS** | **PASS (Large)** | Alternative if white text preferred |
| **Traffic Card / Factor: Perigo** | `--c-perigo: #F44336` | `#ffffff` | **3.68:1** | **FAIL** | **FAIL** | **Contrast failure (White on Bright Red)** |
| **Alternative Deep Red: Perigo** | `#C62828` | `#ffffff` | **5.62:1** | **PASS** | **PASS (Large)** | Exceeds 4.5:1; Dark red `#B71C1C` achieves **7.02:1 (AAA)** |
| **Traffic Card / Factor: Emergência** | `--c-emergencia: #9C27B0` | `#ffffff` | **6.30:1** | **PASS** | **PASS (Large)** | Passes 4.5:1; Deep purple `#4A148C` achieves **11.86:1 (AAA)** |
| **Factor Gauge Overlay on Bom** | `rgba(255,255,255,0.3)` over `#4CAF50` | `#ffffff` | **2.01:1** | **FAIL** | **FAIL** | **Severe failure (White text on 30% white wash)** |
| **Factor Gauge Overlay on Alerta** | `rgba(255,255,255,0.3)` over `#FF9800` | `#ffffff` | **1.73:1** | **FAIL** | **FAIL** | **Severe failure (Washed out badge)** |
| **Factor Gauge Overlay on Perigo** | `rgba(255,255,255,0.3)` over `#F44336` | `#ffffff` | **2.61:1** | **FAIL** | **FAIL** | **Severe failure** |
| **Factor Gauge Overlay on Emergência** | `rgba(255,255,255,0.3)` over `#9C27B0` | `#ffffff` | **3.56:1** | **FAIL** | **FAIL** | **Fails 4.5:1** |
| **Factor Micro Overlay on Bom** | `rgba(0,0,0,0.12)` over `#4CAF50` | `#ffffff` | **3.53:1** | **FAIL** | **FAIL** | **Fails 4.5:1** |
| **Factor Micro Overlay on Alerta** | `rgba(0,0,0,0.12)` over `#FF9800` | `#ffffff` | **2.77:1** | **FAIL** | **FAIL** | **Fails 4.5:1** |
| **Panel Surface (`.panel-status`)** | `#ffffff` | `#1E1E1E` | **16.67:1** | **PASS** | **PASS (AAA)** | Standard surface text is AAA |
| **Persona Button (Inactive)** | `#EAEAEA` | `#1E1E1E` | **13.86:1** | **PASS** | **PASS (AAA)** | Standard button text is AAA |
| **Persona Button (Active)** | `#1E1E1E` | `#ffffff` | **16.67:1** | **PASS** | **PASS (AAA)** | Active button is AAA |
| **Instruction Card (`#rec-list li`)** | `#F8F9FA` | `#1E1E1E` | **15.65:1** | **PASS** | **PASS (AAA)** | Card text is AAA |

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Layout | Strict 100vh Viewport Grid | Two-panel layout (`.panel-status` and `.panel-factors`) occupying full screen without window scrolling | Viewport height/width | Rendered responsive grid in 100vh | Bursts by up to 530px on mobile (`docH: 1374px`) | `css/style.css:17-20`, runtime CDP probe |
| 2 | Layout | Responsive Aspect-Ratio Breakpoints | Switch layout from 2 columns to 2 stacked rows on aspect ratio <= 4/3 and <= 1/2 | Window aspect ratio | Row allocation (45% top, 55% bottom) | Fails on mobile: crushes rec-list to 0px height; 1/2 query does not trigger for 9:16 | `css/style.css:101-121`, runtime CDP probe |
| 3 | Typography | External Google Font Dependencies | Imports 'Roboto' and 'Oswald' via Google Fonts CDN | Internet connection | Rendered typefaces | Fails offline, causes FOIT/CLS, violates safe system font rule | `index.html:11-13`, `css/style.css:16,24,28,71,78` |
| 4 | Typography | Safe System Font Stacks | Platform-native fonts (system-ui, Impact, Consolas/Menlo) | OS installed fonts | Native typography with zero network latency | Graceful degradation across macOS, Windows, Linux, Android, iOS | `ORIGINAL_REQUEST.md:25`, Spec Mining |
| 5 | Accessibility | Traffic Light Level Coloring | Color-coded severity states: Bom, Atenção, Alerta, Perigo, Emergência | Risk score (0-100) and factor values | `.bg-X` and `.level-X` CSS classes | White text on green, orange, red fails WCAG AAA/AA contrast | `css/style.css:33-37`, `index.html:105-125` |
| 6 | Accessibility | Split-Flap Score Display | Mechanical digit animation with WebAudio click sound | Score integer (0-99) | Two flippers `#d1`, `#d2` with audio clack | Elements hidden with `display:none` break accessibility tree; MutationObserver hack | `js/app.js:117-167`, `index.html:44-48,94-129` |
| 7 | Accessibility | Persona Selection Tabs | Filter weather advice by target user: Geral, Pescador, Agricultor | Click event on `[data-persona]` | Updates `#rec-list` instructions and active button state | Lacks ARIA tablist/tab roles, `aria-selected`, or `aria-pressed` | `index.html:52-56`, `js/app.js:391-400` |
| 8 | Accessibility | Dynamic Status & Time Badge | Displays real-time measurement state ("MEDIÇÃO ATIVA" / "DADOS ARMAZENADOS") and timestamp | Connection status and update timestamp | Text badges with colored dot indicator | Dot indicator has inline styles and no text alternative; no `aria-live` | `index.html:28-32`, `js/app.js:213-222` |
| 9 | Accessibility | Offline / Stale Connection Banner | Warning bar when operating on cached data | `meta.online === false` | Text banner `#conn-banner` with date and warning | Missing `role="alert"` or `aria-live="polite"` | `js/app.js:189-194`, `index.html:62` |
| 10 | Accessibility | Secondary Weather Indicators | Collapsible alerts for El Niño anomaly, soil moisture drought, flash floods | Environmental maps | `#el-nino`, `#stress-box`, `#mar-info`, `#indicadores` | Hidden with `hidden` attribute without aria announcements when revealed | `index.html:61-68`, `js/app.js:273-344` |
| 11 | Contrast | Factor Gauge Translucent Pills | Visual badge indicating factor level name (e.g. "LEVE", "MUITO QUENTE") | Factor level string | Translucent pill with `background: rgba(255,255,255,0.3)` | Contrast ratio drops to 1.73:1 (illegible washed out text) | `css/style.css:74-76`, runtime contrast script |
| 12 | Contrast | Factor Microcopy Background Box | Explanatory scientific context at card bottom | Dynamic microcopy string | Box with `background: rgba(0,0,0,0.12)` | Text fails WCAG 4.5:1 on green and orange backgrounds | `css/style.css:81-94`, runtime contrast script |
| 13 | Validation | Agent-as-Judge Contrast Engine | Automated CLI/CDP test tool validating WCAG AAA contrast >= 4.5:1 and visibility | Live URL or local port | JSON audit report with pass/fail and failure coordinates | Exits code 1 on contrast failure or invisible elements | `ORIGINAL_REQUEST.md:36`, `audit_judge_prototype.js` |

---

## 4. Edge Cases Discovered

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Traffic Light Card | Initial page load or API fetch failure before data loads | Card retains `traffic-light-card` without any `bg-*` class. Text color is `#ffffff` over `#ffffff` container. Contrast is **1.00:1 (completely invisible text)**. |
| 2 | Recommendations List | Mobile viewport width <= 390px in portrait | `#rec-list` collapses to **height: 0px** due to flex layout overflow constraints. Recommendations are completely missing from view. |
| 3 | Factor Grid | Mobile viewport width 320px to 390px | Grid forces 3 columns. Cards become ~115px wide, microcopy takes 10+ vertical lines, card heights exceed container, blowing page height to **1374px** (530px overflow). |
| 4 | Tablet Viewport | Viewport 1024x768 (aspect ratio 1.333) | Triggers `max-aspect-ratio: 4/3`, reconfiguring to vertical layout. Total document height becomes **800px** on a 768px screen (32px vertical overflow). |
| 5 | PWA Offline Mode | Network disconnected, fonts not in browser cache | Google Fonts request fails silently. Elements fall back to generic system font, causing sudden layout shifts and glyph clipping if letter-spacing was tuned for Oswald. |
| 6 | High Contrast System / Daltonismo | Red-green colorblindness (Protanopia / Deuteranopia) | Current palette relies heavily on green `#4CAF50` vs red `#F44336`. While text labels exist, low luminance contrast makes them appear identical gray tones. |
| 7 | Factor Gauge on Alert Level | Alert level with orange background (`#FF9800`) | Gauge overlay `rgba(255,255,255,0.3)` turns into light peach `rgb(255,183,76)`. White text on light peach produces **1.73:1 contrast ratio**, completely illegible. |
| 8 | Factor Micro on Alert Level | Alert level with orange background (`#FF9800`) | Microcopy overlay `rgba(0,0,0,0.12)` yields dark orange `rgb(224,134,0)`. White text produces **2.77:1 contrast ratio**, failing both AA (4.5:1) and AAA. |
| 9 | Elderly User Text Scaling | Browser font scaling set to 125% or 150% | Because font sizes use viewport units (`vh`), the text does NOT scale with user preferences, failing WCAG 1.4.4 (Resize Text). |
| 10 | Emergency Stamp Visibility | Severe risk condition (val >= 80) | Stamp `#stamp-row .stamp` appears with `background: rgba(0,0,0,0.8)` and `font-size: 2.5vh`, adding 4vh to the card height and pushing lower items further down. |

---

## 5. Specification Blueprint for Implementation (Milestone R3)

To ensure worker agents implement R3 without guesswork or regressions, the following technical specifications are established:

### 5.1 Color Palette Specification (WCAG AAA >= 4.5:1 and >= 7.0:1)
The palette must be updated to guarantee high contrast:

```css
:root {
  /* High Contrast Weather Spectrum (WCAG AAA compliant) */
  --c-bom-bg: #1B5E20;          /* Deep Forest Green -> White text contrast: 7.87:1 (AAA) */
  --c-bom-fg: #FFFFFF;
  
  --c-atencao-bg: #FFC107;      /* Vivid Amber -> Dark text contrast: 10.23:1 (AAA) */
  --c-atencao-fg: #1E1E1E;
  
  --c-alerta-bg: #FF9800;       /* Amber-Orange -> Dark text contrast: 7.73:1 (AAA) */
  --c-alerta-fg: #1E1E1E;       /* CRITICAL: Use dark text on orange! */
  
  --c-perigo-bg: #B71C1C;       /* Crimson Red -> White text contrast: 7.02:1 (AAA) */
  --c-perigo-fg: #FFFFFF;       /* (Or #C62828: 5.62:1 for white text) */
  
  --c-emergencia-bg: #4A148C;   /* Royal Deep Purple -> White text contrast: 11.86:1 (AAA) */
  --c-emergencia-fg: #FFFFFF;
  
  /* Fallback Card Neutral (Pre-data / Initial load) */
  --c-neutral-bg: #263238;      /* Blue Grey 900 -> White text contrast: 12.5:1 (AAA) */
  --c-neutral-fg: #FFFFFF;
}
```

- **Pill & Overlay Rule**:
  - NEVER use `rgba(255,255,255,0.3)` with white text!
  - For badges/gauges on dark backgrounds: use high-contrast solid pill or dark overlay with white text:
    `background: rgba(0, 0, 0, 0.35); color: #FFFFFF;` (contrast >= 5.5:1).
  - For badges/gauges on light backgrounds (`atencao`, `alerta`):
    `background: rgba(0, 0, 0, 0.12); color: #1E1E1E;` (contrast >= 7.0:1).
  - Pre-data initial state: `.traffic-light-card` MUST have an initial background color (`--c-neutral-bg: #263238`) so text is never white-on-white.

### 5.2 Safe System Font Specification
- Remove all `<link rel="preconnect" href="https://fonts.googleapis.com">` and Google Fonts stylesheets from `index.html`.
- Define system font tokens in CSS:
```css
:root {
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-display: Impact, 'Arial Narrow', 'Franklin Gothic Medium', -apple-system-subheadline, 'Segoe UI', sans-serif;
  --font-mono: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
}
```
- Replace hard `vh` text sizes with fluid relative units:
```css
body { font-family: var(--font-sans); font-size: 1rem; }
.logo { font-family: var(--font-display); font-size: clamp(1.25rem, 2.5vh, 1.75rem); letter-spacing: 0.5px; }
.score-number-display { font-family: var(--font-display); font-size: clamp(3.5rem, 10vh, 7rem); font-variant-numeric: tabular-nums; }
.score-word { font-family: var(--font-display); font-size: clamp(1.2rem, 2.5vh, 1.8rem); }
.factor-name { font-family: var(--font-display); font-size: clamp(1rem, 2vh, 1.4rem); }
.factor-value { font-family: var(--font-display); font-size: clamp(2rem, 5vh, 3.5rem); font-variant-numeric: tabular-nums; }
.factor-micro { font-size: clamp(0.8rem, 1.4vh, 0.95rem); line-height: 1.35; }
```

### 5.3 Viewport 100vh Layout Architecture
To satisfy the strict 100vh constraint across all screen sizes without bursting or crushing:
1. **Dynamic Units**: Use `height: 100vh; height: 100dvh; max-height: 100dvh; overflow: hidden;` on `body` and container.
2. **Desktop Layout (Aspect Ratio > 4/3, Width >= 1024px)**:
   - 2-column grid: `grid-template-columns: minmax(320px, 35%) 1fr;`
   - Height: `100%`.
   - Status panel: flex column with `min-height: 0; overflow-y: auto;`.
   - Recommendations: `flex: 1; min-height: 0; overflow-y: auto;`.
   - Factors panel: 3 columns x 2 rows grid (`grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); height: 100%;`).
3. **Mobile & Portrait Layout (Width < 1024px or Aspect Ratio <= 4/3)**:
   - Rather than cramming all 6 cards and recommendations into 45%/55% rows, use a segmented / tabbed navigation or compact accordion, OR:
   - Compact status header (score pill + traffic color, 70px height) + Persona selector + compact factor grid (2 columns x 3 rows, or 3 columns x 2 rows) with expandable modal/drawer for microcopy, OR
   - Scrollable internal dashboard container (`overflow-y: auto; height: 100%; -webkit-overflow-scrolling: touch;`) inside a strict `100dvh` parent container, so the viewport outer window NEVER creates a global scrollbar or bursts (`document.documentElement.scrollHeight === window.innerHeight`).

### 5.4 Agent-as-Judge Test Suite Automation
The automated judge script (`test_ux_contrast_judge.js`) must:
1. Spin up a lightweight HTTP server on a random/fixed port.
2. Launch `/usr/bin/chromium --headless --no-sandbox`.
3. Test 5 weather conditions (Extreme heat, Storm, Critical air, Mild, Attention).
4. For each condition, evaluate:
   - Viewport check: `document.documentElement.scrollHeight <= window.innerHeight + 1`.
   - Invisible elements check: zero text nodes with ratio < 1.1:1 or opacity 0.
   - Contrast check: all text nodes over colored backgrounds have ratio >= 4.5:1.
   - Font check: `window.getComputedStyle(el).fontFamily` must resolve to system fonts without triggering Google Fonts 404/network errors.
5. Exit with status 0 on total pass, status 1 on any violation.

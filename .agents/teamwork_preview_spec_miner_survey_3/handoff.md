# HANDOFF REPORT: Survey Phase - UX, Typography & WCAG AAA Accessibility (R3)

- **Agent**: teamwork_preview_spec_miner_survey_3
- **Role**: Spec Miner (UX Layout, Typography & Accessibility)
- **Handoff Type**: Hard (Task Complete)
- **Target Recipient**: Orchestrator (Conversation ID: 410c71bb-1246-46b3-881c-e71b08c2047a)
- **Date**: 2026-09-18T16:40:00Z

---

## 1. Observation

Directly observed facts, tool commands, file snippets, and runtime outputs:

1. **External Font Dependencies in `index.html`**:
   - `index.html` lines 11-13:
     ```html
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
     <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Roboto:wght@400;700;900&display=swap" rel="stylesheet">
     ```
   - External script in line 17: `<script src="https://unpkg.com/@phosphor-icons/web"></script>`.
   - `css/style.css` lines 16, 24, 28, 71, 78 use `font-family: 'Roboto', sans-serif` and `font-family: 'Oswald', sans-serif`.

2. **Invisible Text Bug on Unpopulated / Initial `#traffic-card`**:
   - `index.html` line 25: `<section class="panel panel-status">` (styled with `background: #ffffff`).
   - `index.html` line 36: `<div class="traffic-light-card" id="traffic-card">`.
   - `css/style.css` line 27: `.traffic-light-card { ... color: white; ... }`.
   - Runtime crawl via CDP (`test_rendered_state.js` and `audit_judge_prototype.js`):
     ```json
     {
       "text": "ÍNDICE DE RISCO CLIMÁTICO (0 a",
       "className": "score-title",
       "fg": "rgb(255,255,255)",
       "bg": "rgb(255,255,255)",
       "ratio": 1
     }
     ```
     Before API data arrives or when an API error occurs, `#traffic-card` has no background class and defaults to `color: white` over parent `#ffffff` background. Text is 100% invisible (1.00:1 ratio).

3. **Empirical Contrast Ratios on Colored Backgrounds**:
   - Evaluated via relative luminance formula ($L = 0.2126R + 0.7152G + 0.0722B$):
     - `bom` (`#4CAF50`) with white text: **2.78:1** (FAILS WCAG AA 4.5:1 and AAA).
     - `alerta` (`#FF9800`) with white text: **2.16:1** (FAILS WCAG AA 4.5:1 and AAA).
     - `perigo` (`#F44336`) with white text: **3.68:1** (FAILS WCAG AA 4.5:1 and AAA).
     - Gauge badges (`.factor-gauge` with `background: rgba(255,255,255,0.3)` and white text):
       - On green (`#4CAF50`): **2.01:1** (FAILS).
       - On orange (`#FF9800`): **1.73:1** (FAILS).
       - On red (`#F44336`): **2.61:1** (FAILS).
       - On purple (`#9C27B0`): **3.56:1** (FAILS).

4. **Runtime Viewport Overflow Across Screen Sizes (Debian Chromium 149)**:
   - Command: `node .agents/teamwork_preview_spec_miner_survey_3/test_rendered_state.js`
   - Mobile Standard (iPhone 13, 390x844):
     `docH: 1374`, `winH: 844`, `overflow: true`, `overflowPx: 530px`.
     `#rec-list`: `box: { w: 359, h: 0 }`, `clientH: 0px` (crushed to 0px).
   - Mobile Compact (Android 360, 360x800):
     `docH: 1322`, `winH: 800`, `overflow: true`, `overflowPx: 522px`.
     `#rec-list`: `box: { w: 331, h: 0 }`, `clientH: 0px` (crushed to 0px).
   - Tablet (1024x768):
     `docH: 800`, `winH: 768`, `overflow: true`, `overflowPx: 32px`.
   - Media query in `css/style.css` lines 101-121:
     - `@media (max-aspect-ratio: 4/3)` sets `.dashboard-grid { grid-template-rows: 45% 55%; }` and `.factors-grid { grid-template-columns: repeat(3, 1fr); }`.
     - `@media (max-aspect-ratio: 1/2)` sets `.factors-grid { grid-template-columns: repeat(2, 1fr); }`. Typical phone aspect ratio (9:16 = 0.5625) is greater than 0.50, so this query never triggers.

---

## 2. Logic Chain

1. **Premise 1 (Font Source)**: `ORIGINAL_REQUEST.md` line 25 requires "garantir fontes de sistema seguras" for offline reliability and elderly accessibility. Observation 1 proves `index.html` relies on Google Fonts and unpkg CDN. If internet is down or DNS fails, fonts fail to load, violating the offline-first PWA contract.
2. **Premise 2 (Contrast & Visibility)**: `ORIGINAL_REQUEST.md` line 36 requires "certificar que todos os textos sobre fundos coloridos possuem ratio >= 4.5:1, sem elementos invisíveis." Observation 2 proves `#traffic-card` initially renders white text on a white panel background (1.00:1, invisible). Observation 3 proves green (2.78:1), orange (2.16:1), and red (3.68:1) with white text, as well as all gauge overlays (1.73:1 - 3.56:1), fail the >= 4.5:1 threshold.
3. **Premise 3 (Viewport 100vh)**: `ORIGINAL_REQUEST.md` line 25 requires "garantir que toda a interface caiba em 100vh sem estourar." Observation 4 proves that on standard mobile screens, the page bursts by >520px (`docH` reaches 1374px), and the recommendations list `#rec-list` collapses to a client height of 0px. On tablet screens, it bursts by 32px.
4. **Premise 4 (Agent-as-Judge Automation)**: The acceptance criterion specifies an automated "Agent-as-judge" contrast check. By building and executing `audit_judge_prototype.js` via headless Chromium and CDP, we verified that automated tree-walking with computed styles and relative luminance calculation provides a deterministic, zero-dependency validation suite.

---

## 3. Caveats

1. **Operating System Font Availability**: While `system-ui` and `-apple-system` resolve seamlessly across macOS, iOS, Windows, and modern Android/Linux, legacy Linux desktop environments without Noto/Roboto may fall back to generic `sans-serif`. Specifying standard fallbacks (`system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`) fully mitigates this.
2. **Subpixel Viewport Rounding**: In high-DPI displays with subpixel rendering, `scrollHeight` can occasionally report 1px greater than `innerHeight`. The automated judge script includes a 1px tolerance threshold (`scrollHeight <= innerHeight + 1`).
3. **Phosphor Icons**: Currently loaded via `unpkg.com` script. For strict offline PWA support, icon SVGs should either be inlined or bundled locally into `assets/`.

---

## 4. Conclusion

Requirement R3 currently exhibits **four blocking defects**:
1. **Severe contrast violations**: White-on-white text (1:1) in unpopulated/error states, and contrast ratios well below 4.5:1 on green (2.78:1), orange (2.16:1), and red (3.68:1), as well as on all translucent gauge pills (1.73:1).
2. **Catastrophic mobile layout overflow**: Viewport bursts by up to 530px on mobile and 32px on tablet, completely crushing `#rec-list` to 0px height.
3. **External font dependencies**: Google Fonts links in `index.html` violating the "safe system fonts" mandate and endangering offline PWA stability.
4. **Lack of automated verification**: No existing automated test verifies contrast or 100vh constraints.

The solution is fully designed and documented in `survey_r3.md`:
- Accessible color tokens guaranteeing >= 4.5:1 and >= 7.0:1.
- Native safe system font stack.
- Viewport layout utilizing `100dvh`, compact mobile grid/scroll containment, and robust aspect-ratio media queries.
- Standalone headless Chromium agent-as-judge test runner (`test_ux_contrast_judge.js`).

---

## 5. Verification Method

To independently verify the observations and findings in this report:

1. **Verify Mathematical Contrast**:
   Run the mathematical contrast audit script:
   ```bash
   python3 -c "
   def lum(r,g,b):
       c = [x/255.0 for x in (r,g,b)]
       e = [v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4 for v in c]
       return 0.2126*e[0] + 0.7152*e[1] + 0.0722*e[2]
   def cr(c1, c2):
       l1, l2 = lum(*c1), lum(*c2)
       return (max(l1,l2)+0.05)/(min(l1,l2)+0.05)
   print('White on #4CAF50:', round(cr((255,255,255), (76,175,80)), 2))
   print('White on #FF9800:', round(cr((255,255,255), (255,152,0)), 2))
   print('White on #F44336:', round(cr((255,255,255), (244,67,54)), 2))
   "
   ```
   *Expected Output*: `2.78`, `2.16`, `3.68` (all < 4.5).

2. **Verify Mobile 100vh Burst and #rec-list Collapse**:
   Run the headless Chromium render test:
   ```bash
   node .agents/teamwork_preview_spec_miner_survey_3/test_rendered_state.js
   ```
   *Expected Output*: Mobile iPhone 13 reports `overflowPx: 530`, `docH: 1374`, `recList.box.h: 0`.

3. **Verify Invisible Text in Initial State**:
   Inspect `index.html:36-40` and `css/style.css:22,27`: observe `#traffic-card` has `color: white` inside `#ffffff` panel without a default background color.

4. **Invalidation Conditions**:
   - If all text on colored backgrounds demonstrates $CR \ge 4.5:1$, finding 2 is invalidated.
   - If `document.documentElement.scrollHeight <= window.innerHeight` across all screen resolutions down to 320x568, finding 3 is invalidated.

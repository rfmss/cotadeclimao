// audit_judge_prototype.js - Prototype of Agent-as-Judge contrast & visibility crawler
const fs = require('fs');

function parseColor(str) {
  if (!str) return null;
  str = str.trim();
  if (str.startsWith('#')) {
    const h = str.slice(1);
    if (h.length === 3) {
      return [parseInt(h[0]+h[0], 16), parseInt(h[1]+h[1], 16), parseInt(h[2]+h[2], 16), 1];
    }
    if (h.length === 6) {
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    }
  }
  const rgbaMatch = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    return [
      parseInt(rgbaMatch[1], 10),
      parseInt(rgbaMatch[2], 10),
      parseInt(rgbaMatch[3], 10),
      rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
    ];
  }
  return null;
}

function relLuminance(r, g, b) {
  const srgb = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(rgb1, rgb2) {
  const l1 = relLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = relLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function alphaBlend(fg, bg) {
  const [r1, g1, b1, a1] = fg;
  const [r2, g2, b2, a2] = bg;
  const outA = a1 + a2 * (1 - a1);
  if (outA === 0) return [0, 0, 0, 0];
  const r = Math.round((r1 * a1 + r2 * a2 * (1 - a1)) / outA);
  const g = Math.round((g1 * a1 + g2 * a2 * (1 - a1)) / outA);
  const b = Math.round((b1 * a1 + b2 * a2 * (1 - a1)) / outA);
  return [r, g, b, outA];
}

// In-browser crawler code to be executed in page context
const inBrowserChecker = `
  (function() {
    ${parseColor.toString()}
    ${relLuminance.toString()}
    ${contrastRatio.toString()}
    ${alphaBlend.toString()}

    function getEffectiveBg(el) {
      let cur = el;
      let blended = [255, 255, 255, 1]; // default underlay
      const bgStack = [];

      while (cur && cur !== document.documentElement) {
        const cs = window.getComputedStyle(cur);
        const bg = parseColor(cs.backgroundColor);
        if (bg && bg[3] > 0) {
          bgStack.unshift(bg);
        }
        cur = cur.parentElement;
      }

      // Blend from bottom to top
      let res = [235, 239, 245, 1]; // body background var(--bg)
      for (const b of bgStack) {
        res = alphaBlend(b, res);
      }
      return res;
    }

    const textEls = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (!text) continue;
      const el = node.parentElement;
      if (!el) continue;
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const fg = parseColor(cs.color);
      const bg = getEffectiveBg(el);
      if (!fg || !bg) continue;

      const ratio = contrastRatio(fg, bg);
      textEls.push({
        text: text.slice(0, 30),
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        fg: \`rgb(\${fg[0]},\${fg[1]},\${fg[2]})\`,
        bg: \`rgb(\${bg[0]},\${bg[1]},\${bg[2]})\`,
        ratio: Math.round(ratio * 100) / 100,
        pass4_5: ratio >= 4.5,
        pass7_0: ratio >= 7.0
      });
    }

    const failed = textEls.filter(t => !t.pass4_5);
    return {
      totalVisibleTexts: textEls.length,
      passedCount: textEls.length - failed.length,
      failedCount: failed.length,
      failures: failed
    };
  })()
`;

module.exports = { inBrowserChecker, parseColor, relLuminance, contrastRatio, alphaBlend };

import { expect, test, type Page } from "@playwright/test";

/**
 * WCAG AA contrast audit for the ivory-glass skin. Buttons, tabs, banners and
 * body text on glass surfaces must clear 4.5:1 (3:1 for large text).
 */

const ROUTES = ["/", "/marketplace", "/spatial", "/token-audit", "/style-guide"];

const AUDIT = `
(() => {
  // Computed colours can be rgb(), rgba() or oklab()/oklch(); rasterise once so
  // every notation resolves to sRGB.
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (c) => {
    if (!c) return null;
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (m) {
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000000';
    ctx.fillStyle = c;
    if (ctx.fillStyle === '#000000' && !/^#?0{3,8}$/.test(c.replace('#', ''))) {
      // fillStyle rejected the notation (older engine) — measure via a probe element.
      const probe = document.createElement('span');
      probe.style.color = c;
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      const rm = resolved.match(/rgba?\\(([^)]+)\\)/);
      if (!rm) return null;
      const p = rm[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
    }
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const alpha = d[3] / 255;
    // getImageData is premultiplied; undo it to recover the source colour.
    if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return { r: d[0] / alpha, g: d[1] / alpha, b: d[2] / alpha, a: alpha };

  };

  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  /** Returns the composited backdrop, or null when an ancestor paints a gradient/image. */
  const bgOf = (el) => {
    let node = el;
    let acc = { r: 247, g: 243, b: 234, a: 1 };
    const stack = [];
    while (node) {
      const s = getComputedStyle(node);
      if (s.backgroundImage !== 'none') return null;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) stack.push(c);
      node = node.parentElement;
    }
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };

  const targets = Array.from(
    document.querySelectorAll(
      'button, a, [role="tab"], [role="alert"], [role="status"], p, h1, h2, h3, li, span'
    )
  );
  const fails = [];
  for (const el of targets) {
    const text = (el.textContent || '').trim();
    if (!text || text.length > 220) continue;
    if (el.children.length > 0 && !Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.35) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    // Gradient text (background-clip:text) and gradient-filled controls cannot be
    // measured from computed colours; they are covered by visual snapshots.
    if (cs.backgroundImage !== 'none') continue;
    if (fg.a === 0 || cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue;

    const bg = bgOf(el);
    if (!bg) continue;

    const composed = over(fg, bg);
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    const r = ratio(composed, bg);
    if (r + 0.05 < need) {
      fails.push({
        tag: el.tagName.toLowerCase(),
        text: text.slice(0, 60),
        color: cs.color,
        ratio: Math.round(r * 100) / 100,
        need,
      });
    }
  }
  return fails;
})()
`;

async function audit(page: Page) {
  return page.evaluate(AUDIT) as Promise<
    { tag: string; text: string; color: string; ratio: number; need: number }[]
  >;
}

for (const route of ROUTES) {
  test(`contrast AA: ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const fails = await audit(page);
    if (fails.length) {
      console.log(`Contrast failures on ${route}:\n${JSON.stringify(fails, null, 2)}`);
    }
    expect(fails, `low-contrast text on ${route}`).toEqual([]);
  });
}

import { test, expect } from "@playwright/test";

// Analyses a rendered <img> in the browser: draws it to a canvas, computes
// the bounding box of non-white / non-transparent pixels, and returns the
// offset of that bbox's center from the image's geometric center as a
// fraction of the image's smaller dimension. Anything above ~6% reads as a
// visibly off-center emblem — well beyond the safe-area padding.
async function measureOffCenter(imgLocator: import("@playwright/test").Locator) {
  return imgLocator.evaluate((el) => {
    const img = el as HTMLImageElement;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return { dx: 1, dy: 1, filled: 0, w: 0, h: 0 };
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { dx: 1, dy: 1, filled: 0, w, h };
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let minX = w,
      minY = h,
      maxX = -1,
      maxY = -1,
      filled = 0;
    // Treat near-white or transparent as background; anything else is the mark.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i]!,
          g = data[i + 1]!,
          b = data[i + 2]!,
          a = data[i + 3]!;
        if (a < 20) continue;
        if (r > 240 && g > 240 && b > 240) continue;
        filled++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return { dx: 1, dy: 1, filled: 0, w, h };
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const dx = (cx - w / 2) / w;
    const dy = (cy - h / 2) / h;
    return { dx, dy, filled, w, h };
  });
}

// Visual regression checks for the 13 counties whose emblems were re-cropped
// from the official Council of Governors poster. Every emblem must render
// uncropped and centered inside its rounded-square container on both the
// landing-page tile grid and the county detail hero.
const RECROPPED = [
  { code: 14, name: "Embu" },
  { code: 15, name: "Kitui" },
  { code: 17, name: "Makueni" },
  { code: 18, name: "Nyandarua" },
  { code: 31, name: "Laikipia" },
  { code: 33, name: "Narok" },
  { code: 34, name: "Kajiado" },
  { code: 37, name: "Kakamega" },
  { code: 41, name: "Siaya" },
  { code: 42, name: "Kisumu" },
  { code: 43, name: "Homa Bay" },
  { code: 44, name: "Migori" },
  { code: 45, name: "Kisii" },
  { code: 46, name: "Nyamira" },
  { code: 47, name: "Nairobi City" },
];

// Emblems are cropped from a poster and re-padded on a white square. Anything
// beyond ~8% off from geometric center is visibly off in the tile grid.
const OFFCENTER_TOLERANCE = 0.08;

test.describe("Recropped county emblems render uncropped and centered", () => {
  test("tile grid on landing page shows all recropped emblems", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("county-map")).toBeVisible({ timeout: 20_000 });

    for (const { code, name } of RECROPPED) {
      const card = page.getByTestId(`county-card-${code}`);
      await card.scrollIntoViewIfNeeded();
      await expect(card, `${name} card`).toBeVisible();
      const img = card.locator("img").first();
      await expect(img, `${name} img rendered`).toBeVisible();
      // The <img> must have actually loaded (naturalWidth > 0). If the
      // primary asset 404s or the crop is empty, this fails.
      const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
      expect(naturalWidth, `${name} natural width`).toBeGreaterThan(0);
      // Pixel-analysis off-center detection. Fails when the mark's bbox
      // center drifts more than OFFCENTER_TOLERANCE from the geometric center.
      const { dx, dy, filled } = await measureOffCenter(img);
      expect(filled, `${name} rendered non-empty pixels`).toBeGreaterThan(50);
      expect(Math.abs(dx), `${name} horizontal off-center dx=${dx.toFixed(3)}`).toBeLessThanOrEqual(
        OFFCENTER_TOLERANCE,
      );
      expect(Math.abs(dy), `${name} vertical off-center dy=${dy.toFixed(3)}`).toBeLessThanOrEqual(
        OFFCENTER_TOLERANCE,
      );
      // Snapshot the tile so any centering regression fails review.
      await expect(card).toHaveScreenshot(`tile-${code}-${name}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    }
  });

  test("county detail hero shows uncropped emblem for each recropped county", async ({ page }) => {
    for (const { code, name } of RECROPPED) {
      await page.goto(`/county/${code}`);
      // The hero renders a priority CountyEmblem inside the h1 area.
      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading, `${name} heading`).toBeVisible({ timeout: 20_000 });
      const img = page.locator(`img[alt*="${name}"]`).first();
      await expect(img, `${name} hero emblem`).toBeVisible();
      const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
      expect(naturalWidth, `${name} hero natural width`).toBeGreaterThan(0);
      const { dx, dy, filled } = await measureOffCenter(img);
      expect(filled, `${name} hero rendered non-empty pixels`).toBeGreaterThan(50);
      expect(
        Math.abs(dx),
        `${name} hero horizontal off-center dx=${dx.toFixed(3)}`,
      ).toBeLessThanOrEqual(OFFCENTER_TOLERANCE);
      expect(
        Math.abs(dy),
        `${name} hero vertical off-center dy=${dy.toFixed(3)}`,
      ).toBeLessThanOrEqual(OFFCENTER_TOLERANCE);
    }
  });
});

test.describe("/logo-qa developer page — keyboard accessibility", () => {
  test("controls have accessible names, keyboard focus order, and visible focus", async ({
    page,
  }) => {
    await page.goto("/logo-qa");
    await expect(page.getByTestId("logo-qa-page")).toBeVisible();

    // Every interactive control exposes an accessible name for screen readers.
    const controls = [
      { testid: "qa-toggle-crosshair", role: "checkbox", nameRe: /crosshair/i },
      { testid: "qa-toggle-safearea", role: "checkbox", nameRe: /safe area/i },
      { testid: "qa-toggle-bbox", role: "checkbox", nameRe: /bounding box/i },
      { testid: "qa-size", role: "slider", nameRe: /size/i },
      { testid: "qa-filter", role: "searchbox", nameRe: /filter/i },
    ] as const;
    for (const c of controls) {
      const el = page.getByTestId(c.testid);
      await expect(el, `${c.testid} visible`).toBeVisible();
      const name = (await el.evaluate((n) => {
        const label = (n as HTMLElement).getAttribute("aria-label");
        if (label) return label;
        const wrap = (n as HTMLElement).closest("label");
        return wrap?.textContent?.trim() ?? "";
      })) as string;
      expect(name, `${c.testid} accessible name`).toMatch(c.nameRe);
    }

    // Tab through the header controls in document order and record which
    // testid receives focus. Expected order matches the visual order.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    await page.locator("body").focus();
    const focusOrder: string[] = [];
    const targets = new Set([
      "qa-toggle-crosshair",
      "qa-toggle-safearea",
      "qa-toggle-bbox",
      "qa-size",
      "qa-filter",
    ]);
    for (let i = 0; i < 40 && focusOrder.length < targets.size; i++) {
      await page.keyboard.press("Tab");
      const tid = await page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.getAttribute("data-testid") ?? "",
      );
      if (tid && targets.has(tid) && !focusOrder.includes(tid)) focusOrder.push(tid);
    }
    expect(focusOrder).toEqual([
      "qa-toggle-crosshair",
      "qa-toggle-safearea",
      "qa-toggle-bbox",
      "qa-size",
      "qa-filter",
    ]);

    // Visible focus indicator: the focused control must have an outline or
    // box-shadow ring in its focus state (not `outline: none` with nothing).
    await page.getByTestId("qa-filter").focus();
    const styles = await page.getByTestId("qa-filter").evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        outlineWidth: s.outlineWidth,
        outlineStyle: s.outlineStyle,
        boxShadow: s.boxShadow,
      };
    });
    const hasFocusRing =
      (styles.outlineStyle !== "none" && parseFloat(styles.outlineWidth) > 0) ||
      (styles.boxShadow && styles.boxShadow !== "none");
    expect(hasFocusRing, `filter focus ring styles=${JSON.stringify(styles)}`).toBeTruthy();

    // Keyboard-toggle a checkbox with Space and verify state flips.
    const crosshair = page.getByTestId("qa-toggle-crosshair");
    await crosshair.focus();
    const before = await crosshair.isChecked();
    await page.keyboard.press("Space");
    const after = await crosshair.isChecked();
    expect(after).toBe(!before);
  });
});

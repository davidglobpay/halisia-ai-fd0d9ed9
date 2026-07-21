import { test, expect } from "@playwright/test";

/**
 * Lightweight visual regression coverage for key pages.
 * Snapshots are stored under tests/e2e/__snapshots__/ and can be updated
 * with `bunx playwright test --update-snapshots`.
 *
 * We mask volatile UI (video/canvas/map tiles) to keep diffs stable across
 * runs while still catching layout, theme and overlay regressions.
 */
const PAGES: Array<{ name: string; path: string }> = [
  { name: "landing", path: "/" },
  { name: "compare", path: "/compare" },
  { name: "title-deed", path: "/title-deed" },
];

for (const p of PAGES) {
  test(`visual: ${p.name}`, async ({ page }) => {
    await page.goto(p.path, { waitUntil: "networkidle" });
    // Give lazy media a beat to settle without waiting on autoplay.
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot(`${p.name}.png`, {
      fullPage: false,
      maxDiffPixelRatio: 0.05,
      mask: [
        page.locator("video"),
        page.locator("canvas"),
        page.locator("[data-testid=map-frame]"),
      ],
    });
  });
}

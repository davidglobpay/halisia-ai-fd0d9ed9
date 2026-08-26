import { expect, test } from "@playwright/test";

/**
 * Visual regression coverage for the approved ivory-glass skin and the
 * winged-H logo across the surfaces most likely to regress: the hero,
 * the navbar, the Spatial studio and the Spatial parcel rail.
 */

test.describe("ivory glass theme visual regression", () => {
  test("navbar renders the winged-H lockup on ivory glass", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("header, nav").first();
    await expect(nav).toBeVisible();
    await expect(nav).toHaveScreenshot("theme-navbar.png", { maxDiffPixelRatio: 0.03 });
  });

  test("hero stage renders on ivory with the brand mark", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("h1").first();
    await expect(hero).toBeVisible();
    // The hero logo must resolve (not a broken asset).
    const mark = page.getByAltText("HALISIA.AI").first();
    await expect(mark).toBeVisible();
    expect(await mark.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator("section").first()).toHaveScreenshot("theme-hero.png", {
      maxDiffPixelRatio: 0.03,
    });
  });

  test("ivory globe backdrop is mounted and plain ivory", async ({ page }) => {
    await page.goto("/");
    const backdrop = page.getByTestId("globe-backdrop");
    await expect(backdrop).toBeAttached();
    const bg = await backdrop.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg.replace(/\s/g, "")).toBe("rgb(247,243,234)");
    // No raster/video background image behind the app shell.
    const img = await backdrop.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(img).toBe("none");
  });

  test("spatial studio and parcel rail render consistently", async ({ page }) => {
    await page.goto("/spatial");
    const viewport = page.getByTestId("spatial-viewport");
    await expect(viewport).toBeVisible({ timeout: 30_000 });
    // The Three.js canvas animates every frame; mask it and assert the chrome.
    await expect(viewport).toHaveScreenshot("theme-spatial-studio.png", {
      mask: [page.locator('[data-testid="spatial-canvas"]')],
      maxDiffPixelRatio: 0.15,
    });

    const rail = page.getByTestId("spatial-parcel-list");
    await expect(rail).toBeVisible({ timeout: 30_000 });
    await expect(rail).toHaveScreenshot("theme-spatial-parcel-rail.png", {
      maxDiffPixelRatio: 0.15,
    });
  });
});

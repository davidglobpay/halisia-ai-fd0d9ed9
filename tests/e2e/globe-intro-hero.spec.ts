import { test, expect } from "@playwright/test";

// Validates the landing HeroMap's globe intro: it plays once per session and
// walks through World -> Africa -> Kenya -> counties -> Nairobi, then is
// fully suppressed for visitors who prefer reduced motion.
test.describe("HeroMap globe intro", () => {
  test("plays the World -> Nairobi stage sequence once on first load", async ({ page }) => {
    await page.goto("/");
    const intro = page.getByTestId("hero-map").getByTestId("globe-intro");
    await expect(intro).toBeVisible();
    await expect(intro).toHaveAttribute("data-stage", "World");

    // Advances to later stages within the intro's ~3.5s runtime.
    await expect(intro).toHaveAttribute("data-stage", "Nairobi", { timeout: 4000 });

    // Intro removes itself once the sequence finishes and hands off to the map.
    await expect(intro).toBeHidden({ timeout: 1000 });

    // Reloading within the same session should not replay it.
    await page.reload();
    await expect(page.getByTestId("hero-map").getByTestId("globe-intro")).toHaveCount(0);
  });

  test("is skipped entirely under prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByTestId("hero-map")).toBeVisible();
    await expect(page.getByTestId("hero-map").getByTestId("globe-intro")).toHaveCount(0);
  });
});

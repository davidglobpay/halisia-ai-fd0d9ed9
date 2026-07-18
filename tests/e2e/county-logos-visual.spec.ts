import { test, expect } from "@playwright/test";

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
      const naturalWidth = await img.evaluate(
        (el) => (el as HTMLImageElement).naturalWidth,
      );
      expect(naturalWidth, `${name} natural width`).toBeGreaterThan(0);
      // Snapshot the tile so any centering regression fails review.
      await expect(card).toHaveScreenshot(`tile-${code}-${name}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    }
  });

  test("county detail hero shows uncropped emblem for each recropped county", async ({
    page,
  }) => {
    for (const { code, name } of RECROPPED) {
      await page.goto(`/county/${code}`);
      // The hero renders a priority CountyEmblem inside the h1 area.
      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading, `${name} heading`).toBeVisible({ timeout: 20_000 });
      const img = page.locator(`img[alt*="${name}"]`).first();
      await expect(img, `${name} hero emblem`).toBeVisible();
      const naturalWidth = await img.evaluate(
        (el) => (el as HTMLImageElement).naturalWidth,
      );
      expect(naturalWidth, `${name} hero natural width`).toBeGreaterThan(0);
    }
  });
});
import { test, expect } from "@playwright/test";

// End-to-end smoke across three Kenyan cities: for each we open Explore,
// verify Wave 1 (weather + GIS), Wave 2 (globe + terrain 3D + heatmap),
// Wave 3 (street), Wave 4 scores, and a successful PDF download.
const LOCATIONS = ["Nairobi CBD", "Kisumu", "Mombasa"];

test.describe("Waves 1-4 across multiple Kenya locations", () => {
  for (const q of LOCATIONS) {
    test(`${q} — waves 1-4 render and PDF downloads`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(String(e)));

      await page.goto(`/explore?q=${encodeURIComponent(q)}`);
      await expect(page.getByTestId("active-address")).toContainText(
        new RegExp(q.split(" ")[0], "i"),
        { timeout: 30_000 },
      );

      // Wave 1 · Weather + GIS
      await page.getByTestId("tab-weather").click();
      await expect(page.getByTestId("weather-panel")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("tab-layers").click();
      await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 15_000 });

      // Wave 2 · Globe, Terrain 3D, Heatmap
      await page.getByTestId("tab-globe").click();
      await expect(page.locator(".cesium-viewer, canvas").first()).toBeVisible({
        timeout: 30_000,
      });
      await page.getByTestId("tab-terrain3d").click();
      await expect(page.getByTestId("terrain-3d")).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("tab-heatmap").click();
      await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 15_000 });

      // Wave 3 · Street
      await page.getByTestId("tab-street").click();
      await expect(page.getByTestId("tab-street")).toHaveAttribute("aria-selected", /true/i);

      // Wave 4 · Public data + investment scoring
      await page.getByTestId("tab-wave4").click();
      await expect(page.getByTestId("wave4-panel")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("wave4-tab-invest").click();
      // Score must render as a number between 0 and 100.
      const scoreText = await page
        .getByTestId("wave4-panel")
        .locator("text=/^\\d{1,3}$/")
        .first()
        .textContent();
      const n = Number(scoreText);
      expect(Number.isFinite(n) && n >= 0 && n <= 100).toBe(true);

      // Provenance modal opens from drill-down
      await page.getByTestId("wave4-drill-accessibility").click();
      await page.getByTestId("wave4-open-provenance").first().click();
      await expect(page.getByTestId("provenance-modal")).toBeVisible();
      await page.getByTestId("provenance-close").click();

      // PDF download
      const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
      await page.getByTestId("download-dossier").click();
      const download = await downloadPromise;
      const name = download.suggestedFilename().toLowerCase();
      expect(name).toContain("halisia-dossier");
      expect(name).toMatch(/\.pdf$/);

      expect(pageErrors, `pageerrors: ${pageErrors.join(" | ")}`).toEqual([]);
    });
  }
});

import { test, expect } from "@playwright/test";

test.describe("Geolocation denied fallback", () => {
  test.beforeEach(async ({ context }) => {
    // Explicitly deny geolocation so the SearchBar's fallback surfaces.
    await context.clearPermissions();
  });

  test("landing page exposes manual lat,lng search when My Location is denied", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("search-my-location").first().click();

    const manual = page.getByLabel(/enter latitude and longitude/i);
    await expect(manual).toBeVisible();

    await manual.fill("-1.2921, 36.8219");
    await page.getByRole("button", { name: /^set$/i }).click();

    // Manual entry drives the same search flow; landing routes to /explore.
    await expect(page).toHaveURL(/\/explore\?q=/);
  });

  test("simulated pin remains usable inside /explore after denied permission", async ({ page }) => {
    await page.goto("/explore");
    // Trigger My Location -> denied -> manual fallback appears.
    await page.getByTestId("search-my-location").first().click();
    const manual = page.getByLabel(/enter latitude and longitude/i);
    await expect(manual).toBeVisible();
    await manual.fill("-1.286389, 36.817223");
    await page.getByRole("button", { name: /^set$/i }).click();

    // The URL should update with the simulated coordinates.
    await expect(page).toHaveURL(/q=-1\.286/);

    // Manual fallback stays available for another attempt (still usable).
    await expect(page.getByTestId("search-my-location").first()).toBeVisible();
  });
});
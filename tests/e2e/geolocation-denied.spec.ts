import { test, expect } from "@playwright/test";

test.describe("Geolocation denied fallback", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearPermissions();
    await page.addInitScript(() => {
      window.__halisiaForceGeolocationDenied = true;
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) =>
            error({
              code: 1,
              message: "User denied Geolocation",
              PERMISSION_DENIED: 1,
            } as GeolocationPositionError),
          watchPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
            error({
              code: 1,
              message: "User denied Geolocation",
              PERMISSION_DENIED: 1,
            } as GeolocationPositionError);
            return 7;
          },
          clearWatch: () => {},
        },
      });
    });
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

    // The simulation controls should remain usable after permission denial.
    await page.getByTestId("simulation-toggle").click();
    await expect(page.getByTestId("simulation-toggle")).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel(/simulated latitude and longitude/i).fill("-1.300000, 36.820000");
    await page.getByTestId("set-simulated-location").click();
    await expect(page).toHaveURL(/q=-1\.300000%2C36\.820000|q=-1\.300000,36\.820000/);
    await expect(page.getByTestId("active-address")).toContainText(/-1\.30000|My live location/i);
  });
});

import { test, expect } from "@playwright/test";

test.describe("HALISIA core journey", () => {
  test("landing → explore → map interaction → report CTA", async ({ page }) => {
    await page.addInitScript(() => {
      window.__halisiaMapsAuthFailed = true;
    });

    await page.goto("/");
    await expect(page.getByRole("region", { name: /halisia cinematic hero/i })).toBeVisible();
    await expect(page.getByTestId("county-map")).toBeVisible({ timeout: 20_000 });

    await page.getByPlaceholder(/try .+karen/i).fill("Karen, Nairobi");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/explore\?q=Karen/);

    await expect(page.getByTestId("map-view")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("active-address")).toBeVisible();
    await page.getByTestId("simulation-toggle").click();
    await page.getByLabel(/simulated latitude and longitude/i).fill("-1.292100,36.821900");
    await page.getByTestId("set-simulated-location").click();
    await expect(page).toHaveURL(/q=-1\.292100/);

    await expect(page.getByTestId("download-dossier")).toBeVisible();
    await expect(page.getByRole("button", { name: /copy shareable report link/i })).toBeVisible();

    await page.goto("/report?lat=-1.2921&lng=36.8219&address=Nairobi%20test");
    await expect(page.getByRole("heading", { name: /nairobi test/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /download pdf/i })).toBeVisible();
  });

  test("failed fallback tiles show retry UI without hiding pan and zoom controls", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__halisiaMapsAuthFailed = true;
    });
    await page.route(
      /basemaps\.cartocdn\.com|tile\.opentopomap\.org|server\.arcgisonline\.com/,
      (route) => route.abort(),
    );

    await page.goto("/explore?q=-1.286389%2C36.817223");
    await expect(page.getByTestId("map-fallback-status")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("map-tile-fallback")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("retry-map-tiles")).toBeVisible();
    await expect(page.locator(".leaflet-control-zoom-in")).toBeVisible();
    await expect(page.locator(".leaflet-control-zoom-out")).toBeVisible();

    await page.getByTestId("retry-map-tiles").click();
    await expect(page.getByTestId("map-fallback-status")).toBeVisible();
  });
});

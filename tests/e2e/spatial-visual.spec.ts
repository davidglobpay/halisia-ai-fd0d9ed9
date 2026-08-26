import { expect, test, type Page } from "@playwright/test";

/**
 * Visual snapshot coverage for the two Spatial failure-state surfaces:
 * the WebGL context-lost notice and the inline CRS warning.
 */

const OUT_OF_BOUNDS_ID = "11111111-1111-4111-8111-111111111111";

const CRS_ROWS = [
  {
    id: OUT_OF_BOUNDS_ID,
    title_deed_no: "TEST/CRS/1",
    parcel_code: "TEST-CRS-0001",
    county: "Aa Test County",
    centroid_lat: 9_857_000,
    centroid_lng: 255_000,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [255_000, 9_857_000],
          [255_100, 9_857_000],
          [255_100, 9_857_100],
          [255_000, 9_857_100],
          [255_000, 9_857_000],
        ],
      ],
    },
    area_sqm: 10_000,
    status: "pending",
    zoning_type: "residential",
    max_building_height_m: 15,
    road_setback_m: 6,
    riparian_setback_m: 6,
    parcel_beacons: [],
  },
];

test.describe("spatial failure-state visuals", () => {
  test.skip(({ viewport }) => !viewport || viewport.width < 900, "desktop viewport only");

  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("halisia:navguide:v1:seen", "playwright");
    });
  });

  test("context-lost notice matches the visual baseline", async ({ page }) => {
    await page.goto("/spatial");
    await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 20_000 });
    const canvas = page.locator('[data-testid="spatial-canvas"] canvas');
    await expect(canvas).toBeVisible({ timeout: 20_000 });

    await page.evaluate(() => {
      const el = document.querySelector<HTMLCanvasElement>(
        '[data-testid="spatial-canvas"] canvas',
      );
      if (!el) throw new Error("canvas missing");
      el.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });

    const notice = page.getByTestId("spatial-context-lost");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveScreenshot("spatial-context-lost.png", { maxDiffPixelRatio: 0.02 });
  });

  test("inline CRS warning matches the visual baseline", async ({ page }) => {
    await page.route("**/rest/v1/parcels*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(CRS_ROWS),
      });
    });
    await page.goto("/spatial");

    const warning = page.getByTestId("spatial-crs-warning");
    await expect(warning).toBeVisible({ timeout: 20_000 });
    await expect(warning).toHaveScreenshot("spatial-crs-warning.png", { maxDiffPixelRatio: 0.02 });

    const flag = page.getByTestId("spatial-parcel-crs-flag").first();
    await expect(flag).toBeVisible();
    await expect(flag).toHaveScreenshot("spatial-crs-flag.png", { maxDiffPixelRatio: 0.02 });
  });
});

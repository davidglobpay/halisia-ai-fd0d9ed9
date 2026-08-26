import { expect, test, type Page } from "@playwright/test";

/**
 * Parcels whose stored survey geometry is not plausible WGS84 Kenya (typically
 * a projected CRS such as Arc 1960 / UTM 37S) must surface an honest inline
 * notice and a selectable warning indicator in the parcel rail.
 */

const OUT_OF_BOUNDS_ID = "11111111-1111-4111-8111-111111111111";
const HEALTHY_ID = "22222222-2222-4222-8222-222222222222";

const ROWS = [
  {
    id: OUT_OF_BOUNDS_ID,
    title_deed_no: "TEST/CRS/1",
    parcel_code: "TEST-CRS-0001",
    county: "Aa Test County",
    // UTM 37S easting/northing accidentally stored in lat/lng columns.
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
  {
    id: HEALTHY_ID,
    title_deed_no: "TEST/OK/1",
    parcel_code: "TEST-OK-0001",
    county: "Zz Test County",
    centroid_lat: -1.2921,
    centroid_lng: 36.8219,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [36.8219, -1.2921],
          [36.8225, -1.2921],
          [36.8225, -1.2916],
          [36.8219, -1.2916],
          [36.8219, -1.2921],
        ],
      ],
    },
    area_sqm: 1_800,
    status: "pending",
    zoning_type: "residential",
    max_building_height_m: 15,
    road_setback_m: 6,
    riparian_setback_m: 6,
    parcel_beacons: [],
  },
];

async function stubParcels(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("halisia:navguide:v1:seen", "playwright");
  });
  await page.route("**/rest/v1/parcels*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(ROWS),
    });
  });
}

test.describe("CRS warning for out-of-bounds parcels", () => {
  test("renders the inline CRS notice and a selectable rail indicator", async ({ page }) => {
    await stubParcels(page);
    await page.goto("/spatial");

    const list = page.getByTestId("spatial-parcel-list");
    await expect(list).toBeVisible({ timeout: 20_000 });

    // The flagged parcel sorts first (county ordering) and is auto-selected.
    const warning = page.getByTestId("spatial-crs-warning");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/projected CRS|invalid coordinates/i);

    // Rail indicator exists, is inside the flagged parcel's radio and is selectable.
    const flag = list.getByTestId("spatial-parcel-crs-flag");
    await expect(flag).toHaveCount(1);
    await expect(flag).toHaveAttribute("data-parcel-crs", OUT_OF_BOUNDS_ID);

    const flaggedRadio = list.getByRole("radio", { name: /TEST-CRS-0001/i });
    await expect(flaggedRadio).toHaveAccessibleName(/coordinate reference warning/i);
    await expect(flaggedRadio).toBeChecked();

    // Selecting the healthy parcel clears the inline notice; re-selecting restores it.
    const healthyRadio = list.getByRole("radio", { name: /TEST-OK-0001/i });
    await healthyRadio.click();
    await expect(healthyRadio).toBeChecked();
    await expect(page.getByTestId("spatial-crs-warning")).toHaveCount(0);

    await flaggedRadio.click();
    await expect(flaggedRadio).toBeChecked();
    await expect(page.getByTestId("spatial-crs-warning")).toBeVisible();
  });
});

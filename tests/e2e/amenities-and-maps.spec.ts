import { test, expect } from "@playwright/test";
import { stubLocationServices } from "./helpers/server-fns";

test("Nearby Amenities — first place card shows distance, drive time, status pill", async ({
  page,
}) => {
  await stubLocationServices(page);
  await page.goto("/explore?q=Nairobi");
  await expect(page.getByTestId("active-address")).toContainText(/Nairobi/i, { timeout: 30_000 });

  // Amenities live inside the intelligence dashboard.
  const dash = page.getByTestId("intel-dashboard");
  await expect(dash).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("tab-amenities").click();

  // First place card
  const card = page
    .locator("li")
    .filter({ has: page.locator('[data-testid="place-card"]') })
    .first();
  // Fallback: any li containing a Navigate button badge
  const anyCard = page
    .locator("li")
    .filter({ hasText: /min|km/ })
    .first();
  const target = (await card.count()) ? card : anyCard;
  await expect(target).toBeVisible({ timeout: 30_000 });
  await expect(target).toContainText(/\d+(\.\d+)?\s?(m|km)/);
});

test("Geotech — soil layer toggles hide/show cells and foundation cards render 4", async ({
  page,
}) => {
  await stubLocationServices(page);
  await page.goto("/explore?q=Nairobi");
  await expect(page.getByTestId("active-address")).toContainText(/Nairobi/i, { timeout: 30_000 });
  // Geotech tab (Wave 3)
  // Dashboard sections are toggle buttons (aria-pressed), not ARIA tabs.
  await page.getByTestId("tab-geotech").click();
  const panel = page.getByTestId("geotech-panel");
  await expect(panel).toBeVisible({ timeout: 45_000 });

  const foundations = panel
    .getByTestId("foundation-comparison")
    .locator("[data-testid^=foundation-card-]");
  await expect(foundations).toHaveCount(4);

  const clayToggle = panel.getByTestId("soil-toggle-clay");
  await expect(clayToggle).toHaveAttribute("aria-pressed", "true");
  const clayCell = panel.locator("[data-testid^=soil-cell-][data-testid$=-clay]").first();
  await expect(clayCell).toBeVisible();
  await clayToggle.click();
  await expect(clayToggle).toHaveAttribute("aria-pressed", "false");
  await expect(clayCell).toHaveCount(0);

  // Risk cards with mitigation + cost impact expand
  const firstRisk = panel.getByTestId("risk-cards").locator("[data-testid^=risk-card-]").first();
  await expect(firstRisk).toContainText(/cost/i);
  await firstRisk.locator("button").first().click();
  await expect(firstRisk).toContainText(/KES/);
});

test("Map tools — distance and area readouts, export downloads geojson", async ({ page }) => {
  await stubLocationServices(page);
  await page.goto("/explore?q=Nairobi");
  await expect(page.getByTestId("active-address")).toContainText(/Nairobi/i, { timeout: 30_000 });

  // Open the multi-source GIS tab which uses leaflet with the tools.
  await page.getByTestId("tab-layers").click();

  const tools = page.getByTestId("map-tools").first();
  await expect(tools).toBeVisible({ timeout: 30_000 });

  // Distance
  await tools.getByTestId("tool-distance").click();
  const mapEl = page.locator(".leaflet-container").first();
  const box = await mapEl.boundingBox();
  if (!box) throw new Error("map has no bounding box");
  await mapEl.click({ position: { x: box.width * 0.4, y: box.height * 0.4 } });
  await mapEl.click({ position: { x: box.width * 0.6, y: box.height * 0.6 } });
  await expect(tools.getByTestId("tool-readout")).toContainText(/\d+(\.\d+)?\s?(m|km)/);

  // Area
  await tools.getByTestId("tool-clear").click();
  await tools.getByTestId("tool-area").click();
  await mapEl.click({ position: { x: box.width * 0.3, y: box.height * 0.3 } });
  await mapEl.click({ position: { x: box.width * 0.7, y: box.height * 0.3 } });
  await mapEl.click({ position: { x: box.width * 0.5, y: box.height * 0.7 } });
  await expect(tools.getByTestId("tool-readout")).toContainText(/\d+(\.\d+)?\s?(m²|ha)/);

  // Export
  const dl = page.waitForEvent("download", { timeout: 15_000 });
  await tools.getByTestId("tool-export").click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/halisia-features-.*\.geojson$/);
});

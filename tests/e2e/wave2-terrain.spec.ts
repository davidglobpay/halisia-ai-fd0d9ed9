import { test, expect } from "@playwright/test";

test("Wave 2 terrain — hover elevation, slope/relief stats, legend and refresh", async ({
  page,
}) => {
  await page.goto("/explore?q=Kisumu");
  await expect(page.getByTestId("active-address")).toContainText(/Kisumu/i, { timeout: 30_000 });

  await page.getByTestId("tab-terrain3d").click();
  const terrain = page.getByTestId("terrain-3d");
  await expect(terrain).toBeVisible({ timeout: 30_000 });

  // Slope / relief stats render as `min–max m · Δ N m · ~x% slope`.
  const stats = terrain.locator("text=/\\d+.*–.*\\d+\\s*m.*Δ.*slope/i").first();
  await expect(stats).toBeVisible({ timeout: 30_000 });
  const statsText = (await stats.textContent()) ?? "";
  expect(statsText).toMatch(/\d+\s*–\s*\d+\s*m/);
  expect(statsText).toMatch(/Δ\s*\d+\s*m/);
  expect(statsText).toMatch(/~\s*[\d.]+%/);

  // Hover an elevation cell → tooltip with metres + lat/lng.
  const canvas = terrain.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("terrain canvas has no bounding box");
  await canvas.hover({ position: { x: box.width * 0.5, y: box.height * 0.55 } });
  await expect(
    terrain.locator("text=/\\-?\\d+(?:\\.\\d+)?,\\s*\\-?\\d+(?:\\.\\d+)?/").first(),
  ).toBeVisible({
    timeout: 10_000,
  });
  await expect(terrain.locator("text=/^\\s*-?\\d+\\s*m\\s*$/").first()).toBeVisible();

  // Legend swatch renders with min/max endpoints from stats.
  const legendMin = statsText.match(/(\d+)\s*–/)?.[1];
  const legendMax = statsText.match(/–\s*(\d+)/)?.[1];
  expect(legendMin).toBeTruthy();
  expect(legendMax).toBeTruthy();
  await expect(terrain.getByText(`${legendMin} m`).first()).toBeVisible();
  await expect(terrain.getByText(`${legendMax} m`).first()).toBeVisible();
  // Interact with the legend (hover) — should not throw and should stay visible.
  await terrain.getByText(`${legendMin} m`).first().hover();

  // Refresh should re-sample: telemetry must record a fresh event and stats
  // must remain valid afterwards.
  const beforeCount = await page.evaluate(
    () =>
      (window as unknown as { __halisiaTerrainTelemetry?: unknown[] }).__halisiaTerrainTelemetry
        ?.length ?? 0,
  );
  await terrain.getByTestId("terrain-3d-refresh").click();
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (window as unknown as { __halisiaTerrainTelemetry?: unknown[] })
              .__halisiaTerrainTelemetry?.length ?? 0,
        ),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(beforeCount);
  await expect(stats).toBeVisible({ timeout: 30_000 });

  // At least one successful contour or pdf-terrain fetch must be present.
  const successCount = await page.evaluate(
    () =>
      (
        (
          window as unknown as {
            __halisiaTerrainTelemetry?: Array<{ kind: string; layer: string }>;
          }
        ).__halisiaTerrainTelemetry ?? []
      ).filter((e) => e.kind === "success" && e.layer !== "render").length,
  );
  expect(successCount).toBeGreaterThan(0);
});

test("Wave 4 provenance export — JSON and CSV downloads", async ({ page }) => {
  await page.goto("/explore?q=Nairobi");
  await page.getByTestId("tab-wave4").click();
  await expect(page.getByTestId("wave4-panel")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("wave4-tab-invest").click();
  await page.getByTestId("wave4-drill-accessibility").click();
  await page.getByTestId("wave4-open-provenance").first().click();
  await expect(page.getByTestId("provenance-modal")).toBeVisible();

  const jsonPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByTestId("provenance-export-json").click();
  const jsonDl = await jsonPromise;
  expect(jsonDl.suggestedFilename()).toMatch(/halisia-provenance-.*\.json$/);

  const csvPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByTestId("provenance-export-csv").click();
  const csvDl = await csvPromise;
  expect(csvDl.suggestedFilename()).toMatch(/halisia-provenance-.*\.csv$/);
});

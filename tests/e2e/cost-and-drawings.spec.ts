import { expect, test } from "@playwright/test";
import { waitForDownload } from "./helpers/download";
import { readFile } from "node:fs/promises";

test("Design Studio: costs, drawings, camera views, render capability and valid cost PDF", async ({
  page,
}) => {
  await page.goto("/design-studio?lat=-1.286389&lng=36.817223&label=Nairobi");
  await expect(page.getByTestId("cost-estimator")).toBeVisible();
  for (const s of ["masonry", "precast", "eps"]) {
    await expect(page.getByTestId(`cost-${s}`)).toContainText("KES");
  }
  for (const d of [
    "site-plan",
    "floor-plan",
    "elevation-front",
    "elevation-side",
    "section",
    "structural",
    "isometric",
  ]) {
    await expect(page.getByTestId(`drawing-${d}`)).toContainText("NOT CERTIFIED");
  }
  await expect(page.getByTestId("render-capability")).toContainText(/px/, { timeout: 20000 });
  await expect(page.getByTestId("render-capability")).toContainText(
    /8K (export available|unavailable)/,
  );
  await page.getByTestId("studio-view-front").click();
  await page.getByTestId("studio-view-worms-eye").click();
  await expect(page.getByTestId("studio-xr")).toContainText(/supported|not supported/);
  const dl = waitForDownload(page);
  await page.getByTestId("cost-pdf").click();
  const d = await dl;
  expect(d.suggestedFilename()).toMatch(/halisia-cost-estimate.*\.pdf$/);
  const bytes = await readFile((await d.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(2000);
});

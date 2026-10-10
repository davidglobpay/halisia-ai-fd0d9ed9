import { expect, test } from "@playwright/test";

test("Design Studio shows cost estimates, drawings and downloads a cost PDF", async ({ page }) => {
  await page.goto("/design-studio?lat=-1.286389&lng=36.817223&label=Nairobi");
  await expect(page.getByTestId("cost-estimator")).toBeVisible();
  for (const s of ["masonry", "precast", "eps"]) {
    await expect(page.getByTestId(`cost-${s}`)).toContainText("KES");
  }
  for (const d of ["site-plan", "floor-plan", "elevation-front", "elevation-side", "section", "isometric"]) {
    await expect(page.getByTestId(`drawing-${d}`)).toContainText("NOT CERTIFIED");
  }
  const dl = page.waitForEvent("download");
  await page.getByTestId("cost-pdf").click();
  expect((await dl).suggestedFilename()).toMatch(/halisia-cost-estimate.*\.pdf$/);
});

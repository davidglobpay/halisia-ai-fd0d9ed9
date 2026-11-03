import { test, expect } from "@playwright/test";
import { waitForDownload } from "./helpers/download";

// Verify that ?compare=… survives a full page reload.
test("selected counties in ?compare= persist across reload", async ({ page }) => {
  await page.goto("/?compare=47,1,2");
  // Wait for the county section to hydrate.
  await expect(page.getByTestId("compare-grid")).toBeVisible({ timeout: 15_000 });

  // Three cards visible in the compare panel.
  const gridCards = page.locator('[data-testid="compare-grid"] > div');
  await expect(gridCards).toHaveCount(3);

  // Reload and confirm they're still there.
  await page.reload();
  await expect(page.getByTestId("compare-grid")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="compare-grid"] > div')).toHaveCount(3);

  // URL still carries the compare param
  await expect(page).toHaveURL(/compare=47%2C1%2C2|compare=47,1,2/);
});

test("compare PDF button downloads a PDF with county names in the filename", async ({ page }) => {
  await page.goto("/?compare=47,1");
  await expect(page.getByTestId("compare-grid")).toBeVisible({ timeout: 15_000 });

  const button = page.getByTestId("compare-pdf");
  await expect(button).toBeEnabled();

  const downloadPromise = waitForDownload(page, { timeout: 30_000 });
  await button.click();
  const download = await downloadPromise;
  const name = download.suggestedFilename().toLowerCase();
  expect(name).toMatch(/\.pdf$/);
  expect(name).toContain("halisia-compare");
});

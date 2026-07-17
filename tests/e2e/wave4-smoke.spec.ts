import { test, expect } from "@playwright/test";

test("Wave 4 panel renders, refreshes, and drills down", async ({ page }) => {
  await page.goto("/explore?q=Nairobi");
  const panel = page.getByTestId("wave4-panel");
  await expect(panel).toBeVisible({ timeout: 20_000 });

  await panel.getByTestId("wave4-tab-invest").click();
  await panel.getByTestId("wave4-drill-accessibility").click();
  await expect(panel.getByText(/formula|transit|weight/i).first()).toBeVisible();

  await panel.getByTestId("wave4-tab-sources").click();
  await expect(panel.getByText(/OpenStreetMap|Open-Meteo/i).first()).toBeVisible();

  await panel.getByTestId("wave4-refresh").click();
});
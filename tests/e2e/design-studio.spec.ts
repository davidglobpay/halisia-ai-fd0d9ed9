import { expect, test } from "@playwright/test";

test("Passport links into all five Design Studio concepts and generated massing", async ({
  page,
}) => {
  await page.goto(
    "/passport?lat=-1.286389&lng=36.817223&label=Nairobi&source=Test&status=approximate",
  );
  await page.getByTestId("open-design-studio").click();
  await expect(page).toHaveURL(/\/design-studio/);
  await expect(page.getByTestId("studio-context")).toContainText("Nairobi");
  await expect(page.getByTestId("design-studio-canvas")).toBeVisible();

  for (const id of [
    "residential-villa",
    "affordable-community",
    "mixed-use-centre",
    "commercial-plaza",
    "employment-campus",
  ]) {
    await page.getByTestId(`studio-concept-${id}`).click();
    await expect(page.getByTestId(`studio-concept-${id}`)).toHaveAttribute("aria-pressed", "true");
  }

  await page.getByTestId("studio-generate").click();
  await expect(page.getByTestId("studio-generate")).toHaveAttribute("aria-pressed", "true");
});

test("Passport PDF downloads when no AI interpretation was generated", async ({ page }) => {
  await page.goto(
    "/passport?lat=-1.286389&lng=36.817223&label=Nairobi&source=Test&status=approximate",
  );
  const download = page.waitForEvent("download");
  await page.getByTestId("passport-pdf").click();
  expect((await download).suggestedFilename()).toMatch(/halisia-land-passport.*\.pdf$/);
});

import { expect, test } from "@playwright/test";
import { waitForDownload } from "./helpers/download";
import { stubLocationServices } from "./helpers/server-fns";

test("Passport links into all five Design Studio concepts and generated massing", async ({
  page,
}) => {
  await stubLocationServices(page);
  await page.goto(
    // -1.286389, 36.817223 is the default map centre, which the Passport
    // rightly refuses as a parcel position, so use a deliberate test point.
    "/passport?lat=-1.2741&lng=36.8155&label=Nairobi&source=Test&status=approximate",
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

  await page.getByTestId("studio-parking").click();
  await expect(page.getByTestId("studio-parking")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("studio-landscape").click();
  await expect(page.getByTestId("studio-landscape")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("studio-rotation").fill("45");
  await expect(page.getByText("Rotation · 45°")).toBeVisible();
  await page.getByTestId("studio-scale").fill("120");
  await expect(page.getByText("Concept scale · 120%")).toBeVisible();

  await page.getByTestId("studio-fit").click();
  await page.getByTestId("studio-reset").click();
  await expect(page.getByText("Rotation · 0°")).toBeVisible();
  await expect(page.getByText("Concept scale · 100%")).toBeVisible();
});

test("Passport PDF downloads when no AI interpretation was generated", async ({ page }) => {
  await stubLocationServices(page);
  await page.goto(
    // -1.286389, 36.817223 is the default map centre, which the Passport
    // rightly refuses as a parcel position, so use a deliberate test point.
    "/passport?lat=-1.2741&lng=36.8155&label=Nairobi&source=Test&status=approximate",
  );
  const download = waitForDownload(page);
  await page.getByTestId("passport-pdf").click();
  expect((await download).suggestedFilename()).toMatch(/halisia-land-passport.*\.pdf$/);
});

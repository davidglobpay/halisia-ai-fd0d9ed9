import { test, expect } from "@playwright/test";
import { waitForDownload } from "./helpers/download";

test("PDF dossier button shows progress UI, then downloads", async ({ page }) => {
  await page.goto("/explore?q=Kilimani");

  // Address pill resolves via geocoding
  await expect(page.getByTestId("active-address")).toContainText(/Kilimani|Nairobi/i, {
    timeout: 20_000,
  });

  const button = page.getByTestId("download-dossier");
  const downloadPromise = waitForDownload(page, { timeout: 90_000 });
  await button.click();

  // Progress UI cycles through stages (Fetching / Rendering / Compiling)
  await expect(button).toContainText(/Fetching|Rendering|Compiling|dossier|evidence/i, {
    timeout: 30_000,
  });

  const download = await downloadPromise;
  expect(download.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/);
});

test("Launch CTA on landing navigates into the workspace", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByTestId("launch-cta");
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page).toHaveURL(/\/explore/);
});

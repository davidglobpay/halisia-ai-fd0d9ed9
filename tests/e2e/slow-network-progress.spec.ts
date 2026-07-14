import { test, expect } from "@playwright/test";

// Simulate slow geocode + static-map fetches so the multi-stage progress UI
// stays visible long enough to observe, then verify the download still completes.
test("progress UI stays visible on slow network and PDF still downloads", async ({ page }) => {
  await page.route("**/_serverFn/**", async (route) => {
    // Delay every server-function call by 800ms.
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });

  await page.goto("/explore?q=Kilimani");
  await expect(page.getByTestId("active-address")).toContainText(/Kilimani|Nairobi/i, {
    timeout: 30_000,
  });

  const button = page.getByTestId("download-dossier");
  const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  await button.click();

  // At least one progress stage must be visible while we wait.
  await expect(button).toContainText(/Fetching|Rendering|Compiling|dossier|evidence/i, {
    timeout: 30_000,
  });

  const dl = await downloadPromise;
  expect(dl.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/);
});
import { test, expect } from "@playwright/test";

test("Download PDF dossier triggers a PDF download with the address in the filename", async ({
  page,
}) => {
  await page.goto("/explore?q=Kilimani");

  // Wait for geocode to resolve and the address pill to reflect the query.
  await expect(page.getByTestId("active-address")).toContainText(/Kilimani|Nairobi/i, {
    timeout: 20_000,
  });

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByTestId("download-dossier").click();

  // Progress UI should switch to a "Building…" state.
  await expect(page.getByTestId("download-dossier")).toContainText(/dossier|evidence|Compiling/i);

  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  expect(suggested.toLowerCase()).toContain("halisia-dossier");
  expect(suggested.toLowerCase()).toMatch(/\.pdf$/);
});

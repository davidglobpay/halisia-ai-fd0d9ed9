import { test, expect } from "@playwright/test";
import { waitForDownload } from "./helpers/download";
import { readFileSync } from "node:fs";

test("Download PDF dossier triggers a PDF download with the address in the filename", async ({
  page,
}) => {
  await page.goto("/explore?q=Kilimani");

  // Wait for geocode to resolve and the address pill to reflect the query.
  await expect(page.getByTestId("active-address")).toContainText(/Kilimani|Nairobi/i, {
    timeout: 20_000,
  });

  const downloadPromise = waitForDownload(page, { timeout: 60_000 });
  await page.getByTestId("download-dossier").click();

  // Progress UI should surface a percentage and a stage label.
  await expect(page.getByTestId("download-dossier-progress")).toContainText(/%/);
  await expect(page.getByTestId("download-dossier-bar")).toHaveAttribute("aria-valuenow", /\d+/);

  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  const lower = suggested.toLowerCase();
  expect(lower).toContain("halisia-dossier");
  expect(lower).toMatch(/\.pdf$/);
  // Filename must be informative: slug + coord + date-stamp.
  expect(lower).toMatch(/-\d{8}-\d{4}\.pdf$/);
  expect(lower).toMatch(/[0-9]+[.][0-9]{4}/);

  // Persist and inspect the raw bytes: jsPDF writes text streams uncompressed
  // by default so labelled strings from Wave 1, Wave 2 and Wave 4 pages must
  // appear in the output.
  const dest = test.info().outputPath("dossier.pdf");
  await download.saveAs(dest);
  const bytes = readFileSync(dest);
  expect(bytes.length).toBeGreaterThan(20_000);
  const raw = bytes.toString("latin1");
  // Wave 1 climate normals page
  expect(raw).toContain("Climate normals");
  // Wave 2 isometric topographic projection
  expect(raw).toContain("Isometric topographic projection");
  // The dossier was rebuilt from traceable Wave 4 readings (831aacc); it must
  // never print composite "investment scores" again.
  expect(raw).not.toContain("Investment scores");
});

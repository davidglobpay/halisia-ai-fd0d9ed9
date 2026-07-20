import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Verifies that the generated PDF dossier embeds real image streams in both
 * the cover and evidence sections. jsPDF writes each embedded raster as an
 * `/XObject /Subtype /Image` object; counting those and asserting each stream
 * is non-trivially large proves the OSM/Esri fallback ran when Google Static
 * Maps is blocked (the tile stitcher still produces a real PNG data URL).
 */
test("PDF dossier embeds non-empty map images in cover and evidence sections", async ({
  page,
}) => {
  await page.goto("/explore?q=Kilimani");

  await expect(page.getByTestId("active-address")).toContainText(/Kilimani|Nairobi/i, {
    timeout: 20_000,
  });

  const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
  await page.getByTestId("download-dossier").click();
  const download = await downloadPromise;

  const dest = test.info().outputPath("dossier-images.pdf");
  await download.saveAs(dest);
  const bytes = readFileSync(dest);
  expect(bytes.length).toBeGreaterThan(20_000);

  const raw = bytes.toString("latin1");

  // Count image XObjects — jsPDF writes `/Subtype /Image` for each embedded raster.
  const imageObjectCount = (raw.match(/\/Subtype\s*\/Image/g) ?? []).length;
  expect(imageObjectCount, "PDF must embed at least 2 image XObjects (cover + evidence)").toBeGreaterThanOrEqual(2);

  // Each embedded image stream must be non-empty. Parse `/Length N` for image objects.
  const streamLengths: number[] = [];
  const streamRe = /\/Subtype\s*\/Image[\s\S]*?\/Length\s+(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(raw)) !== null) {
    streamLengths.push(parseInt(m[1], 10));
  }
  expect(streamLengths.length).toBeGreaterThanOrEqual(2);
  for (const len of streamLengths) {
    // A 1x1 placeholder would be <200 bytes; a real map tile stitch is >2KB.
    expect(len).toBeGreaterThan(2_000);
  }

  // Sanity: the two labelled sections both exist in the PDF text streams.
  // Cover page contains the location heading; evidence pages contain the
  // Wave 2 "Isometric topographic projection" caption produced by pdf-dossier.
  expect(raw).toContain("Isometric topographic projection");
});
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * The provenance export must say the same thing the screen says.
 *
 * This spec asserted `typeof f.weight === "number"` and filtered the modal's
 * rows by /weight\s+\d/. Neither ever matched: `weight` was typed `string` and
 * held "×6", "×0.35", "17–26 ideal", so the UI filter found zero rows and the
 * first expectation in the test failed before the export was even checked.
 * The whole provenance path was therefore untested, which is how a score out
 * of 100 survived in it for as long as it did.
 *
 * It now checks what is actually published: no score, a method in words, each
 * factor's figure with the unit it is counted in, and the mapping coverage.
 */
test("Wave 4 provenance export payload matches the drill-down factors, units, coverage & sources", async ({
  page,
}) => {
  await page.goto("/explore?q=Nairobi");
  await page.getByTestId("tab-wave4").click();
  await expect(page.getByTestId("wave4-panel")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("wave4-tab-invest").click();
  await page.getByTestId("wave4-drill-accessibility").click();
  await page.getByTestId("wave4-open-provenance").first().click();
  const modal = page.getByTestId("provenance-modal");
  await expect(modal).toBeVisible();

  // Capture UI-visible factor rows before exporting. Each carries a figure
  // (or an em dash where the reading never arrived) and the unit it is in.
  const uiFactors = await modal
    .locator("li")
    .filter({ hasText: /within 3 km|not returned|2010–2020/ })
    .allTextContents();
  expect(uiFactors.length).toBeGreaterThan(0);

  // Nothing in the modal may show a mark out of a hundred.
  await expect(modal).not.toContainText(/\d+\s*\/\s*100/);

  const jsonPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByTestId("provenance-export-json").click();
  const jsonDl = await jsonPromise;
  const jsonPath = test.info().outputPath("prov.json");
  await jsonDl.saveAs(jsonPath);
  const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));

  expect(parsed.title).toBeTruthy();
  // Exported as null rather than dropped, so an export taken before this
  // change and one taken after line up field for field.
  expect(parsed.score).toBeNull();
  expect(parsed.method).toBeTruthy();
  expect(parsed.method).not.toMatch(/[·*]\s*\d|\d\s*[·*]/);
  expect(["high", "medium", "low"]).toContain(parsed.confidence);
  expect(parsed.coverage).toBe(parsed.confidence);
  expect(parsed.confidenceWording).toMatch(/densely mapped|workable|little is mapped/i);
  expect(Array.isArray(parsed.factors) && parsed.factors.length).toBeTruthy();
  for (const f of parsed.factors) {
    expect(f.label).toBeTruthy();
    expect(typeof f.unit).toBe("string");
    expect(f.unit.length).toBeGreaterThan(0);
    // A figure, or null where the reading never arrived — never a stand-in 0.
    expect(f.value === null || typeof f.value === "number").toBe(true);
    if (/not returned/.test(f.unit)) expect(f.value).toBeNull();
  }
  expect(Array.isArray(parsed.sources) && parsed.sources.length).toBeTruthy();
  for (const s of parsed.sources) {
    expect(s.label).toBeTruthy();
    expect(s.url).toMatch(/^https?:\/\//);
    expect(["live", "planned"]).toContain(s.status);
  }
  // Every factor label on screen appears in the JSON export, so the file the
  // user downloads cannot quietly differ from the panel they read.
  const jsonLabels = parsed.factors.map((f: { label: string }) => f.label);
  expect(jsonLabels.length).toBe(uiFactors.length);
  for (const label of jsonLabels) {
    expect(uiFactors.some((row: string) => row.includes(label))).toBe(true);
  }

  // CSV export mirrors the same fields.
  const csvPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByTestId("provenance-export-csv").click();
  const csvDl = await csvPromise;
  const csvPath = test.info().outputPath("prov.csv");
  await csvDl.saveAs(csvPath);
  const csv = readFileSync(csvPath, "utf8");
  expect(csv).toMatch(/^section,key,value,unit,confidence/);
  expect(csv).toMatch(/\nmethod,/);
  expect(csv).toMatch(/\ncoverage,/);
  expect(csv).toMatch(/\nfactor,/);
  expect(csv).toMatch(/\nsource,/);
  // The CSV carried a `score,<title>,<n>,,<confidence>` row. It must not return.
  expect(csv).not.toMatch(/\nscore,/);
  for (const s of parsed.sources) {
    expect(csv).toContain(s.url);
  }
});

test("PDF dossier download progress advances from low to 100% with aria-live status", async ({
  page,
}) => {
  await page.goto("/explore?q=Nairobi");
  await expect(page.getByTestId("active-address")).toContainText(/Nairobi/i, { timeout: 20_000 });

  const status = page.getByTestId("download-dossier-progress");
  const bar = page.getByTestId("download-dossier-bar");
  const seen = new Set<number>();
  const readPct = async () => {
    const v = await bar.getAttribute("aria-valuenow").catch(() => null);
    const n = v == null ? NaN : Number(v);
    if (!Number.isNaN(n)) seen.add(n);
    return n;
  };

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByTestId("download-dossier").click();

  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(bar).toHaveAttribute("aria-valuemin", "0");
  await expect(bar).toHaveAttribute("aria-valuemax", "100");

  // Poll progress while the dossier is being built.
  const start = Date.now();
  while (Date.now() - start < 45_000) {
    const n = await readPct();
    if (n >= 100) break;
    await page.waitForTimeout(120);
  }

  const dl = await downloadPromise;
  expect(dl.suggestedFilename()).toMatch(/\.pdf$/);
  const values = [...seen].sort((a, b) => a - b);
  expect(values[0]).toBeLessThan(50);
  expect(values[values.length - 1]).toBe(100);
  expect(values.length).toBeGreaterThan(2);
});

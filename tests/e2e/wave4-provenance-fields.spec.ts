import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("Wave 4 provenance export payload matches drill-down factors, weights, confidence & sources", async ({
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

  // Capture UI-visible factor labels + weights before exporting.
  const uiFactors = await modal
    .locator("li")
    .filter({ hasText: /weight\s+\d/ })
    .allTextContents();
  expect(uiFactors.length).toBeGreaterThan(0);

  const jsonPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByTestId("provenance-export-json").click();
  const jsonDl = await jsonPromise;
  const jsonPath = test.info().outputPath("prov.json");
  await jsonDl.saveAs(jsonPath);
  const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));

  expect(parsed.title).toBeTruthy();
  expect(typeof parsed.score).toBe("number");
  expect(parsed.formula).toBeTruthy();
  expect(["high", "medium", "low"]).toContain(parsed.confidence);
  expect(parsed.confidenceWording).toMatch(/dense|workable|limited/i);
  expect(Array.isArray(parsed.factors) && parsed.factors.length).toBeTruthy();
  for (const f of parsed.factors) {
    expect(f.label).toBeTruthy();
    expect(typeof f.weight).toBe("number");
  }
  expect(Array.isArray(parsed.sources) && parsed.sources.length).toBeTruthy();
  for (const s of parsed.sources) {
    expect(s.label).toBeTruthy();
    expect(s.url).toMatch(/^https?:\/\//);
    expect(["live", "planned"]).toContain(s.status);
  }
  // Every UI factor weight appears in the JSON export.
  const jsonWeights = parsed.factors.map((f: { weight: number }) => f.weight);
  for (const row of uiFactors) {
    const w = Number(row.match(/weight\s+(\d+(?:\.\d+)?)/)?.[1]);
    if (!Number.isNaN(w)) expect(jsonWeights).toContain(w);
  }

  // CSV export mirrors the same fields.
  const csvPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByTestId("provenance-export-csv").click();
  const csvDl = await csvPromise;
  const csvPath = test.info().outputPath("prov.csv");
  await csvDl.saveAs(csvPath);
  const csv = readFileSync(csvPath, "utf8");
  expect(csv).toMatch(/^section,key,value,weight,confidence/);
  expect(csv).toMatch(/\nformula,/);
  expect(csv).toMatch(/\nconfidence,/);
  expect(csv).toMatch(/\nfactor,/);
  expect(csv).toMatch(/\nsource,/);
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

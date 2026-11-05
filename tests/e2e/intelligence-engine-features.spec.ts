import { test, expect } from "@playwright/test";
import { waitForDownload } from "./helpers/download";
import { stubLocationServices } from "./helpers/server-fns";

test.describe("Intelligence engine · report, freshness, feedback, compare, limitations", () => {
  test("LIOS panel exposes freshness, sources, verification, feedback and limitations", async ({
    page,
  }) => {
    await stubLocationServices(page);
    await page.goto("/explore?q=Kilimani");
    const lios = page.getByTestId("land-intelligence-score");
    await expect(lios).toBeVisible({ timeout: 30_000 });

    // Download button and compare link are wired up.
    await expect(page.getByTestId("download-intelligence-pdf")).toBeVisible();
    await expect(page.getByTestId("open-compare-locations")).toBeVisible();

    // Scores, grades and the buy verdict were withdrawn from this panel (see the
    // note at the top of land-intelligence-score.tsx): it lists only modules
    // with data behind them and says it scores nothing.
    await expect(lios).toContainText("HALISIA publishes no score for this place");
    await expect(lios).not.toContainText(/Grade [A-D]/);

    // First measured module card: evidence status, source count, date, confidence.
    const first = page.getByTestId("module-card-construction");
    await expect(first).toBeVisible();
    await expect(first).toContainText(/Measured|Partly measured/);
    await expect(first).toContainText(/\d+ sources?/);
    await expect(first).toContainText(/Confidence \d+%/);

    // Expand the card, then its "What to verify next" drilldown.
    await first.locator("summary").first().click();
    const limits = page.getByTestId("limits-construction");
    await limits.locator("summary").click();
    await expect(limits).toContainText(/Check this next/);

    // Feedback widget persists a thumbs-up rating to localStorage.
    await page.getByTestId("fb-up-construction").click();
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("halisia:module-feedback:v1"),
    );
    expect(stored).toContain('"construction"');
    expect(stored).toContain('"rating":"up"');
  });

  test("Downloads an intelligence PDF containing engine sections", async ({ page }) => {
    await stubLocationServices(page);
    await page.goto("/explore?q=Kilimani");
    await expect(page.getByTestId("land-intelligence-score")).toBeVisible({ timeout: 30_000 });

    const dl = waitForDownload(page, { timeout: 45_000 });
    await page.getByTestId("download-intelligence-pdf").click();
    const download = await dl;
    const name = download.suggestedFilename().toLowerCase();
    expect(name).toContain("halisia-readings");
    expect(name).toMatch(/\.pdf$/);

    const dest = test.info().outputPath("intelligence.pdf");
    await download.saveAs(dest);
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(dest).toString("latin1");
    // Section headings of the current report (src/lib/pdf-intelligence.ts).
    expect(raw).toContain("LOCATION READINGS");
    expect(raw).toContain("What was measured");
    expect(raw).toContain("Who to bring in next");
    // The scored report it replaced must not come back.
    expect(raw).not.toContain("Module scores");
  });

  test("Compare Locations recomputes LIOS side-by-side and shows deltas", async ({ page }) => {
    await stubLocationServices(page);
    await page.goto("/compare-locations?a=Kilimani&b=Nakuru");
    await expect(page.getByRole("heading", { name: /Compare two locations/i })).toBeVisible();

    const a = page.getByTestId("cmp-col-a");
    const b = page.getByTestId("cmp-col-b");
    await expect(a).toBeVisible();
    await expect(b).toBeVisible();

    // Both columns resolve and list what was measured, without a grade.
    for (const col of [a, b]) {
      await expect(col).toContainText(/\d+ measured · \d+ projected · \d+ not assessed/, {
        timeout: 45_000,
      });
      await expect(col).not.toContainText(/Grade [A-D]/);
    }
    // A module counted as measured is labelled "Measured", not "Not assessed".
    await expect(a.locator("li", { hasText: "Construction" })).toContainText("Measured");

    // The difference section explains why nothing is subtracted.
    const delta = page.getByTestId("cmp-delta");
    await expect(delta).toBeVisible({ timeout: 45_000 });
    await expect(delta).toContainText(/What differs between the readings/i);
    await expect(delta).toContainText(/HALISIA publishes no scores/);
    await expect(delta).toContainText(/not a recommendation to buy/i);
  });
});

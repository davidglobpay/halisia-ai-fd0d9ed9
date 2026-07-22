import { test, expect } from "@playwright/test";

test.describe("Intelligence engine · report, freshness, feedback, compare, limitations", () => {
  test("LIOS panel exposes freshness, sources, verification, feedback and limitations", async ({
    page,
  }) => {
    await page.goto("/explore?q=Kilimani");
    const lios = page.getByTestId("land-intelligence-score");
    await expect(lios).toBeVisible({ timeout: 30_000 });

    // Download button and compare link are wired up.
    await expect(page.getByTestId("download-intelligence-pdf")).toBeVisible();
    await expect(page.getByTestId("open-compare-locations")).toBeVisible();

    // First module card has verification badge, source count, freshness and confidence line.
    const first = page.getByTestId("module-card-investment");
    await expect(first).toBeVisible();
    await expect(first).toContainText(/Verified|AI-Estimated|Unverified/);
    await expect(first).toContainText(/sources/);
    await expect(first).toContainText(/Confidence \d+%/);

    // Expand the "Possible limitations" drilldown.
    await first.click();
    const limits = page.getByTestId("limits-investment");
    await limits.getByRole("group").first().or(limits).click(); // open <details>
    await expect(limits).toContainText(/Cannot verify from open data/);
    await expect(limits).toContainText(/Check this next/);

    // Feedback widget persists a thumbs-up rating to localStorage.
    await page.getByTestId("fb-up-investment").click();
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("halisia:module-feedback:v1"),
    );
    expect(stored).toContain('"investment"');
    expect(stored).toContain('"rating":"up"');
  });

  test("Downloads an intelligence PDF containing engine sections", async ({ page }) => {
    await page.goto("/explore?q=Kilimani");
    await expect(page.getByTestId("land-intelligence-score")).toBeVisible({ timeout: 30_000 });

    const dl = page.waitForEvent("download", { timeout: 45_000 });
    await page.getByTestId("download-intelligence-pdf").click();
    const download = await dl;
    const name = download.suggestedFilename().toLowerCase();
    expect(name).toContain("halisia-intelligence");
    expect(name).toMatch(/\.pdf$/);

    const dest = test.info().outputPath("intelligence.pdf");
    await download.saveAs(dest);
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(dest).toString("latin1");
    expect(raw).toContain("Executive summary");
    expect(raw).toContain("Module scores");
    expect(raw).toContain("Possible limitations");
    expect(raw).toContain("Recommended professionals");
  });

  test("Compare Locations recomputes LIOS side-by-side and shows deltas", async ({ page }) => {
    await page.goto("/compare-locations?a=Kilimani&b=Nakuru");
    await expect(page.getByRole("heading", { name: /Compare two locations/i })).toBeVisible();

    const a = page.getByTestId("cmp-col-a");
    const b = page.getByTestId("cmp-col-b");
    await expect(a).toBeVisible();
    await expect(b).toBeVisible();

    // Both columns should eventually render a numeric score & a full module list.
    await expect(a).toContainText(/Grade/i, { timeout: 45_000 });
    await expect(b).toContainText(/Grade/i, { timeout: 45_000 });

    // Δ table appears with driver reasons.
    await expect(page.getByTestId("cmp-delta")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("cmp-delta")).toContainText(/What drives the difference/i);
    await expect(page.getByTestId("cmp-delta")).toContainText(/Winner/i);
  });
});

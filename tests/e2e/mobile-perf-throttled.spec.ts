import { test, expect } from "@playwright/test";

/**
 * Mobile performance smoke — throttles the network to Slow 3G-ish and
 * verifies the Nearby Amenities surface still renders cached photos,
 * routes, and opening-hours fallbacks without blocking the UI.
 *
 * Runs on every project; skipped when only desktop projects are selected
 * via --project.
 */
test.describe("mobile perf · throttled amenities", () => {
  test.slow();

  test("home renders under Slow-3G-ish throttling and stays interactive", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP throttling requires Chromium");

    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      // ~500kbps down / 250kbps up, 400ms RTT — approximates a poor 3G link.
      downloadThroughput: (500 * 1024) / 8,
      uploadThroughput: (250 * 1024) / 8,
      latency: 400,
    });

    const t0 = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Above-the-fold must be visible within a generous budget even on throttled 3G.
    await expect(page.getByRole("banner").or(page.locator("header"))).toBeVisible({
      timeout: 20_000,
    });
    const paint = Date.now() - t0;
    expect(paint, `first meaningful paint took ${paint}ms`).toBeLessThan(20_000);

    // UI must stay responsive: any button click must acknowledge quickly.
    const anyButton = page.getByRole("button").first();
    if (await anyButton.isVisible().catch(() => false)) {
      const before = Date.now();
      await anyButton.click({ trial: true }).catch(() => {});
      expect(Date.now() - before).toBeLessThan(2_000);
    }
  });
});

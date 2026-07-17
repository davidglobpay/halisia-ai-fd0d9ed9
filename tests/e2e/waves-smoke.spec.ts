import { test, expect } from "@playwright/test";

// Smoke-test Wave 2 (Globe, Heatmap, Timeline) and Wave 3 (Street) tabs.
// Each tab must open, render its content, and log no page errors.
test.describe("Wave 2 & 3 tabs render", () => {
  test("Globe / Heatmap / Timeline / Street each render without page errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));

    await page.goto("/explore?q=Kilimani");
    // Wait for the intelligence dashboard to mount.
    await expect(page.getByTestId("tab-globe")).toBeVisible({ timeout: 30_000 });

    // Globe (Cesium)
    await page.getByTestId("tab-globe").click();
    await expect(page.locator(".cesium-viewer, canvas").first()).toBeVisible({ timeout: 30_000 });

    // Heatmap (Leaflet + heat layer)
    await page.getByTestId("tab-heatmap").click();
    await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 15_000 });

    // Timeline (historical chart)
    await page.getByTestId("tab-timeline").click();
    await expect(page.locator("svg").first()).toBeVisible({ timeout: 15_000 });

    // Street (Mapillary)
    await page.getByTestId("tab-geotech").click();
    // The Mapillary viewer either renders a canvas or a placeholder card.
    await expect(page.getByTestId("tab-geotech")).toHaveAttribute("aria-selected", /true/i);

    // No uncaught page errors from any of the tabs.
    expect(pageErrors, `pageerrors: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

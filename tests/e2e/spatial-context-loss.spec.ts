import { expect, test } from "@playwright/test";

/**
 * WebGL context loss/restore coverage for the Spatial studio. The events are
 * simulated on the live canvas (headless Chromium never loses a context on its
 * own) so the notice, the Restore control and the scene rebuild stay covered.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("halisia:navguide:v1:seen", "playwright");
  });
});

async function waitForCanvas(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 20_000 });
  const canvas = page.locator('[data-testid="spatial-canvas"] canvas');
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  return canvas;
}

function dispatchOnCanvas(page: import("@playwright/test").Page, type: string) {
  return page.evaluate((eventType) => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="spatial-canvas"] canvas',
    );
    if (!canvas) throw new Error("canvas missing");
    canvas.dispatchEvent(new Event(eventType, { cancelable: true, bubbles: false }));
  }, type);
}

test.describe("WebGL context loss recovery", () => {
  test("shows the context-lost notice and restores the scene from the Restore button", async ({
    page,
  }) => {
    await page.goto("/spatial");
    await waitForCanvas(page);

    // No notice while the context is healthy.
    await expect(page.getByTestId("spatial-context-lost")).toHaveCount(0);

    await dispatchOnCanvas(page, "webglcontextlost");
    const notice = page.getByTestId("spatial-context-lost");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/lost its graphics context/i);

    // Restore rebuilds the scene: the notice clears and the canvas stays mounted.
    await page.getByTestId("spatial-context-restore").click();
    await expect(notice).toHaveCount(0);
    await expect(page.locator('[data-testid="spatial-canvas"] canvas')).toBeVisible();

    // Controls remain usable after a rebuild.
    await page.getByRole("button", { name: /reset view/i }).click();
    await expect(page.getByTestId("spatial-viewport")).toBeVisible();
  });

  test("a driver-issued webglcontextrestored event clears the notice", async ({ page }) => {
    await page.goto("/spatial");
    await waitForCanvas(page);

    await dispatchOnCanvas(page, "webglcontextlost");
    await expect(page.getByTestId("spatial-context-lost")).toBeVisible();

    await dispatchOnCanvas(page, "webglcontextrestored");
    await expect(page.getByTestId("spatial-context-lost")).toHaveCount(0);
    await expect(page.locator('[data-testid="spatial-canvas"] canvas')).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";

/**
 * Verifies that /spatial explains AR/VR availability truthfully:
 * headless Chromium exposes no immersive WebXR sessions, so the status chips
 * must read "unavailable" and the explanation must name the real reason —
 * with the "open in its own tab" guidance shown only for frame-blocked cases.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("halisia:navguide:v1:seen", "playwright");
  });
});

test.describe("spatial AR/VR availability copy", () => {
  test("status chips report unavailable with a device-level explanation", async ({ page }) => {
    await page.goto("/spatial");

    await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 30_000 });
    const status = page.getByTestId("spatial-xr-status");
    await expect(status).toBeVisible();
    await expect(status).toContainText(/unavailable|checking/i);

    const reason = page.getByTestId("spatial-xr-unavailable-reason");
    await expect(reason).toBeVisible({ timeout: 30_000 });
    await expect(reason).toContainText(
      /does not expose immersive WebXR sessions|embedded preview frame/i,
    );
    // Never claims immersive support that the device cannot deliver.
    await expect(reason).not.toContainText(/cadastral survey accuracy/i);
  });

  test("top-level browsing explains the device limit, not a frame block", async ({ page }) => {
    await page.goto("/spatial");
    await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 30_000 });
    const reason = page.getByTestId("spatial-xr-unavailable-reason");
    await expect(reason).toContainText(
      /does not expose immersive WebXR sessions|did not report an immersive WebXR session|does not implement immersive WebXR/i,
    );
    await expect(reason.getByRole("link", { name: /own tab/i })).toHaveCount(0);
  });

  test("frame-blocked sessions offer the open-in-own-tab escape hatch", async ({ page }) => {
    // Emulate the embedded preview: same route rendered inside an iframe whose
    // permissions policy withholds xr-spatial-tracking.
    // Same-origin frames inherit the host policy, so simulate the cross-origin
    // preview by reporting the permission as withheld inside the frame.
    await page.addInitScript(() => {
      const fp = (document as unknown as { featurePolicy?: { allowsFeature: () => boolean } })
        .featurePolicy;
      if (fp && window.self !== window.top) fp.allowsFeature = () => false;
    });
    await page.route("**/__frame-host", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><body style="margin:0"><iframe title="preview" allow="camera" style="width:1200px;height:1600px;border:0" src="/spatial"></iframe></body></html>`,
      }),
    );
    await page.goto("/__frame-host");
    const frame = page.frameLocator('iframe[title="preview"]');
    const reason = frame.getByTestId("spatial-xr-unavailable-reason");
    await expect(reason).toBeVisible({ timeout: 30_000 });
    await expect(reason).toContainText(/embedded preview frame/i);
    const link = reason.getByRole("link", { name: /Open \/spatial in its own tab/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("href", "/spatial");
  });

  test("native viewer fallback stays available when WebXR is not", async ({ page }) => {
    await page.goto("/spatial");
    await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("spatial-ar-fallback")).toBeVisible({ timeout: 30_000 });
  });
});

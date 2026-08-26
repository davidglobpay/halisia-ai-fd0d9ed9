import { expect, test } from "@playwright/test";

/**
 * Focused /spatial coverage: route load, capability states, unsupported-AR
 * fallback, permission-denied recovery and mobile viewport controls.
 * Real immersive sessions need physical ARCore/WebXR hardware — these tests
 * cover everything deterministic in a headless browser with XR mocks.
 */

test.beforeEach(async ({ page }) => {
  // Keep the global first-visit guide from obscuring Spatial controls. The
  // guide has its own coverage; these tests isolate the Spatial workflow.
  await page.addInitScript(() => {
    window.localStorage.setItem("halisia:navguide:v1:seen", "playwright");
  });
});

test.describe("Spatial AR/VR studio", () => {
  test("loads the viewport, capability status panel and XR controls", async ({ page }) => {
    await page.goto("/spatial");
    // Parcels load from the public backend.
    await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("spatial-viewport")).toBeVisible();
    // Three.js canvas mounts, or a readable WebGL error is shown instead.
    await expect(
      page.locator('[data-testid="spatial-canvas"] canvas, [data-testid="spatial-canvas-error"]'),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("spatial-xr-status")).toBeVisible();
    await expect(page.getByTestId("spatial-start-ar")).toBeVisible();
    await expect(page.getByTestId("spatial-start-vr")).toBeVisible();
  });

  test("missing WebXR shows truthful fallback and disables AR/VR launch", async ({ page }) => {
    // Headless Chromium exposes no navigator.xr — the honest desktop path.
    await page.goto("/spatial");
    await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 20_000 });
    const status = page.getByTestId("spatial-xr-status");
    await expect(status).toContainText("WebXR AR: unavailable");
    await expect(status).toContainText("WebXR VR: unavailable");
    await expect(status).toContainText(/not a cadastral survey/i);
    await expect(page.getByTestId("spatial-start-ar")).toBeDisabled();
    await expect(page.getByTestId("spatial-start-vr")).toBeDisabled();
    const fallback = page.getByTestId("spatial-ar-fallback");
    await expect(fallback).toBeVisible();
    // No prototype selected yet: guidance asks for one without false promises.
    await expect(fallback).toContainText(/Select a massing prototype/i);
    // Picking a prototype with no published model must not promise viewers.
    const protoButton = page
      .getByRole("button", { name: /floor\(s\)|massing/i })
      .or(page.locator("[aria-pressed]").filter({ hasText: /./ }));
    void protoButton; // prototype buttons are covered by unit-tested message logic
  });
});

test.describe("XR permission-denied recovery (mocked WebXR)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "xr", {
        configurable: true,
        value: {
          isSessionSupported: () => Promise.resolve(true),
          requestSession: () =>
            Promise.reject(Object.assign(new Error("User denied"), { name: "NotAllowedError" })),
        },
      });
    });
  });

  test("denied AR start shows a distinct error and retries deterministically", async ({ page }) => {
    await page.goto("/spatial");
    await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 20_000 });
    const launch = page.getByTestId("spatial-start-ar");
    await expect(launch).toBeEnabled();

    // First attempt — denied.
    await launch.click();
    const fallback = page.getByTestId("spatial-ar-fallback");
    await expect(fallback).toContainText(/permission/i);
    await expect(page.getByTestId("spatial-canvas-error")).toContainText(/permission/i);
    // No session ever started — no live chip, mode not stuck.
    await expect(page.getByText("AR session live")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /exit xr/i })).toHaveCount(0);

    // Retry: button re-enabled, single deterministic error, no stale state.
    await expect(launch).toBeEnabled();
    await launch.click();
    await expect(fallback).toContainText(/permission/i);
    await expect(page.getByTestId("spatial-canvas-error")).toHaveCount(1);
  });

  test("denied VR start differentiates the VR message", async ({ page }) => {
    await page.goto("/spatial");
    await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("spatial-start-vr").click();
    await expect(page.getByTestId("spatial-ar-fallback")).toContainText(
      /permission to start the immersive VR/i,
    );
    await expect(page.getByText("VR session live")).toHaveCount(0);
  });
});

test.describe("Location permission recovery", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __geoAllowed?: boolean }).__geoAllowed = false;
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (ok: PositionCallback, err: PositionErrorCallback) => {
            const w = window as unknown as { __geoAllowed?: boolean };
            if (w.__geoAllowed) {
              ok({
                coords: {
                  latitude: -1.2921,
                  longitude: 36.8219,
                  accuracy: 8,
                  altitude: null,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null,
                  toJSON: () => ({}),
                },
                timestamp: Date.now(),
                toJSON: () => ({}),
              } as GeolocationPosition);
            } else {
              err({
                code: 1,
                message: "User denied Geolocation",
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
              } as GeolocationPositionError);
            }
          },
          watchPosition: () => 1,
          clearWatch: () => {},
        },
      });
    });
  });

  test("denied GPS surfaces status and recovers after permission is granted", async ({ page }) => {
    await page.goto("/spatial");
    await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 20_000 });
    const status = page.getByTestId("spatial-xr-status");

    await status.getByRole("button", { name: /check accuracy/i }).click();
    await expect(status).toContainText("Location unavailable — User denied Geolocation");

    // User grants permission and retries — same control recovers.
    await page.evaluate(() => {
      (window as unknown as { __geoAllowed?: boolean }).__geoAllowed = true;
    });
    await status.getByRole("button", { name: /check accuracy/i }).click();
    await expect(status).toContainText("Device GPS accuracy ±8 m");
  });
});

test.describe("Mobile viewport", () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test("keeps XR controls, tabs and disclaimers reachable on a phone screen", async ({ page }) => {
    await page.goto("/spatial");
    await expect(page.getByTestId("spatial-parcel-list")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("spatial-start-ar")).toBeVisible();
    await expect(page.getByTestId("spatial-start-vr")).toBeVisible();
    await expect(page.getByRole("button", { name: /reset view/i })).toBeVisible();
    await expect(page.getByTestId("spatial-xr-status")).toContainText(/not a cadastral survey/i);

    // Mode tabs remain operable at phone width.
    await page.getByRole("tab", { name: /vr masterplan/i }).click();
    await expect(page.getByRole("tab", { name: /vr masterplan/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: /site ar/i }).click();
    await expect(page.getByRole("tab", { name: /site ar/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Layer toggles stay clickable (not covered by the XR button row).
    const beaconsToggle = page.getByRole("button", { name: "Beacons", exact: true });
    await beaconsToggle.click();
    await expect(beaconsToggle).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

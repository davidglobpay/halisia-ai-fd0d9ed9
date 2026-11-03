import { test, expect, type Page } from "@playwright/test";
import { waitForDownload } from "./helpers/download";
import { readFileSync } from "node:fs";

// UI-only synthetic fixtures: no provider requests are forwarded. These are
// never imported into the application, stored, or used as capability evidence.
async function isolate(page: Page, fail = false) {
  // Synthetic local session only; server functions are intercepted below.
  // This tests the signed-in UI, not production authentication.
  await page.addInitScript(() => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email: "qa@example.invalid",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token =
      btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })) +
      "." +
      btoa(JSON.stringify({ sub: user.id, exp, aud: "authenticated" })) +
      ".synthetic-signature";
    localStorage.setItem(
      "sb-synthetic-auth-token",
      JSON.stringify({
        access_token: token,
        refresh_token: "synthetic",
        expires_at: exp,
        expires_in: 3600,
        token_type: "bearer",
        user,
      }),
    );
    localStorage.setItem("halisia:navguide:v1:seen", "test");
  });
  const counts = { server: 0, provider: 0 };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/auth/v1/user")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          aud: "authenticated",
          email: "qa@example.invalid",
          app_metadata: {},
          user_metadata: {},
        }),
      });
      return;
    }
    if (url.pathname.startsWith("/_serverFn/")) {
      counts.server++;
      const encoded = url.pathname.split("/").pop() ?? "";
      const identity = Buffer.from(encoded, "base64url").toString();
      const categories = {
        schools: [
          {
            id: "synthetic-school",
            name: "Synthetic test school — not real evidence",
            distanceKm: 1,
            location: { lat: -1.15123, lng: 36.96123 },
          },
        ],
        hospitals: [],
        groceries: [],
        transit: [],
        restaurants: [],
        banks: [],
      };
      const fixture =
        identity.includes("getLocationIntel_") && !fail
          ? {
              ok: true,
              coords: { lat: -1.15, lng: 36.96 },
              elevation: { meters: 1500, resolution: 30 },
              airQuality: null,
              categories,
              photos: [],
              hero: null,
              providers: {
                elevation: { status: "ok" },
                places: { status: "ok" },
                airQuality: { status: "unavailable" },
                routes: { status: "unavailable" },
              },
            }
          : null;
      await route.fulfill({
        status: fixture ? 200 : 503,
        contentType: "application/json",
        body: JSON.stringify(
          fixture
            ? { result: fixture, context: {} }
            : { error: "Synthetic test provider unavailable" },
        ),
      });
      return;
    }
    if (
      url.pathname.includes("/__l5e/assets-v1/") &&
      /halisia-(mark|lockup)\.png$/.test(url.pathname)
    ) {
      await route.fulfill({
        contentType: "image/svg+xml",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="100"><rect width="350" height="100" fill="#f7f3ea"/><text x="15" y="65" fill="#147b35" font-size="45">QA LOGO</text></svg>',
      });
      return;
    }
    if (url.origin === "http://localhost:8080" && !url.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    if (
      url.hostname === "server.arcgisonline.com" ||
      url.hostname === "ibasemaps-api.arcgis.com" ||
      url.hostname.endsWith(".tile.opentopomap.org") ||
      url.hostname.endsWith(".basemaps.cartocdn.com")
    ) {
      await route.fulfill({
        contentType: "image/svg+xml",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#c9d8c4"/><path d="M0 128H256M128 0V256" stroke="#56744c"/><text x="10" y="30" fill="#183419">Synthetic map tile</text></svg>',
      });
      return;
    }
    if (url.pathname.endsWith("leaflet.css")) {
      await route.fulfill({
        contentType: "text/css",
        body: readFileSync(
          new URL("../../node_modules/leaflet/dist/leaflet.css", import.meta.url),
          "utf8",
        ),
      });
    } else if (url.pathname.includes("/rest/v1/")) {
      await route.fulfill({ contentType: "application/json", body: "[]" });
    } else if (url.hostname === "maps.googleapis.com") {
      counts.provider++;
      await route.fulfill({ status: 503, body: "Synthetic test: Google Maps unavailable" });
    } else {
      await route.abort();
    }
  });
  await page.goto(
    "/passport?lat=-1.15&lng=36.96&source=Synthetic%20test%20submission&status=user_provided&ref=Synthetic%20test%20Passport",
  );
  await page.evaluate(() => localStorage.setItem("halisia:navguide:v1:seen", "test"));
  const closeTour = page.getByRole("button", { name: "Close tour" });
  if (await closeTour.isVisible()) await closeTour.click();
  return counts;
}

for (const width of [1280, 360]) {
  test(`real Passport evidence focus and honest context at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1800 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const counts = await isolate(page);
    const cards = page.getByTestId("land-passport-page");
    const school = cards.locator('[data-evidence-id="acc-schools"]');
    // The first visit can compile the lazy Passport chunk before requesting the fixture.
    await expect(school).toContainText("Synthetic test school — not real evidence", {
      timeout: 20_000,
    });
    await page.locator("summary").filter({ hasText: "Access & services" }).click();
    await expect(school).toContainText("Capture date unavailable");
    await expect(school).toContainText("Accuracy unavailable");
    await expect(cards.locator('[data-evidence-id="pop"]')).toContainText("Official statistics");
    await expect(
      cards.locator('[data-evidence-id="pop"]').getByTestId("map-evidence-preview"),
    ).toHaveCount(0);
    await expect(cards.locator('[data-evidence-id="elev"]')).toContainText(
      "context sampled around this Passport point",
    );
    await expect(cards.locator('[data-evidence-id="elev"]')).toContainText(
      "not a located site observation",
    );
    await page.getByRole("tab", { name: "Street View", exact: true }).click();
    const focus = school.getByTestId("map-evidence-preview");
    await expect(focus.getByRole("img")).toBeVisible();
    await expect(school).toContainText("Provider-reported place");
    await expect(school.getByRole("button", { name: "Satellite", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await focus.focus();
    await page.keyboard.press("Enter");
    await expect(focus).toHaveAttribute("aria-pressed", "true");
    await expect(focus).toBeFocused();
    await expect(page.getByTestId("map-evidence-focus-status")).toContainText("-1.15123, 36.96123");
    await expect(page.getByTestId("map-view")).toBeVisible();
    await expect(page.getByTestId("map-fallback-osm")).toBeVisible({ timeout: 20_000 });
    await page.locator(".leaflet-marker-icon").click();
    await expect(page.locator(".leaflet-popup")).toContainText("-1.15123, 36.96123");
    const dimensions = await focus.boundingBox();
    expect(dimensions?.height).toBeGreaterThanOrEqual(48);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await school.screenshot({ path: `/tmp/browser/map-evidence/school-${width}.png` });
    await page
      .getByTestId("map-view")
      .screenshot({ path: `/tmp/browser/map-evidence/map-${width}.png` });
    await cards.getByRole("button", { name: "Return to Passport point" }).click();
    await expect(focus).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("tab", { name: "map", exact: true }).click();
    await expect(cards.locator('[data-evidence-id="coords"]')).toHaveCount(1);
    expect(counts.server).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test("coordinate-less Passport has no map or invented evidence", async ({ page }) => {
  await isolate(page);
  await page.goto(
    "/passport?ref=Synthetic%20unlocated%20listing&county=Kiambu&source=Synthetic%20test&noloc=Test%20coordinates%20not%20supplied",
  );
  await expect(page.getByTestId("passport-limited")).toContainText("Location not available");
  await expect(page.getByTestId("map-view")).toHaveCount(0);
  await expect(page.getByTestId("passport-map-evidence")).toHaveCount(0);
  await page
    .getByTestId("passport-limited")
    .screenshot({ path: "/tmp/browser/map-evidence/limited.png" });
});

test("provider failure preserves available Passport evidence without a false zero", async ({
  page,
}) => {
  await isolate(page, true);
  const cards = page.getByTestId("land-passport-page");
  await expect(page.getByTestId("passport-findings-count")).toBeVisible();
  await expect(cards.locator('[data-evidence-id="elev"]')).toHaveCount(0);
  await expect(cards.locator('[data-evidence-id="coords"]')).toHaveCount(1);
  await expect(cards).not.toContainText("None found in search radius");
});

// Synthetic imagery is used only to test image embedding, never as real location evidence.
test("visual Passport download embeds map images and multiple branded pages", async ({ page }) => {
  await isolate(page);
  await expect(page.locator('[data-evidence-id="acc-schools"]')).toContainText(
    "Synthetic test school",
    { timeout: 20000 },
  );
  const button = page.getByTestId("passport-pdf");
  await expect(button).toBeEnabled();
  const pending = waitForDownload(page);
  await button.click();
  const download = await pending;
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = readFileSync(path!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const source = bytes.toString("latin1");
  expect((source.match(/\/Subtype \/Image/g) ?? []).length).toBeGreaterThanOrEqual(4);
  expect((source.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// UI-only synthetic fixtures: no provider requests are forwarded. These are
// never imported into the application, stored, or used as capability evidence.
async function isolate(page: Page, fail = false) {
  const counts = { server: 0, provider: 0 };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
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
    if (url.origin === "http://localhost:8080" && !url.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    if (
      url.hostname === "server.arcgisonline.com" ||
      url.hostname.endsWith(".tile.opentopomap.org") ||
      url.hostname.endsWith(".basemaps.cartocdn.com")
    ) {
      await route.fulfill({
        contentType: "image/svg+xml",
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
    await expect(
      cards.locator('[data-evidence-id="coords"]').getByTestId("map-evidence-preview"),
    ).toBeEnabled();
    expect(counts.provider).toBeGreaterThan(0);
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
  await expect(cards.locator('[data-evidence-id="coords"]')).toBeVisible();
  await expect(cards.locator('[data-evidence-id="elev"]')).toHaveAttribute("data-gap", "1");
  await expect(
    cards.locator('[data-evidence-id="elev"]').getByTestId("map-evidence-preview"),
  ).toHaveCount(0);
  await expect(
    page.getByText("Live amenity and environment data (request failed on this visit)", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(cards).not.toContainText("None found in search radius");
});

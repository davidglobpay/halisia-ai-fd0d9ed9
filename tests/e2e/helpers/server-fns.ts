import type { Page, Route } from "@playwright/test";
import { toCrossJSON } from "seroval";

/**
 * Test-only stand-ins for server functions that need Lovable-held secrets
 * (Google Maps through Lovable's connector gateway) or the Lovable Cloud
 * database. CI has neither, so without these stubs those calls fail and the
 * pages show their "unavailable" states instead of the journeys under test.
 *
 * Every value here is synthetic and labelled as such. Nothing is imported into
 * the application, stored, or used as evidence.
 *
 * Wire format: CI builds with E2E_READABLE_SERVER_FN_IDS=1, so the id in
 * `/_serverFn/<id>` is base64url of `<file>--<name>_createServerFn_handler`.
 * Responses must be seroval cross-JSON with the `x-tss-serialized` header,
 * exactly as TanStack Start's server sends them.
 */

export type ServerFnHandler = (payload: unknown) => unknown;

export function serverFnName(url: string): string | null {
  const u = new URL(url);
  if (!u.pathname.startsWith("/_serverFn/")) return null;
  const id = u.pathname.split("/").pop() ?? "";
  let decoded = "";
  try {
    decoded = Buffer.from(id, "base64url").toString();
  } catch {
    return null;
  }
  const m = /--([A-Za-z0-9]+)_createServerFn_handler$/.exec(decoded);
  return m ? m[1] : null;
}

export async function fulfillServerFn(route: Route, result: unknown) {
  await route.fulfill({
    status: 200,
    headers: { "content-type": "application/json", "x-tss-serialized": "true" },
    body: JSON.stringify(toCrossJSON({ result, error: undefined, context: {} })),
  });
}

/** Best-effort read of the call's input, for handlers that branch on it. */
function readPayload(route: Route): unknown {
  const req = route.request();
  const raw =
    req.method() === "GET"
      ? new URL(req.url()).searchParams.get("payload")
      : (req.postData() ?? null);
  return raw ?? null;
}

/** Stub the named server functions; every other call reaches the test server. */
export async function stubServerFns(page: Page, handlers: Record<string, ServerFnHandler>) {
  await page.route("**/_serverFn/**", async (route) => {
    const name = serverFnName(route.request().url());
    const handler = name ? handlers[name] : undefined;
    if (!handler) {
      await route.fallback();
      return;
    }
    await fulfillServerFn(route, handler(readPayload(route)));
  });
}

// ---------------------------------------------------------------------------
// Synthetic location data
// ---------------------------------------------------------------------------

/** Public town-centre coordinates, used only so the map has somewhere to go. */
const PLACES: Array<{ match: RegExp; address: string; lat: number; lng: number }> = [
  { match: /kisumu/i, address: "Kisumu, Kenya (test fixture)", lat: -0.0917, lng: 34.768 },
  { match: /mombasa/i, address: "Mombasa, Kenya (test fixture)", lat: -4.0435, lng: 39.6682 },
  { match: /nakuru/i, address: "Nakuru, Kenya (test fixture)", lat: -0.3031, lng: 36.08 },
  {
    match: /kilimani/i,
    address: "Kilimani, Nairobi, Kenya (test fixture)",
    lat: -1.2921,
    lng: 36.7856,
  },
  { match: /karen/i, address: "Karen, Nairobi, Kenya (test fixture)", lat: -1.3197, lng: 36.7073 },
  { match: /.*/, address: "Nairobi, Kenya (test fixture)", lat: -1.2841, lng: 36.8155 },
];

function geocodeFixture(payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload ?? "");
  const hit = PLACES.find((p) => p.match.test(text)) ?? PLACES[PLACES.length - 1];
  return {
    ok: true as const,
    address: hit.address,
    lat: hit.lat,
    lng: hit.lng,
    placeId: "synthetic-test-place",
    locationType: "APPROXIMATE",
    types: ["locality"],
    radiusM: 2500,
    partialMatch: false,
    candidates: 1,
  };
}

function reverseGeocodeFixture() {
  return {
    ok: true as const,
    address: "Synthetic test pin — not a real address",
    placeId: null,
    admin: { locality: null, subCounty: null, ward: null },
  };
}

function place(id: string, name: string, km: number, lat: number, lng: number) {
  return {
    id,
    name,
    address: "Synthetic test address",
    distanceKm: km,
    driveMin: Math.round(km * 3),
    walkMin: Math.round(km * 12),
    driveKm: km,
    location: { lat, lng },
    openNow: true,
    businessStatus: "OPERATIONAL",
  };
}

export function locationIntelFixture(lat = -1.286389, lng = 36.817223) {
  const near = (dLat: number, dLng: number) => [lat + dLat, lng + dLng] as const;
  return {
    ok: true as const,
    coords: { lat, lng },
    elevation: { meters: 1500, resolution: 30 },
    airQuality: null,
    categories: {
      schools: [
        place(
          "synthetic-school",
          "Synthetic test school — not real evidence",
          1,
          ...near(0.005, 0.005),
        ),
      ],
      hospitals: [
        place(
          "synthetic-clinic",
          "Synthetic test clinic — not real evidence",
          1.6,
          ...near(-0.006, 0.008),
        ),
      ],
      groceries: [
        place(
          "synthetic-shop",
          "Synthetic test shop — not real evidence",
          0.8,
          ...near(0.003, -0.004),
        ),
      ],
      transit: [],
      restaurants: [],
      banks: [],
    },
    photos: [],
    hero: null,
    providers: {
      elevation: { status: "ok" },
      places: { status: "ok" },
      airQuality: { status: "unavailable", reason: "Synthetic test: not requested" },
      routes: { status: "unavailable", reason: "Synthetic test: not requested" },
    },
    snapshot: { key: "synthetic-test", slices: {} },
  };
}

function coordsFrom(payload: unknown): { lat: number; lng: number } {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload ?? "");
  // seroval encodes numbers as {"t":0,"s":<n>} in key order lat, lng.
  const nums = [...text.matchAll(/"s":(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  const [lat, lng] = nums;
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90
    ? { lat, lng }
    : { lat: -1.286389, lng: 36.817223 };
}

/**
 * Geocoding, reverse geocoding and nearby-place lookups, which in production go
 * through Lovable's Google Maps connector and need its secret keys.
 */
export async function stubLocationServices(page: Page) {
  await stubServerFns(page, {
    geocodeAddress: geocodeFixture,
    reverseGeocode: reverseGeocodeFixture,
    getLocationIntel: (payload) => {
      const { lat, lng } = coordsFrom(payload);
      return locationIntelFixture(lat, lng);
    },
  });
}

import { describe, expect, it } from "vitest";
import {
  redact,
  ordersEnabled,
  checkOrderGates,
  checkDuplicate,
  checkAoi,
  ringToWkt,
  shouldRetry,
  backoffMs,
  MAX_AOI_SQ_KM,
} from "@/lib/skyfi.server";

/**
 * A synthetic credential with the same shape as a real SkyFi key
 * (email:token). No live key ever appears in this repository.
 */
const TOKEN = "a".repeat(32) + "b".repeat(32);
const KEY = `user@example.com:${TOKEN}`;

const SQUARE = [
  { lat: -1.3, lng: 36.8 },
  { lat: -1.3, lng: 36.81 },
  { lat: -1.29, lng: 36.81 },
  { lat: -1.29, lng: 36.8 },
];

describe("the credential never survives a path to a log", () => {
  it.each([
    ["the whole key", `SkyFi returned 403 for ${KEY}`],
    ["the token half", `token=${TOKEN} rejected`],
    ["the account email", "account user@example.com is suspended"],
    ["a key in a query string", `GET /archives?api_key=${TOKEN}&x=1`],
  ])("redacts %s", (_label, text) => {
    const out = redact(text, KEY);
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain("user@example.com");
  });

  it("redacts a bearer token and an access_token parameter", () => {
    expect(redact("Authorization: Bearer ey.AbC-123_xyz", KEY)).not.toContain("ey.AbC-123_xyz");
    expect(redact("/x?access_token=deadbeefcafe", KEY)).not.toContain("deadbeefcafe");
  });

  it("strips a long hex blob even when no key is supplied", () => {
    expect(redact(`err ${TOKEN}`, null)).not.toContain(TOKEN);
  });

  it("leaves text with nothing secret in it unchanged", () => {
    expect(redact("nothing secret here", KEY)).toBe("nothing secret here");
  });
});

describe("spending is off unless the environment says exactly true", () => {
  it.each([
    [{}, false],
    [{ SKYFI_ORDERS_ENABLED: "false" }, false],
    [{ SKYFI_ORDERS_ENABLED: "1" }, false],
    [{ SKYFI_ORDERS_ENABLED: "TRUE" }, false],
    [{ SKYFI_ORDERS_ENABLED: "yes" }, false],
    [{ SKYFI_ORDERS_ENABLED: "true" }, true],
  ])("%j -> %s", (env, want) => {
    expect(ordersEnabled(env as Record<string, string | undefined>)).toBe(want);
  });
});

describe("every order gate refuses on its own", () => {
  const ON = { SKYFI_ORDERS_ENABLED: "true" };
  const base = {
    env: ON,
    quotedPriceCents: 4500,
    confirmedPriceCents: 4500,
    idempotencyKey: "k1",
    store: new Map<string, number>(),
  };

  it("allows an order only when all gates pass", () => {
    expect(checkOrderGates(base)).toBeNull();
  });

  it.each([
    ["a disabled environment", { env: {} }, "SKYFI_ORDERS_ENABLED"],
    ["no validated quote", { quotedPriceCents: null }, "Validate it first"],
    ["an unconfirmed price", { confirmedPriceCents: null }, "not confirmed"],
    ["a one-cent mismatch", { confirmedPriceCents: 4499 }, "does not match"],
    ["no idempotency key", { idempotencyKey: null }, "idempotency"],
  ])("refuses %s", (_label, patch, fragment) => {
    const r = checkOrderGates({ ...base, ...patch, store: new Map() });
    expect(r).not.toBeNull();
    expect(r!.message).toContain(fragment);
  });
});

describe("the same order is not charged twice", () => {
  it("refuses a repeat inside the window and allows it after", () => {
    const store = new Map<string, number>();
    expect(checkDuplicate("order-a", 1_000_000, store)).toBeNull();
    store.set("order-a", 1_000_000);
    expect(checkDuplicate("order-a", 1_000_050, store)!.message).toContain("twice");
    expect(checkDuplicate("order-a", 1_000_000 + 11 * 60_000, store)).toBeNull();
  });

  it("does not confuse two different orders", () => {
    const store = new Map<string, number>([["order-a", 1_000_000]]);
    expect(checkDuplicate("order-b", 1_000_050, store)).toBeNull();
  });
});

describe("an expensive drawing mistake never reaches a priced endpoint", () => {
  it("accepts a plot-sized area", () => {
    expect(checkAoi(SQUARE, 1.2)).toBeNull();
  });

  it.each([
    ["an area over the ceiling", SQUARE, MAX_AOI_SQ_KM + 1, "ceiling"],
    ["zero area", SQUARE, 0, "no area"],
    ["a single point", [{ lat: -1.3, lng: 36.8 }], 1, "not a usable polygon"],
  ])("refuses %s", (_label, ring, area, fragment) => {
    const r = checkAoi(ring as typeof SQUARE, area);
    expect(r).not.toBeNull();
    expect(r!.message).toContain(fragment);
  });
});

describe("WKT", () => {
  it("writes a closed POLYGON in lng-lat order", () => {
    const wkt = ringToWkt(SQUARE)!;
    expect(wkt).toMatch(/^POLYGON\(\(.*\)\)$/);
    expect(wkt.split(",")).toHaveLength(5);
    expect(wkt).toContain("36.8 -1.3");
  });

  it("produces nothing from a shape that is not a polygon", () => {
    expect(
      ringToWkt([
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
      ]),
    ).toBeNull();
  });
});

describe("retry policy", () => {
  it("retries what is worth retrying and nothing else", () => {
    expect(shouldRetry(429, 0)).toBe(true);
    expect(shouldRetry(503, 0)).toBe(true);
    expect(shouldRetry(null, 0)).toBe(true);
    expect(shouldRetry(400, 0)).toBe(false);
    expect(shouldRetry(401, 0)).toBe(false);
    expect(shouldRetry(503, 2)).toBe(false);
  });

  it("doubles the backoff", () => {
    expect([backoffMs(0), backoffMs(1), backoffMs(2)]).toEqual([600, 1200, 2400]);
  });
});

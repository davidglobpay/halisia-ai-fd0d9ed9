/**
 * SkyFi Platform API — server-side client.
 *
 * SERVER ONLY. The API key is a billing credential: it can place real,
 * non-reversible charges against the account. It is read from the environment,
 * never bundled, never returned to a caller, and never written to a log — see
 * `redact()` and the tests that assert it.
 *
 * SPENDING IS OFF BY DEFAULT AND TAKES THREE KEYS TO TURN ON
 *
 *   1. `SKYFI_ORDERS_ENABLED` must be exactly "true" in the server environment.
 *   2. The caller must pass a `confirmedPriceCents` that matches what
 *      `validateArchiveOrder` just quoted, within `PRICE_TOLERANCE_CENTS`.
 *   3. The caller must pass an `idempotencyKey`, and an identical order inside
 *      `DEDUPE_WINDOW_MS` is refused rather than charged twice.
 *
 * SkyFi's own documentation says to validate, confirm the exact price with the
 * user, and only then charge. `validateArchiveOrder` and `searchArchive` cost
 * nothing, so everything except the final step can be exercised for free.
 *
 * WHAT STILL NEEDS CONFIRMING AGAINST THE LIVE DOCS
 *
 * `AUTH` below is the one thing in this file taken on probability rather than
 * from the specification: the Platform API reference renders through
 * JavaScript and could not be read when this was written. The key's shape
 * (`email:token`) fits either an HTTP Basic pair or a custom header, so both
 * are implemented and one constant selects. Confirm it at
 * https://app.skyfi.com/platform-api/redoc and set `AUTH` accordingly — it is
 * a one-line change and every other path in this file is unaffected.
 */

/** Switch this once the reference is read. Both modes are implemented below. */
const AUTH: "header" | "basic" = "header";
const AUTH_HEADER = "X-Skyfi-Api-Key";

const DEFAULT_BASE = "https://app.skyfi.com/platform-api";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 600;
/** Orders quoted and confirmed must agree to the cent beyond this slack. */
const PRICE_TOLERANCE_CENTS = 0;
const DEDUPE_WINDOW_MS = 10 * 60_000;
/** A sanity ceiling. An AOI larger than this is almost always a drawing error. */
export const MAX_AOI_SQ_KM = 500;

export type SkyFiError = {
  kind: "config" | "auth" | "rate_limit" | "not_found" | "provider" | "network" | "refused";
  message: string;
  status?: number;
};

export class SkyFiFailure extends Error {
  readonly detail: SkyFiError;
  constructor(detail: SkyFiError) {
    super(detail.message);
    this.name = "SkyFiFailure";
    this.detail = detail;
  }
}

/**
 * Remove anything secret from a string before it reaches a log or an error.
 *
 * The key is `email:token`. Both halves are stripped: the token because it is
 * the credential, the email because it identifies the account holder and ends
 * up in support tickets. Also strips any bearer token and any `key=`/`token=`
 * query parameter, because an upstream error body can echo a request URL.
 */
export function redact(text: string, key?: string | null): string {
  let out = text;
  if (key) {
    out = out.split(key).join("[redacted]");
    const [email, token] = key.split(":");
    if (token && token.length >= 8) out = out.split(token).join("[redacted]");
    if (email && email.includes("@")) out = out.split(email).join("[redacted]");
  }
  out = out.replace(/\b[A-Fa-f0-9]{32,}\b/g, "[redacted]");
  out = out.replace(/(bearer\s+)[\w.\-]+/gi, "$1[redacted]");
  out = out.replace(/([?&](?:api[_-]?key|key|token|access_token)=)[^&\s]+/gi, "$1[redacted]");
  return out;
}

function readKey(): string {
  const key = process.env["SKYFI_API_KEY"];
  if (!key || !key.trim())
    throw new SkyFiFailure({
      kind: "config",
      message: "SKYFI_API_KEY is not set on the server. Satellite imagery is unavailable.",
    });
  return key.trim();
}

function baseUrl(): string {
  return (process.env["SKYFI_API_URL"]?.trim() || DEFAULT_BASE).replace(/\/+$/, "");
}

/** True only when the environment explicitly enables spending. */
export function ordersEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env["SKYFI_ORDERS_ENABLED"] === "true";
}

function authHeaders(key: string): Record<string, string> {
  if (AUTH === "basic") {
    const [user, pass] = key.split(":");
    return { Authorization: `Basic ${Buffer.from(`${user}:${pass ?? ""}`).toString("base64")}` };
  }
  return { [AUTH_HEADER]: key };
}

/* ------------------------------------------------------------------ AOI --- */

export type Ring = ReadonlyArray<{ lat: number; lng: number }>;

/** Well-known text for a closed ring, lng-lat order, as OGC specifies. */
export function ringToWkt(ring: Ring): string | null {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  if (!ring.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))) return null;
  const pts = [...ring, ring[0]].map((p) => `${p.lng} ${p.lat}`).join(", ");
  return `POLYGON((${pts}))`;
}

/**
 * Refuse an AOI that is almost certainly a mistake before it reaches a priced
 * endpoint. Imagery is sold by area, so a stray click that encircles a county
 * is an expensive typo.
 */
export function checkAoi(ring: Ring, areaSqKm: number): SkyFiError | null {
  if (!ringToWkt(ring))
    return { kind: "refused", message: "That boundary is not a usable polygon." };
  if (!Number.isFinite(areaSqKm) || areaSqKm <= 0)
    return { kind: "refused", message: "That boundary encloses no area." };
  if (areaSqKm > MAX_AOI_SQ_KM)
    return {
      kind: "refused",
      message: `That area is ${Math.round(areaSqKm)} km2, over the ${MAX_AOI_SQ_KM} km2 ceiling. Imagery is priced by area — draw a tighter boundary.`,
    };
  return null;
}

/* -------------------------------------------------------------- request --- */

function mapStatus(status: number): SkyFiError["kind"] {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit";
  return "provider";
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Retry only what is worth retrying: a timeout, a 429, or a 5xx. */
export function shouldRetry(status: number | null, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false;
  if (status == null) return true;
  return status === 429 || status >= 500;
}

export function backoffMs(attempt: number): number {
  return RETRY_BASE_MS * 2 ** attempt;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = readKey();
  const url = `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let status: number | null = null;
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...authHeaders(key),
          ...(init.headers as Record<string, string> | undefined),
        },
      });
      status = res.status;
      if (res.ok) return (await res.json()) as T;

      const body = redact((await res.text().catch(() => "")).slice(0, 400), key);
      if (shouldRetry(status, attempt)) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new SkyFiFailure({
        kind: mapStatus(status),
        status,
        message:
          status === 401 || status === 403
            ? "SkyFi rejected the configured credentials."
            : `SkyFi returned ${status}. ${body}`.trim(),
      });
    } catch (e) {
      if (e instanceof SkyFiFailure) throw e;
      if (shouldRetry(status, attempt)) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new SkyFiFailure({
        kind: "network",
        message: redact(`Could not reach SkyFi: ${(e as Error).message}`, key),
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ------------------------------------------------------------- free API --- */

export type ArchiveScene = {
  id: string;
  captureDate: string | null;
  resolutionM: number | null;
  provider: string | null;
  cloudCoveragePct: number | null;
  footprintWkt: string | null;
  priceCents: number | null;
  licence: string | null;
};

/** Search existing captures. Free. */
export async function searchArchive(input: {
  ring: Ring;
  areaSqKm: number;
  fromISO?: string;
  toISO?: string;
  maxCloudPct?: number;
  limit?: number;
}): Promise<{ scenes: ArchiveScene[] }> {
  const refusal = checkAoi(input.ring, input.areaSqKm);
  if (refusal) throw new SkyFiFailure(refusal);
  const body = {
    aoi: ringToWkt(input.ring),
    fromDate: input.fromISO ?? null,
    toDate: input.toISO ?? null,
    maxCloudCoveragePercent: input.maxCloudPct ?? 30,
    pageSize: Math.min(input.limit ?? 20, 50),
  };
  return request<{ scenes: ArchiveScene[] }>("/archives", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Quote an order without placing it. Free, and the only route to a price. */
export async function validateArchiveOrder(input: {
  archiveId: string;
  ring: Ring;
  areaSqKm: number;
  deliveryDriver?: string;
}): Promise<{ ok: boolean; priceCents: number | null; reason: string | null }> {
  const refusal = checkAoi(input.ring, input.areaSqKm);
  if (refusal) throw new SkyFiFailure(refusal);
  return request("/order-archive/validate", {
    method: "POST",
    body: JSON.stringify({
      archiveId: input.archiveId,
      aoi: ringToWkt(input.ring),
      deliveryDriver: input.deliveryDriver ?? "S3",
    }),
  });
}

export async function listOrders(): Promise<{ orders: Array<{ id: string; status: string }> }> {
  return request("/orders", { method: "GET" });
}

export async function getOrder(id: string): Promise<{ id: string; status: string }> {
  if (!id) throw new SkyFiFailure({ kind: "refused", message: "No order id was given." });
  return request(`/orders/${encodeURIComponent(id)}`, { method: "GET" });
}

/* ------------------------------------------------------------ spending --- */

const recentOrders = new Map<string, number>();

/** Refuse a repeat of the same order inside the dedupe window. */
export function checkDuplicate(
  idempotencyKey: string,
  now = Date.now(),
  store: Map<string, number> = recentOrders,
): SkyFiError | null {
  for (const [k, t] of store) if (now - t > DEDUPE_WINDOW_MS) store.delete(k);
  const seen = store.get(idempotencyKey);
  if (seen != null && now - seen <= DEDUPE_WINDOW_MS)
    return {
      kind: "refused",
      message:
        "An identical imagery order was placed moments ago. Refusing to charge twice — check the orders list.",
    };
  return null;
}

/**
 * The three gates, as pure logic so they can be tested without a network.
 * Returns the refusal, or null when every gate is satisfied.
 */
export function checkOrderGates(input: {
  env?: Record<string, string | undefined>;
  quotedPriceCents: number | null;
  confirmedPriceCents: number | null;
  idempotencyKey: string | null;
  now?: number;
  store?: Map<string, number>;
}): SkyFiError | null {
  if (!ordersEnabled(input.env ?? process.env))
    return {
      kind: "refused",
      message:
        "Paid imagery orders are disabled on this deployment. An administrator must set SKYFI_ORDERS_ENABLED.",
    };
  if (input.quotedPriceCents == null || !Number.isFinite(input.quotedPriceCents))
    return { kind: "refused", message: "No validated price for this order. Validate it first." };
  if (input.confirmedPriceCents == null)
    return { kind: "refused", message: "The price was not confirmed by a person." };
  if (Math.abs(input.confirmedPriceCents - input.quotedPriceCents) > PRICE_TOLERANCE_CENTS)
    return {
      kind: "refused",
      message: `The confirmed price does not match the quote (${input.confirmedPriceCents} vs ${input.quotedPriceCents}). Re-validate and confirm again.`,
    };
  if (!input.idempotencyKey)
    return { kind: "refused", message: "No idempotency key was supplied for a billable order." };
  return checkDuplicate(input.idempotencyKey, input.now ?? Date.now(), input.store ?? recentOrders);
}

/**
 * Place a billable archive order.
 *
 * Every gate above must already pass. This function spends money, and nothing
 * in this file calls it: only an explicit administrator action should.
 */
export async function placeArchiveOrder(input: {
  archiveId: string;
  ring: Ring;
  areaSqKm: number;
  quotedPriceCents: number;
  confirmedPriceCents: number;
  idempotencyKey: string;
  deliveryDriver?: string;
}): Promise<{ orderId: string; status: string }> {
  const refusal =
    checkAoi(input.ring, input.areaSqKm) ??
    checkOrderGates({
      quotedPriceCents: input.quotedPriceCents,
      confirmedPriceCents: input.confirmedPriceCents,
      idempotencyKey: input.idempotencyKey,
    });
  if (refusal) throw new SkyFiFailure(refusal);

  recentOrders.set(input.idempotencyKey, Date.now());
  return request("/order-archive", {
    method: "POST",
    body: JSON.stringify({
      archiveId: input.archiveId,
      aoi: ringToWkt(input.ring),
      deliveryDriver: input.deliveryDriver ?? "S3",
    }),
  });
}

/**
 * Small input guards for public or cost-bearing server functions.
 *
 * Pure and dependency-free so they can be unit-tested without the server
 * runtime. They reject malformed input with a short message; they never
 * coerce a bad value into a "close enough" one.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TTS_ENGINES = ["elevenlabs", "azure", "google"] as const;
export type TtsEngineName = (typeof TTS_ENGINES)[number];

export type TtsInput = { articleId: string; engine?: TtsEngineName };

/** Article audio request: a real article id and, optionally, a known engine. */
export function parseTtsInput(input: unknown): TtsInput {
  const v = input as { articleId?: unknown; engine?: unknown } | null | undefined;
  if (!v || typeof v.articleId !== "string" || !UUID_RE.test(v.articleId)) {
    throw new Error("articleId must be an article UUID");
  }
  const out: TtsInput = { articleId: v.articleId.toLowerCase() };
  if (v.engine !== undefined && v.engine !== null) {
    if (typeof v.engine !== "string" || !(TTS_ENGINES as readonly string[]).includes(v.engine)) {
      throw new Error(`engine must be one of: ${TTS_ENGINES.join(", ")}`);
    }
    out.engine = v.engine as TtsEngineName;
  }
  return out;
}

export type CoordInput = { lat: number; lng: number; refresh: boolean };

/** A WGS84 point. Rejects NaN, Infinity and out-of-range values. */
export function parseCoordInput(input: unknown): CoordInput {
  const v = input as { lat?: unknown; lng?: unknown; refresh?: unknown } | null | undefined;
  const lat = v?.lat;
  const lng = v?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") throw new Error("lat/lng required");
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("lat must be within -90..90");
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("lng must be within -180..180");
  }
  return { lat, lng, refresh: v?.refresh === true };
}

/**
 * Fixed-window limiter keyed by caller. Process-local and best-effort: each
 * server instance keeps its own counts, so it caps bursts from one caller
 * rather than enforcing an exact global quota.
 */
export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }) {
  const hits = new Map<string, { start: number; count: number }>();
  const maxKeys = opts.maxKeys ?? 5000;
  return function allow(key: string, now: number = Date.now()): boolean {
    const cur = hits.get(key);
    if (!cur || now - cur.start >= opts.windowMs) {
      if (!cur && hits.size >= maxKeys) hits.clear();
      hits.set(key, { start: now, count: 1 });
      return true;
    }
    if (cur.count >= opts.limit) return false;
    cur.count += 1;
    return true;
  };
}

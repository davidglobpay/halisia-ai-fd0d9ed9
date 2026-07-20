import { fetchStaticMap } from "@/lib/static-map.functions";
import { fetchStaticMapOSM } from "@/lib/static-map-osm";

type Layer = "roadmap-light" | "terrain" | "satellite" | "hybrid";
type FetchArgs = { lat: number; lng: number; layer: Layer; zoom: number };
type Result =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string; status?: number; detail?: string };

const MEM = new Map<string, Result>();
const INFLIGHT = new Map<string, Promise<Result>>();
const SS_PREFIX = "halisia:staticmap:";
const TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

export type MapDiagnostics = {
  attempts: number;
  hits: number;
  misses: number;
  failures: number;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastError: { error: string; status?: number; detail?: string } | null;
  jsStatus: "loading" | "ready" | "error" | "unknown";
  jsError: string | null;
  jsErrorReason:
    | "referrer_not_allowed"
    | "api_not_activated"
    | "invalid_key"
    | "billing"
    | "network"
    | "timeout"
    | "unknown"
    | null;
  host: string | null;
  referrer: string | null;
};

const state: MapDiagnostics = {
  attempts: 0,
  hits: 0,
  misses: 0,
  failures: 0,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  jsStatus: "unknown",
  jsError: null,
  jsErrorReason: null,
  host: typeof window !== "undefined" ? window.location.host : null,
  referrer:
    typeof document !== "undefined" && document.referrer
      ? document.referrer
      : typeof window !== "undefined"
        ? window.location.origin + "/"
        : null,
};

type Listener = (s: MapDiagnostics) => void;
const listeners = new Set<Listener>();
function emit() {
  const snap = { ...state };
  listeners.forEach((l) => l(snap));
}

export function subscribeMapDiagnostics(l: Listener) {
  listeners.add(l);
  l({ ...state });
  return () => listeners.delete(l);
}

export function setMapsJsStatus(status: MapDiagnostics["jsStatus"], error: string | null = null) {
  state.jsStatus = status;
  state.jsError = error;
  if (status === "error") {
    state.jsErrorReason = inferJsReason(error);
  } else if (status === "ready") {
    state.jsErrorReason = null;
  }
  if (typeof window !== "undefined") state.host = window.location.host;
  emit();
}

function inferJsReason(error: string | null): MapDiagnostics["jsErrorReason"] {
  if (!error) return null;
  const s = error.toLowerCase();
  if (s.includes("referer") || s.includes("referrer") || s.includes("refererotallowed"))
    return "referrer_not_allowed";
  if (s.includes("apinotactivated") || s.includes("not activated")) return "api_not_activated";
  if (s.includes("invalidkey") || s.includes("invalid key") || s.includes("invalid_key"))
    return "invalid_key";
  if (s.includes("billing")) return "billing";
  if (s.includes("timed out") || s.includes("timeout")) return "timeout";
  if (s.includes("failed to load") || s.includes("network")) return "network";
  return "unknown";
}

export function getMapDiagnostics(): MapDiagnostics {
  return { ...state };
}

function key(a: FetchArgs) {
  return `${a.layer}|${a.zoom}|${a.lat.toFixed(4)}|${a.lng.toFixed(4)}`;
}

function readSession(k: string): Result | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + k);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; result: Result };
    if (Date.now() - parsed.at > TTL_MS) {
      sessionStorage.removeItem(SS_PREFIX + k);
      return null;
    }
    return parsed.result;
  } catch {
    return null;
  }
}

function writeSession(k: string, result: Result) {
  if (typeof sessionStorage === "undefined") return;
  try {
    // Only cache successes long-term; cache failures briefly in memory only.
    if (result.ok) {
      sessionStorage.setItem(SS_PREFIX + k, JSON.stringify({ at: Date.now(), result }));
    }
  } catch {
    /* quota — ignore */
  }
}

export async function fetchStaticMapCached(args: FetchArgs): Promise<Result> {
  const k = key(args);
  const mem = MEM.get(k);
  if (mem) {
    state.hits++;
    emit();
    return mem;
  }
  const ss = readSession(k);
  if (ss) {
    MEM.set(k, ss);
    state.hits++;
    emit();
    return ss;
  }
  const inflight = INFLIGHT.get(k);
  if (inflight) return inflight;

  state.misses++;
  state.attempts++;
  emit();

  const p = (async (): Promise<Result> => {
    try {
      const raw = (await fetchStaticMap({ data: args })) as Result;
      if (raw.ok) {
        MEM.set(k, raw);
        writeSession(k, raw);
        state.lastSuccessAt = Date.now();
        emit();
        return raw;
      }
      // Google failed — try browser-side OSM/Esri tile stitcher so PDFs
      // and thumbnails always have map imagery.
      const fb = await fetchStaticMapOSM(args);
      if (fb.ok) {
        const fbResult: Result = { ok: true, dataUrl: fb.dataUrl };
        MEM.set(k, fbResult);
        writeSession(k, fbResult);
        state.lastSuccessAt = Date.now();
        // Still surface the underlying Google error for diagnostics.
        state.lastError = { error: raw.error, status: raw.status, detail: raw.detail };
        emit();
        return fbResult;
      }
      state.failures++;
      state.lastErrorAt = Date.now();
      state.lastError = { error: raw.error, status: raw.status, detail: raw.detail };
      emit();
      return raw;
    } catch (e) {
      // Network / server-function failure — still try the OSM fallback.
      const fb = await fetchStaticMapOSM(args).catch(() => null);
      if (fb && fb.ok) {
        const fbResult: Result = { ok: true, dataUrl: fb.dataUrl };
        MEM.set(k, fbResult);
        writeSession(k, fbResult);
        state.lastSuccessAt = Date.now();
        emit();
        return fbResult;
      }
      const err = { error: "client_exception", detail: String(e).slice(0, 200) };
      state.failures++;
      state.lastErrorAt = Date.now();
      state.lastError = err;
      emit();
      return { ok: false, ...err };
    } finally {
      INFLIGHT.delete(k);
    }
  })();

  INFLIGHT.set(k, p);
  return p;
}

export function classifyMapError(e: { error: string; status?: number } | null): {
  title: string;
  hint: string;
  actionable: boolean;
} {
  if (!e) return { title: "No errors", hint: "All map fetches succeeded.", actionable: false };
  if (e.status === 403)
    return {
      title: "Google Static Maps returned 403 (Forbidden)",
      hint: "Enable Maps Static API on your Google Cloud key and add your preview hostnames (*.lovable.app, *.lovableproject.com) to the key's website restrictions. Changes take ~5 minutes to propagate.",
      actionable: true,
    };
  if (e.status === 400)
    return {
      title: "Static Maps rejected the request (400)",
      hint: "The URL or style parameters are invalid for this key.",
      actionable: false,
    };
  if (e.status === 429)
    return {
      title: "Rate limit exceeded (429)",
      hint: "Retries applied automatically. Check quota in Google Cloud Console.",
      actionable: true,
    };
  if (e.error === "network_error")
    return {
      title: "Network error",
      hint: "The request couldn't reach the Maps gateway.",
      actionable: false,
    };
  return { title: `Error: ${e.error}`, hint: "See console logs for details.", actionable: false };
}

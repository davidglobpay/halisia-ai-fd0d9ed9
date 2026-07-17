/**
 * Wave 2 terrain-loading telemetry.
 * Records layer-specific timings, failures and rendering errors so we can
 * diagnose reliability regressions in the isometric terrain preview and the
 * PDF dossier's topographic projection.
 *
 * Events are kept in-memory (last 200) and also mirrored on
 * `window.__halisiaTerrainTelemetry` so tests, the console and future
 * diagnostics UIs can inspect them without a network round-trip.
 */

export type TerrainTelemetryEvent = {
  ts: number;
  layer: "contour-grid" | "slope-grid" | "render" | "refresh" | "pdf-terrain";
  kind: "start" | "success" | "error";
  ms?: number;
  status?: number;
  error?: string;
  meta?: Record<string, unknown>;
};

const MAX = 200;
const buffer: TerrainTelemetryEvent[] = [];
type Listener = (e: TerrainTelemetryEvent) => void;
const listeners = new Set<Listener>();

function push(e: TerrainTelemetryEvent) {
  buffer.push(e);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
  if (typeof window !== "undefined") {
    const w = window as unknown as {
      __halisiaTerrainTelemetry?: TerrainTelemetryEvent[];
    };
    w.__halisiaTerrainTelemetry = buffer;
  }
  listeners.forEach((l) => {
    try {
      l(e);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function recordTerrainEvent(e: Omit<TerrainTelemetryEvent, "ts">) {
  push({ ...e, ts: Date.now() });
}

export function startTerrainTimer(
  layer: TerrainTelemetryEvent["layer"],
  meta?: Record<string, unknown>,
) {
  const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  recordTerrainEvent({ layer, kind: "start", meta });
  return {
    success: (extra?: Record<string, unknown>) =>
      recordTerrainEvent({
        layer,
        kind: "success",
        ms: Math.round(
          (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) -
            t0,
        ),
        meta: { ...(meta ?? {}), ...(extra ?? {}) },
      }),
    error: (error: unknown, status?: number) =>
      recordTerrainEvent({
        layer,
        kind: "error",
        ms: Math.round(
          (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) -
            t0,
        ),
        status,
        error: error instanceof Error ? error.message : String(error),
        meta,
      }),
  };
}

export function getTerrainTelemetry(): TerrainTelemetryEvent[] {
  return buffer.slice();
}

export function subscribeTerrainTelemetry(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

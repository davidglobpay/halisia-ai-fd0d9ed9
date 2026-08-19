/**
 * Tiny client-side XR telemetry store.
 * Records how long each immersive session takes to start and how long it ran,
 * so the in-app performance overlay can surface XR mode timings.
 */

export type XrTiming = {
  mode: "ar" | "vr";
  /** ms from button press to session presenting. */
  startMs: number | null;
  /** ms the session stayed live (null while running). */
  durationMs: number | null;
  at: number;
};

type Listener = (timings: XrTiming[]) => void;

const timings: XrTiming[] = [];
const listeners = new Set<Listener>();
let pending: { mode: "ar" | "vr"; t0: number } | null = null;
let liveIndex = -1;

function emit() {
  const snapshot = [...timings];
  listeners.forEach((l) => l(snapshot));
}

/** Call right before requesting an XR session. */
export function markXrRequest(mode: "ar" | "vr") {
  pending = { mode, t0: performance.now() };
}

/** Call when the session actually becomes active. */
export function markXrStart(mode: "ar" | "vr") {
  const now = performance.now();
  const startMs = pending && pending.mode === mode ? Math.round(now - pending.t0) : null;
  pending = null;
  timings.push({ mode, startMs, durationMs: null, at: now });
  if (timings.length > 10) timings.shift();
  liveIndex = timings.length - 1;
  emit();
}

/** Call when the session ends (or fails to start). */
export function markXrEnd() {
  pending = null;
  const live = liveIndex >= 0 ? timings[liveIndex] : undefined;
  if (live && live.durationMs === null) {
    live.durationMs = Math.round(performance.now() - live.at);
  }
  liveIndex = -1;
  emit();
}

export function getXrTimings(): XrTiming[] {
  return [...timings];
}

export function subscribeXrTimings(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

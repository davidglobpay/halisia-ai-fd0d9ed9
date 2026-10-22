/**
 * The state machine behind drawing a site boundary.
 *
 * Deliberately free of Leaflet, React and the DOM: a boundary is a list of
 * points and a few rules about it, and all of that is testable without a
 * browser. The map component binds events to these functions and renders what
 * comes back; it holds no editing logic of its own.
 *
 * Every transition returns a new state. Nothing mutates, so undo is a stack of
 * previous states and React re-renders on identity.
 */

import {
  measureSite, pathLengthM, normalizeRing, type LngLat, type SiteMeasurement,
} from "./site-geometry";

/** How many steps back a user can go. Enough for a mis-click, not a session. */
const HISTORY_LIMIT = 50;

export type BoundaryState = {
  /** In draw order. The ring is implicitly closed; no repeated last vertex. */
  vertices: readonly LngLat[];
  /** Set once the user says the shape is finished. Editing stays possible. */
  closed: boolean;
  selected: number | null;
  past: readonly (readonly LngLat[])[];
};

export const emptyBoundary: BoundaryState = {
  vertices: [], closed: false, selected: null, past: [],
};

function push(state: BoundaryState, vertices: readonly LngLat[], extra: Partial<BoundaryState> = {}): BoundaryState {
  const past = [...state.past, state.vertices].slice(-HISTORY_LIMIT);
  return { vertices, closed: state.closed, selected: state.selected, past, ...extra };
}

/** Add a vertex at the end. Ignored once the ring is closed. */
export function addVertex(state: BoundaryState, point: LngLat): BoundaryState {
  if (state.closed) return state;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return state;
  return push(state, [...state.vertices, point], { selected: state.vertices.length });
}

/** Move one vertex. Used while a marker is being dragged. */
export function moveVertex(state: BoundaryState, index: number, point: LngLat): BoundaryState {
  if (index < 0 || index >= state.vertices.length) return state;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return state;
  const vertices = state.vertices.map((v, i) => (i === index ? point : v));
  return push(state, vertices, { selected: index });
}

/**
 * Remove a vertex. Allowed down to zero: a user deleting their way out of a
 * shape should not hit an invisible floor at three. The ring simply stops
 * being measurable, which `measurement` already reports.
 */
export function removeVertex(state: BoundaryState, index: number): BoundaryState {
  if (index < 0 || index >= state.vertices.length) return state;
  const vertices = state.vertices.filter((_, i) => i !== index);
  return push(state, vertices, { selected: null, closed: vertices.length >= 3 && state.closed });
}

/** Finish the shape. Refused under three vertices — that is not an area. */
export function closeRing(state: BoundaryState): BoundaryState {
  if (state.closed || state.vertices.length < 3) return state;
  return { ...state, closed: true, selected: null };
}

/** Reopen a closed ring so another vertex can be appended. */
export function reopenRing(state: BoundaryState): BoundaryState {
  return state.closed ? { ...state, closed: false } : state;
}

export function undo(state: BoundaryState): BoundaryState {
  if (!state.past.length) return state;
  const vertices = state.past[state.past.length - 1];
  return {
    vertices,
    past: state.past.slice(0, -1),
    selected: null,
    closed: state.closed && vertices.length >= 3,
  };
}

export function clearBoundary(): BoundaryState {
  return emptyBoundary;
}

/** Load a ring from storage or an import. Replaces everything, clears history. */
export function loadRing(ring: readonly LngLat[]): BoundaryState {
  const normalized = normalizeRing(ring);
  if (!normalized) return emptyBoundary;
  return { vertices: normalized, closed: true, selected: null, past: [] };
}

export type BoundaryReadout =
  | { status: "empty"; hint: string }
  | { status: "drawing"; vertices: number; runningLengthM: number; hint: string }
  | { status: "measurable"; vertices: number; closed: boolean; measurement: SiteMeasurement };

/**
 * What the panel beside the map should say right now.
 *
 * An unfinished shape reports the length drawn so far and never an area: two
 * points enclose nothing, and showing "0 m2" would read as a measurement of a
 * sliver rather than as the absence of one.
 */
export function readout(state: BoundaryState): BoundaryReadout {
  const n = state.vertices.length;
  if (n === 0) return { status: "empty", hint: "Tap the map to place the first corner of the plot." };
  if (n < 3)
    return {
      status: "drawing",
      vertices: n,
      runningLengthM: n >= 2 ? (pathLengthM(state.vertices) ?? 0) : 0,
      hint: n === 1 ? "Place at least two more corners." : "Place one more corner to enclose an area.",
    };
  const measurement = measureSite(state.vertices);
  if (!measurement)
    return { status: "drawing", vertices: n, runningLengthM: pathLengthM(state.vertices) ?? 0,
             hint: "Those corners do not form a usable shape. Move or remove one." };
  return { status: "measurable", vertices: n, closed: state.closed, measurement };
}

/** GeoJSON for export or for saving against a listing. Closes the ring. */
export function toGeoJsonPolygon(state: BoundaryState): {
  type: "Polygon"; coordinates: number[][][];
} | null {
  const r = normalizeRing(state.vertices);
  if (!r) return null;
  const coords = [...r, r[0]].map((p) => [p.lng, p.lat]);
  return { type: "Polygon", coordinates: [coords] };
}

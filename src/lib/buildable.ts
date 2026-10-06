/**
 * What can actually be built on a drawn parcel.
 *
 * Given a boundary and the setbacks that apply, this computes the envelope a
 * building has to sit inside, and tests whether a given footprint fits in it.
 *
 * Two honesty constraints shape every function here.
 *
 * Setbacks are NOT law in this file. They vary by county, by zone and by road
 * class, and a figure invented here and shown with authority would be worse
 * than no figure at all. Every function takes the setbacks as arguments; the
 * caller is responsible for getting them from the person or from the county,
 * and for labelling them as what they are.
 *
 * And a fit is a geometric statement, never a planning approval. "This
 * footprint fits inside the envelope" says nothing about plot ratio, ground
 * coverage, height, parking, services or whether the county would approve it.
 */

import { areaM2, centroid, edges, type LocalXY } from "@/lib/parcel-geometry";

/** Signed area; positive means counter-clockwise in a y-up frame. */
function signedArea(ring: LocalXY[]): number {
  let t = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    t += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  }
  return t / 2;
}

/**
 * Is every turn in the same direction?
 *
 * The inset below clips the polygon against one half-plane per edge, which is
 * exact for a convex ring and wrong for a concave one — a reflex corner would
 * be cut away as though it were outside. So concavity is detected and reported
 * rather than silently mis-measured.
 */
export function isConvex(ring: LocalXY[]): boolean {
  if (ring.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const c = ring[(i + 2) % ring.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) continue; // collinear, no information
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

/** Clip a polygon to the inner side of a line, Sutherland–Hodgman. */
function clipToHalfPlane(
  ring: LocalXY[],
  point: LocalXY,
  normal: { x: number; y: number },
): LocalXY[] {
  // Inside means the point is on the side the normal points to.
  const inside = (p: LocalXY) => (p.x - point.x) * normal.x + (p.y - point.y) * normal.y >= 0;
  const intersect = (a: LocalXY, b: LocalXY): LocalXY => {
    const da = (a.x - point.x) * normal.x + (a.y - point.y) * normal.y;
    const db = (b.x - point.x) * normal.x + (b.y - point.y) * normal.y;
    const t = da / (da - db);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };

  const out: LocalXY[] = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const prev = ring[(i + ring.length - 1) % ring.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }
  return out;
}

export type SetbackSpec = {
  /** Applied to every boundary, in metres. */
  allM: number;
  /**
   * A larger setback for the edge facing the road, if one is named.
   * `frontEdgeIndex` is the index into the ring's own edge order.
   */
  frontM?: number;
  frontEdgeIndex?: number;
};

export type Envelope = {
  ring: LocalXY[];
  areaM2: number;
  /** False when the setbacks consume the whole plot. */
  buildable: boolean;
  /** True when the inset is exact; false means the plot has a reflex corner. */
  exact: boolean;
};

/**
 * The area left after setbacks.
 *
 * Each boundary line is pushed inward by its setback and the plot is clipped
 * to the inner side of it. For a convex plot that is the exact envelope. For a
 * concave one it is an under-estimate, and `exact` is false so the caller can
 * say so rather than quote a number that looks precise.
 */
export function buildableEnvelope(ring: LocalXY[], setbacks: SetbackSpec): Envelope | null {
  if (ring.length < 3) return null;
  if (!(setbacks.allM >= 0)) return null;

  const ccw = signedArea(ring) > 0;
  let work = ring.slice();

  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;

    // Inward normal depends on winding: for a counter-clockwise ring the
    // interior is to the left of each edge, for clockwise it is to the right.
    const nx = ccw ? -ey / len : ey / len;
    const ny = ccw ? ex / len : -ex / len;

    const d =
      setbacks.frontEdgeIndex === i && setbacks.frontM != null && setbacks.frontM >= 0
        ? setbacks.frontM
        : setbacks.allM;

    const onLine = { x: a.x + nx * d, y: a.y + ny * d };
    work = clipToHalfPlane(work, onLine, { x: nx, y: ny });
    if (work.length < 3) {
      return { ring: [], areaM2: 0, buildable: false, exact: isConvex(ring) };
    }
  }

  const area = areaM2(work);
  return {
    ring: work,
    areaM2: area,
    buildable: area > 0.5,
    exact: isConvex(ring),
  };
}

/** Is a point inside a polygon? Ray casting; boundary counts as inside. */
export function pointInRing(ring: LocalXY[], p: LocalXY): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export type FootprintFit = {
  fits: boolean;
  /** The rectangle tried, as a ring, so the caller can draw it. */
  ring: LocalXY[];
  /** Degrees the rectangle was rotated to, measured as a compass bearing. */
  bearingDeg: number;
  /** How the answer was reached, so a caller never overstates it. */
  method: string;
};

/**
 * Does a rectangular footprint fit inside the envelope?
 *
 * The rectangle is placed at the envelope's centroid and aligned to the
 * longest boundary, which is what a builder does by eye, then the same again
 * turned ninety degrees. Both orientations are tried and the first that fits
 * is returned.
 *
 * This is deliberately a weak claim, and the returned `method` says so. A
 * "no" means the footprint does not fit CENTRED AND SQUARE to the plot — not
 * that no placement anywhere could work. Reporting it the other way round
 * would be a planning opinion dressed up as geometry.
 */
export function fitFootprint(
  envelope: LocalXY[],
  widthM: number,
  depthM: number,
): FootprintFit | null {
  if (envelope.length < 3 || !(widthM > 0) || !(depthM > 0)) return null;

  const c = centroid(envelope);
  const es = edges(envelope);
  const longest = es.reduce((best, e, i) => (e.lengthM > es[best].lengthM ? i : best), 0);
  const baseBearing = es[longest].bearingDeg;

  const tryAt = (bearing: number): LocalXY[] => {
    // Bearing is clockwise from north; convert to a direction vector.
    const t = (bearing * Math.PI) / 180;
    const ux = Math.sin(t);
    const uy = Math.cos(t);
    const vx = -uy;
    const vy = ux;
    const hw = widthM / 2;
    const hd = depthM / 2;
    return [
      { x: c.x - ux * hw - vx * hd, y: c.y - uy * hw - vy * hd },
      { x: c.x + ux * hw - vx * hd, y: c.y + uy * hw - vy * hd },
      { x: c.x + ux * hw + vx * hd, y: c.y + uy * hw + vy * hd },
      { x: c.x - ux * hw + vx * hd, y: c.y - uy * hw + vy * hd },
    ];
  };

  for (const bearing of [baseBearing, (baseBearing + 90) % 360]) {
    const rect = tryAt(bearing);
    if (rect.every((p) => pointInRing(envelope, p))) {
      return {
        fits: true,
        ring: rect,
        bearingDeg: bearing,
        method: "Placed at the centre of the buildable area, square to the longest boundary.",
      };
    }
  }

  return {
    fits: false,
    ring: tryAt(baseBearing),
    bearingDeg: baseBearing,
    method:
      "Does not fit centred and square to the plot. A different position or angle might still work; " +
      "an architect would know.",
  };
}

export type OrientedExtent = {
  /**
   * Measured along the longest boundary.
   *
   * Named for what it measures rather than "width", which silently assumes
   * where the road is — an assumption that produced a backwards reading the
   * first time this was used.
   */
  alongM: number;
  /** Measured at right angles to that boundary. */
  acrossM: number;
  /** The bearing the long axis runs on, in degrees from north. */
  bearingDeg: number;
};

/**
 * How much room there actually is, measured along the plot's own grain.
 *
 * An area on its own does not tell a person whether their house fits: 213 m2
 * is a comfortable bungalow on one plot and an unusable 2 m strip on another.
 * This measures the envelope's extent along its longest boundary and across
 * it, which is the frame a builder already thinks in.
 *
 * It is a bounding box, so for anything but a rectangle it is the outside
 * measurement rather than a guarantee that a rectangle of that size fits
 * inside. Use fitFootprint for that question.
 */
export function orientedExtent(envelope: LocalXY[]): OrientedExtent | null {
  if (envelope.length < 3) return null;
  const es = edges(envelope);
  const longest = es.reduce((best, e, i) => (e.lengthM > es[best].lengthM ? i : best), 0);
  const t = (es[longest].bearingDeg * Math.PI) / 180;
  const ux = Math.sin(t);
  const uy = Math.cos(t);

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const p of envelope) {
    const u = p.x * ux + p.y * uy;
    const v = -p.x * uy + p.y * ux;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  return {
    alongM: maxU - minU,
    acrossM: maxV - minV,
    bearingDeg: es[longest].bearingDeg,
  };
}

/**
 * Ground coverage as a percentage of the plot.
 *
 * Counties cap this, and the cap is theirs to state — this only does the
 * arithmetic so a person can check a figure they were given.
 */
export function groundCoveragePct(plotAreaM2: number, footprintM2: number): number | null {
  if (!(plotAreaM2 > 0) || !(footprintM2 >= 0)) return null;
  return (footprintM2 / plotAreaM2) * 100;
}

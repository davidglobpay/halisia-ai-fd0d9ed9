/**
 * Measuring in the 3D plot view: the length, width and area of a building
 * footprint (its smallest enclosing rectangle, the way a surveyor would quote
 * "about 12 by 8 metres"), and the distance between two picked points.
 * Pure numbers, unit tested.
 */

type P = { x: number; z: number };

/** Convex hull (monotone chain), counter-clockwise, no repeated end point. */
export function convexHull(points: P[]): P[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  if (pts.length < 3) return pts;
  const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower: P[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: P[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function polygonArea(ring: P[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

export type FootprintDims = {
  /** Longer side of the smallest enclosing rectangle, metres. */
  lengthM: number;
  /** Shorter side, metres. */
  widthM: number;
  /** Area of the footprint itself (not the rectangle), m². */
  areaM2: number;
  /** Bearing of the long side, degrees from the x axis. */
  angleDeg: number;
};

/** Smallest-area enclosing rectangle, by trying each hull edge as a side. */
export function footprintDims(ring: P[]): FootprintDims {
  const hull = convexHull(ring);
  let best = { area: Infinity, l: 0, w: 0, ang: 0 };
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const ang = Math.atan2(b.z - a.z, b.x - a.x);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of hull) {
      const u = p.x * c + p.z * s;
      const v = -p.x * s + p.z * c;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const du = maxU - minU;
    const dv = maxV - minV;
    if (du * dv < best.area - 1e-9)
      best =
        du >= dv
          ? { area: du * dv, l: du, w: dv, ang }
          : { area: du * dv, l: dv, w: du, ang: ang + Math.PI / 2 };
  }
  const deg = ((((best.ang * 180) / Math.PI) % 180) + 180) % 180;
  return {
    lengthM: Math.round(best.l * 10) / 10,
    widthM: Math.round(best.w * 10) / 10,
    areaM2: Math.round(polygonArea(ring)),
    angleDeg: Math.round(deg),
  };
}

export type Measurement = {
  /** Straight-line distance, metres. */
  directM: number;
  /** Distance across the ground, ignoring height, metres. */
  horizontalM: number;
  /** Rise (positive) or fall from the first point to the second, metres. */
  riseM: number;
  /** Slope between the points, percent of the horizontal distance. */
  slopePct: number | null;
};

export function measureBetween(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): Measurement {
  const horizontal = Math.hypot(b.x - a.x, b.z - a.z);
  const rise = b.y - a.y;
  const r1 = (v: number) => Math.round(v * 100) / 100;
  return {
    directM: r1(Math.hypot(horizontal, rise)),
    horizontalM: r1(horizontal),
    riseM: r1(rise),
    slopePct: horizontal >= 0.5 ? Math.round((rise / horizontal) * 1000) / 10 : null,
  };
}

/** Plain words for a measurement. */
export function describeMeasurement(m: Measurement): string {
  const parts = [
    `${m.directM.toFixed(2)} m straight`,
    `${m.horizontalM.toFixed(2)} m across the ground`,
  ];
  if (Math.abs(m.riseM) >= 0.05)
    parts.push(`${Math.abs(m.riseM).toFixed(2)} m ${m.riseM > 0 ? "higher" : "lower"}`);
  if (m.slopePct !== null && Math.abs(m.slopePct) >= 0.5)
    parts.push(`slope ${Math.abs(m.slopePct)}%`);
  return parts.join(" · ");
}

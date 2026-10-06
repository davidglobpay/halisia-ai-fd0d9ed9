/**
 * Step 7: put the surveyor's plot on the map, at its true size, by hand.
 *
 * A mutation plan states a plot's shape and size and nothing else. It carries
 * no coordinates and no north arrow — mutation-plan.ts says so in its own
 * header — so there is no transform from that sheet to the ground, and no
 * amount of software will invent one. What CAN be done honestly is draw the
 * plot at the scale the sheet states and let the person who knows the land put
 * it where it belongs and turn it to face the way it faces.
 *
 * That makes the placement theirs, not ours, and every surface that shows it
 * has to say so. This is not georeferencing. It is a tracing-paper overlay
 * with a scale bar, moved by hand.
 *
 * What it is FOR is the cross-check at the end: once the plot from the sheet
 * sits over the boundary they drew in step 3, the two can be compared. If a
 * 15.3 x 28.8 m rectangle cannot be made to sit over the land they traced,
 * something is wrong — the drawing, or the plot they picked off the sheet, or
 * the plot they were shown. That disagreement is worth more than either
 * document on its own.
 */

import {
  areaM2,
  centroid,
  fromLocalMetres,
  rectangleRing,
  rotate,
  toLocalMetres,
  checkPlanConsistency,
  type LatLng,
  type LocalXY,
  type PlanCheck,
} from "@/lib/parcel-geometry";
import { isConvex } from "@/lib/buildable";
import type { PlanPlot } from "@/lib/mutation-plan";

export type PlanShape = {
  /** The plot as a ring, centred on the origin, long axis running north. */
  ring: LocalXY[];
  widthM: number;
  depthM: number;
  /** Area of the ring as built. */
  areaM2: number;
  /** The area printed on the sheet for this plot, when there was one. */
  statedAreaM2: number | null;
  /**
   * Where the shape came from.
   *
   * "dimensions" — both sides were printed on the sheet. The rectangle is the
   *   sheet's own figures and nothing was chosen here.
   * "area-and-proportion" — only an area was printed, so the proportions are
   *   the user's choice. The area is the sheet's; the shape is not.
   */
  basis: "dimensions" | "area-and-proportion";
  /** Dimensions against the printed area, when both existed. */
  check: PlanCheck | null;
};

/**
 * The two sides that best explain the printed area.
 *
 * A plot label on a real sheet collects whatever dimensions were printed near
 * it, which can be more than two: a shared boundary is dimensioned once and
 * sits between two plots. Choosing the pair whose product is closest to the
 * printed area is the only rule here that uses the sheet to check itself
 * rather than guessing, and when the best pair is still a poor match the
 * caller is told so through `check` rather than the mismatch being hidden.
 */
export function bestDimensionPair(dims: number[], targetAreaM2: number): [number, number] | null {
  const uniq = [...new Set(dims.filter((d) => Number.isFinite(d) && d > 0))];
  if (uniq.length < 2) return null;
  let best: [number, number] | null = null;
  let bestErr = Infinity;
  for (let i = 0; i < uniq.length; i++) {
    for (let j = i + 1; j < uniq.length; j++) {
      const err = targetAreaM2 > 0 ? Math.abs(uniq[i] * uniq[j] - targetAreaM2) : 0;
      if (err < bestErr) {
        bestErr = err;
        best = [Math.min(uniq[i], uniq[j]), Math.max(uniq[i], uniq[j])];
      }
    }
  }
  return best;
}

/**
 * Build the plot's shape from what the sheet printed.
 *
 * `fallbackDims` are the sheet-wide dimensions, used when a plot label had
 * none tied close enough to it. `aspect` is depth over width, used ONLY when
 * no pair of dimensions exists and the shape has to come from the area alone —
 * in which case the result says so.
 */
export function shapeForPlot(
  plot: Pick<PlanPlot, "areaM2" | "dimsM">,
  fallbackDims: number[] = [],
  aspect = 1,
): PlanShape | null {
  const stated = Number.isFinite(plot.areaM2) && plot.areaM2 > 0 ? plot.areaM2 : null;

  const pair =
    bestDimensionPair(plot.dimsM ?? [], stated ?? 0) ??
    bestDimensionPair(fallbackDims, stated ?? 0);

  if (pair) {
    const [widthM, depthM] = pair;
    const ring = rectangleRing(widthM, depthM);
    if (!ring) return null;
    return {
      ring,
      widthM,
      depthM,
      areaM2: areaM2(ring),
      statedAreaM2: stated,
      basis: "dimensions",
      check: stated ? checkPlanConsistency(widthM, depthM, stated) : null,
    };
  }

  // No pair of printed dimensions. The area is still the sheet's, but the
  // proportions can only come from the person, so the basis says so and the
  // UI must not present this as the surveyor's shape.
  if (!stated) return null;
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const widthM = Math.sqrt(stated / a);
  const depthM = stated / widthM;
  const ring = rectangleRing(widthM, depthM);
  if (!ring) return null;
  return {
    ring,
    widthM,
    depthM,
    areaM2: areaM2(ring),
    statedAreaM2: stated,
    basis: "area-and-proportion",
    check: null,
  };
}

/**
 * The plot, rotated and dropped at a point on the map.
 *
 * Rotation is clockwise from north, the way a bearing is stated. The centre is
 * wherever the person put it. Neither number comes from the sheet.
 */
export function ringAt(shape: PlanShape, centre: LatLng, rotationDeg: number): LatLng[] {
  const turned = rotate(shape.ring, rotationDeg, { x: 0, y: 0 });
  return fromLocalMetres(turned, centre);
}

/** Move a point by metres east and north. For nudge controls. */
export function nudge(centre: LatLng, eastM: number, northM: number): LatLng {
  return fromLocalMetres([{ x: eastM, y: northM }], centre)[0];
}

/**
 * Clip one polygon to the inside of a convex one, Sutherland–Hodgman.
 *
 * Exact when `convex` really is convex. A reflex corner would cut away area
 * that is genuinely inside, so callers must check and report rather than quote
 * a number that looks precise. Returns the clipped ring, possibly empty.
 */
function clipToConvex(subject: LocalXY[], convex: LocalXY[]): LocalXY[] {
  if (subject.length < 3 || convex.length < 3) return [];
  // Orientation decides which side of each edge is "inside".
  let twice = 0;
  for (let i = 0, j = convex.length - 1; i < convex.length; j = i++) {
    twice += convex[j].x * convex[i].y - convex[i].x * convex[j].y;
  }
  const ccw = twice > 0;

  let out = subject.slice();
  for (let i = 0; i < convex.length && out.length; i++) {
    const a = convex[i];
    const b = convex[(i + 1) % convex.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;
    const nx = ccw ? -ey / len : ey / len;
    const ny = ccw ? ex / len : -ex / len;
    const side = (p: LocalXY) => (p.x - a.x) * nx + (p.y - a.y) * ny;

    const next: LocalXY[] = [];
    for (let k = 0; k < out.length; k++) {
      const cur = out[k];
      const prev = out[(k + out.length - 1) % out.length];
      const dCur = side(cur);
      const dPrev = side(prev);
      const cross = () => {
        const t = dPrev / (dPrev - dCur);
        return { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t };
      };
      if (dCur >= 0) {
        if (dPrev < 0) next.push(cross());
        next.push(cur);
      } else if (dPrev >= 0) {
        next.push(cross());
      }
    }
    out = next;
  }
  return out;
}

export type PlanFit = {
  /** How much of the plot from the sheet lies inside the boundary drawn. */
  overlapPct: number;
  /** The drawn area against the plot's area, signed. */
  areaDiffPct: number;
  /** Distance between the two centroids, in metres. */
  centroidOffsetM: number;
  /** False when the drawn boundary has an inward corner; the overlap is then a floor, not a figure. */
  exact: boolean;
};

/**
 * Compare the placed plot against the boundary drawn in step 3.
 *
 * Both rings are brought into one local frame before anything is measured,
 * which is the whole reason this is a separate function: comparing a ring in
 * lat/lng to a ring in metres is a mistake that produces plausible nonsense.
 */
export function fitAgainstBoundary(placed: LatLng[], drawn: LatLng[]): PlanFit | null {
  if (placed.length < 3 || drawn.length < 3) return null;
  const origin = drawn[0];
  const p = toLocalMetres(placed, origin);
  const d = toLocalMetres(drawn, origin);

  const pArea = areaM2(p);
  const dArea = areaM2(d);
  if (!(pArea > 0) || !(dArea > 0)) return null;

  const exact = isConvex(d);
  const clipped = clipToConvex(p, d);
  const overlap = clipped.length >= 3 ? areaM2(clipped) : 0;

  const cp = centroid(p);
  const cd = centroid(d);

  return {
    overlapPct: Math.min(100, (overlap / pArea) * 100),
    areaDiffPct: ((dArea - pArea) / pArea) * 100,
    centroidOffsetM: Math.hypot(cp.x - cd.x, cp.y - cd.y),
    exact,
  };
}

/**
 * A plain-language reading of a fit.
 *
 * The thresholds here are a rough guide for a reader, not a standard and not a
 * tolerance anyone has set. They are stated in the returned text so nobody
 * mistakes them for a rule, and the numbers are always shown alongside.
 */
export function describeFit(fit: PlanFit): { tone: "good" | "warn" | "bad"; text: string } {
  const o = Math.round(fit.overlapPct);
  const off = fit.centroidOffsetM;
  const caveat = fit.exact
    ? ""
    : " Your boundary has an inward corner, so the overlap is an under-estimate.";

  if (o >= 90 && off <= 5) {
    return {
      tone: "good",
      text:
        `${o}% of the plot from the sheet sits inside the boundary you drew, with their centres ` +
        `${off.toFixed(1)} m apart. The two agree closely.${caveat}`,
    };
  }
  if (o >= 70) {
    return {
      tone: "warn",
      text:
        `${o}% of the plot sits inside your boundary, centres ${off.toFixed(1)} m apart. Try ` +
        `turning or moving it before reading anything into the difference — a few degrees of ` +
        `rotation accounts for a lot.${caveat}`,
    };
  }
  return {
    tone: "bad",
    text:
      `Only ${o}% of the plot sits inside your boundary, centres ${off.toFixed(1)} m apart. If ` +
      `you cannot improve on that by turning and moving it, then the sketch, the plot you picked ` +
      `off the sheet, or the land you were shown do not match. Worth stopping on.${caveat}`,
  };
}

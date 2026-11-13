/**
 * Where garden features go on a plot: pure maths shared by the 3D view and
 * the page readout, so both say the same thing. The plot frame has u across
 * the plot, v along its depth, and the road edge at v = −depth/2.
 */
import type { Placement } from "@/lib/plot-placement";
import type { SiteFeatures } from "@/lib/building-types";

export type LayoutInput = {
  plot: { widthM: number; depthM: number };
  plotPlacement: Placement;
  house: Placement;
  footprint: { lengthM: number; widthM: number };
};

/** Plot (or house) frame → world. */
export function toWorld(p: Placement, u: number, v: number) {
  const a = (-p.rotationDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x + u * c + v * s, z: p.z - u * s + v * c };
}

/** World → plot (or house) frame. */
export function toLocal(p: Placement, x: number, z: number) {
  const a = (-p.rotationDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = x - p.x;
  const dz = z - p.z;
  return { u: dx * c - dz * s, v: dx * s + dz * c };
}

/** True when a world point is within `margin` of the building footprint. */
export function nearBuilding(
  house: Placement,
  fp: { lengthM: number; widthM: number },
  x: number,
  z: number,
  margin: number,
): boolean {
  const l = toLocal(house, x, z);
  return Math.abs(l.u) <= fp.lengthM / 2 + margin && Math.abs(l.v) <= fp.widthM / 2 + margin;
}

/** Depth of the front and back yards along the plot axis, and the building's position across it. */
export function yards(i: LayoutInput) {
  const h = toLocal(i.plotPlacement, i.house.x, i.house.z);
  const rel = ((i.house.rotationDeg - i.plotPlacement.rotationDeg) * Math.PI) / 180;
  const halfV =
    (Math.abs(Math.cos(rel)) * i.footprint.widthM + Math.abs(Math.sin(rel)) * i.footprint.lengthM) /
    2;
  return {
    u: h.u,
    front: h.v - halfV + i.plot.depthM / 2,
    back: i.plot.depthM / 2 - (h.v + halfV),
  };
}

export type FeatureLayout = {
  fountain: { u: number; v: number; radiusM: number } | null;
  court: { u: number; v: number; sizeM: number } | null;
  notes: string[];
};

/** Room needed in a yard for a fountain or a garden courtyard, metres. */
export const YARD_NEEDED_M = 5;

export function layoutFeatures(
  i: LayoutInput,
  f: Pick<SiteFeatures, "fountain" | "gardens">,
  gardenCourt: boolean,
): FeatureLayout {
  const y = yards(i);
  const notes: string[] = [];
  let fountain: FeatureLayout["fountain"] = null;
  let court: FeatureLayout["court"] = null;
  if (f.gardens)
    notes.push(
      "Gardens: lawn, clipped hedges with a gate at the road, trees along the boundary, flower beds and a paved path to the entrance.",
    );
  if (f.fountain) {
    if (y.front >= YARD_NEEDED_M) {
      const radiusM = Math.min(2.2, y.front / 4);
      fountain = {
        u: y.u * 0.5 + (f.gardens ? 2.6 : 0),
        v: -i.plot.depthM / 2 + Math.min(y.front / 2, 8),
        radiusM,
      };
      notes.push(`Fountain: about ${(2 * radiusM).toFixed(1)} m across, in the front yard.`);
    } else
      notes.push(
        `Fountain: not placed. The front yard is ${Math.max(0, y.front).toFixed(1)} m deep and a fountain needs about ${YARD_NEEDED_M} m; move the building back or choose a bigger plot.`,
      );
  }
  if (gardenCourt) {
    if (y.back >= YARD_NEEDED_M) {
      const sizeM = Math.floor(Math.min(8, y.back - 1, i.plot.widthM - 3));
      court = { u: y.u * 0.6, v: i.plot.depthM / 2 - y.back / 2, sizeM };
      notes.push(
        `Courtyard: a paved garden court about ${sizeM} × ${sizeM} m behind the building.`,
      );
    } else
      notes.push(
        `Courtyard: not placed. The back yard is ${Math.max(0, y.back).toFixed(1)} m deep and a courtyard needs about ${YARD_NEEDED_M} m.`,
      );
  }
  return { fountain, court, notes };
}

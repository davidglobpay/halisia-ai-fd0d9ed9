/**
 * Schematic house dimensions. Pure numbers — no three.js — so they are unit
 * tested independently of rendering. Schematic massing, not design.
 */
import type { SiteStructure } from "./site-params";

export const SCHEMATIC_LABEL = "Schematic massing — not an architectural design";

/** ISO external dimensions in metres. 40 ft is the high-cube variant. */
export const CONTAINER_DIMS = {
  container_20ft: { lengthM: 6.058, widthM: 2.438, heightM: 2.591 },
  container_40ft: { lengthM: 12.192, widthM: 2.438, heightM: 2.896 },
} as const;

export const MASONRY_WALL_M = 0.2;
export const MASONRY_DEFAULT_AREA_M2 = 110;
export const MASONRY_ASPECT = 1.4; // internal length : width
export const MASONRY_WALL_HEIGHT_M = 2.8;
export const ROOF_PITCH_DEG = 22;

/**
 * Floor area (internal, m²) → footprint. Internal length/width keep a 1.4:1
 * aspect; external adds a 200 mm wall on every side.
 */
export function masonryFootprint(floorAreaM2: number | null | undefined) {
  const area =
    floorAreaM2 && Number.isFinite(floorAreaM2) && floorAreaM2 > 0
      ? floorAreaM2
      : MASONRY_DEFAULT_AREA_M2;
  const innerW = Math.sqrt(area / MASONRY_ASPECT);
  const innerL = innerW * MASONRY_ASPECT;
  return {
    areaM2: area,
    innerLengthM: innerL,
    innerWidthM: innerW,
    outerLengthM: innerL + 2 * MASONRY_WALL_M,
    outerWidthM: innerW + 2 * MASONRY_WALL_M,
  };
}

export function structureLabel(s: SiteStructure): string {
  if (s === "container_20ft") return "20 ft ISO container";
  if (s === "container_40ft") return "40 ft high-cube container";
  return "Single-storey masonry (stone)";
}

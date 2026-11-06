/**
 * Foundation suggestion for the schematic site view. Pure numbers — no
 * three.js — so the rules are unit tested on their own.
 *
 * This is a planning suggestion read off a coarse public elevation grid, not
 * a foundation design. Soil type, bearing capacity and groundwater are not
 * known here; a soil test and a structural engineer decide the real design.
 */
import type { SiteStructure } from "./site-params";

export type FoundationKind =
  | "strip_slab"
  | "raised_plinth"
  | "columns_beams"
  | "container_pads"
  | "container_piers";

export type FoundationPlan = {
  kind: FoundationKind;
  /** Short name shown in the UI and the PDF. */
  name: string;
  /** One sentence: what it is. */
  summary: string;
  /** One sentence: why this one, from the ground reading. */
  why: string;
  /** Finished floor height above the highest ground under the footprint, metres. */
  clearanceM: number;
  /** Things a professional must confirm before building. */
  checks: string[];
};

/** Ground falls this much (metres) under the footprint before the type changes. */
export const MASONRY_STRIP_MAX_DROP_M = 0.3;
export const MASONRY_PLINTH_MAX_DROP_M = 1.2;
export const CONTAINER_PAD_MAX_DROP_M = 0.6;

/** Difference between the highest and lowest ground samples, metres. */
export function groundDrop(heights: number[]): number | null {
  const ok = heights.filter((h) => Number.isFinite(h));
  if (!ok.length) return null;
  return Math.max(...ok) - Math.min(...ok);
}

const ALWAYS_CHECK = [
  "Soil type is not known here (no soil reading for this point). Trial pits or a geotechnical report decide footing depth and width; expansive black cotton soil needs a different design.",
  "A structural engineer designs and signs the foundation. This is a planning suggestion, not a design.",
];

export function planFoundation(o: {
  structure: SiteStructure;
  /** Ground fall under the footprint in metres; null when no terrain was read. */
  dropM: number | null;
  stacked?: boolean;
  /** Where the ground reading came from, e.g. "ASTER GDEM v3 (~30 m)". */
  source?: string | null;
}): FoundationPlan {
  const drop = o.dropM ?? 0;
  const dropText =
    o.dropM == null
      ? "No terrain reading here, so level ground is assumed."
      : `The ground under the footprint falls about ${o.dropM.toFixed(2)} m${
          o.source ? ` on the ${o.source} grid` : ""
        }, which cannot see small bumps, ditches or rock.`;

  if (o.structure === "container_20ft" || o.structure === "container_40ft") {
    const stackChecks = o.stacked
      ? [
          "Two-high stacking: pads sized for both levels, upper units locked with twist-locks or welded plates, and a wind check on the stack.",
        ]
      : [];
    if (drop <= CONTAINER_PAD_MAX_DROP_M) {
      return {
        kind: "container_pads",
        name: "Concrete pad footings",
        summary:
          "Reinforced concrete pads under each corner casting (and mid-span on 40 ft units), the container bolted or welded to plates cast into them.",
        why: `${dropText} Pads keep the steel off the ground, let air and water pass underneath and need little digging.`,
        clearanceM: 0.3,
        checks: [...stackChecks, ...ALWAYS_CHECK],
      };
    }
    return {
      kind: "container_piers",
      name: "Concrete piers on pad footings",
      summary:
        "Pad footings with short reinforced concrete piers (or steel stools) of different heights, levelled to the high side of the ground.",
      why: `${dropText} Piers of different heights level the units without heavy cut and fill.`,
      clearanceM: 0.3,
      checks: [...stackChecks, ...ALWAYS_CHECK],
    };
  }

  if (drop <= MASONRY_STRIP_MAX_DROP_M) {
    return {
      kind: "strip_slab",
      name: "Strip footing and ground slab",
      summary:
        "Concrete strip footings under every load-bearing wall, a stone plinth wall to floor level and a ground-floor slab on compacted hardcore with a damp-proof membrane.",
      why: `${dropText} Nearly level ground suits the most common and cheapest Kenyan foundation.`,
      clearanceM: 0.15,
      checks: ALWAYS_CHECK,
    };
  }
  if (drop <= MASONRY_PLINTH_MAX_DROP_M) {
    return {
      kind: "raised_plinth",
      name: "Stepped strip footing with raised plinth",
      summary:
        "Strip footings stepped down the slope, taller plinth walls on the low side, and the slab cast on compacted fill so the floor sits above the high side.",
      why: `${dropText} Stepping the footing follows the fall without levelling the whole site.`,
      clearanceM: 0.15,
      checks: ALWAYS_CHECK,
    };
  }
  return {
    kind: "columns_beams",
    name: "Columns on pad footings with ground beams",
    summary:
      "Reinforced concrete columns on pad footings tied by ground beams, carrying a suspended floor slab; the alternative is cutting terraces into the slope.",
    why: `${dropText} On this much fall, a suspended floor avoids deep fill and tall retaining plinths.`,
    clearanceM: 0.15,
    checks: ALWAYS_CHECK,
  };
}

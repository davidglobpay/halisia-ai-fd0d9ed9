/**
 * Step 6: turn a household's answers into an architect's brief, and test that
 * brief against the ground the plot actually leaves.
 *
 * What this is
 * ------------
 * A MASSING STUDY. It answers one question: "does the amount of building my
 * family needs fit inside the setbacks I entered, and on how many floors?"
 * That is arithmetic, and arithmetic is a thing software may do honestly.
 *
 * What this is NOT, and must never be presented as
 * ------------------------------------------------
 * It is not a design. It does not lay out rooms, does not place windows,
 * doors, stairs or services, does not orient the house, and does not position
 * anything on the parcel. A rectangle of the right area is not a house, and a
 * massing block is not architecture. The output of this file is the brief an
 * architect starts from, plus the envelope they have to work inside.
 *
 * It is also not a planning approval. Plot ratio, height limits, parking
 * standards, fire access and services are the county's to rule on.
 *
 * On the room sizes
 * -----------------
 * Every default below is a PLANNING ALLOWANCE, not a standard and not a
 * regulation. They are starting figures in the range Kenyan houses are
 * commonly built at, offered so a person has something to adjust rather than a
 * blank box. Every one is editable, and the brief prints which ones were
 * changed. Nothing here cites a building code, because this file has not read
 * one.
 *
 * The same rule that governs setbacks in buildable.ts governs these: a figure
 * invented here and shown with authority would be worse than no figure.
 */

import { fitFootprint, orientedExtent, type Envelope } from "@/lib/buildable";
import type { LocalXY } from "@/lib/parcel-geometry";

/**
 * Which boundary the front setback applies to: the longest one.
 *
 * On a Kenyan subdivision plot the long side almost always faces the road, and
 * the person can see the result drawn on the map and change the figures if it
 * is the wrong edge. The rule lives here, in one place, because it was once
 * written in build-brief.tsx and NOT in the report, so the screen said 144 m2
 * buildable and the PDF said 212 m2 for the same plot and the same inputs.
 * Anything that computes an envelope must use this.
 */
export function frontEdgeIndexOf(ring: LocalXY[]): number {
  if (ring.length < 3) return 0;
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  return best;
}

export type RoomId =
  | "masterEnsuite"
  | "bedroom"
  | "bathroom"
  | "sitting"
  | "dining"
  | "family"
  | "kitchen"
  | "pantry"
  | "study"
  | "laundry"
  | "dsq";

export type RoomSpec = {
  id: RoomId;
  label: string;
  /** Planning allowance in square metres. Editable by the user. */
  defaultM2: number;
  /** What the allowance is meant to cover, in plain words. */
  note: string;
};

/**
 * Starting allowances. Ranges a Kenyan house is commonly built at, offered as
 * a starting point and nothing more. The UI shows each one and lets it change.
 */
export const ROOMS: readonly RoomSpec[] = [
  {
    id: "masterEnsuite",
    label: "Master bedroom with ensuite",
    defaultM2: 20,
    note: "Bedroom plus its own bathroom, counted together.",
  },
  {
    id: "bedroom",
    label: "Bedroom",
    defaultM2: 12,
    note: "A room that takes a double bed and a wardrobe.",
  },
  {
    id: "bathroom",
    label: "Bathroom or shower room",
    defaultM2: 4.5,
    note: "Shared, not counted inside a bedroom.",
  },
  { id: "sitting", label: "Sitting room", defaultM2: 22, note: "The main room for visitors." },
  {
    id: "dining",
    label: "Dining",
    defaultM2: 14,
    note: "Seated dining, separate from the sitting room.",
  },
  {
    id: "family",
    label: "Family room",
    defaultM2: 16,
    note: "A second, more private living space.",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    defaultM2: 12,
    note: "Working kitchen with counter and appliances.",
  },
  { id: "pantry", label: "Pantry or store", defaultM2: 4, note: "Dry store off the kitchen." },
  {
    id: "study",
    label: "Study or office",
    defaultM2: 9,
    note: "A room to work in with the door shut.",
  },
  { id: "laundry", label: "Laundry", defaultM2: 5, note: "Washing, drying and ironing." },
  {
    id: "dsq",
    label: "Staff quarters",
    defaultM2: 14,
    note: "Room, shower and WC, usually detached. Counted in the floor area either way.",
  },
] as const;

export type Questionnaire = {
  /** How many of each room. Zero means the household does not want one. */
  counts: Partial<Record<RoomId, number>>;
  /** Floors the household is willing to build. The study may need more. */
  storeys: number;
  /** Covered parking bays. Each adds floor area if it is under roof. */
  parkingBays: number;
  /** Is the parking under the building's roof, or open hardstanding? */
  parkingCovered: boolean;
  /** What the building is for. Changes nothing geometric; it goes in the brief. */
  purpose: "own-home" | "rental" | "resale" | "mixed";
  /** The household, for the brief. Not used in any calculation. */
  household: { adults: number; children: number };
  /** Anything the household wants the architect to know. Free text. */
  notes: string;
};

export type BriefOptions = {
  /**
   * Walls, corridors, stairs and the thickness of everything, as a percentage
   * added to the sum of the rooms. 18% is a common starting figure for a
   * compact house; a long thin plan needs more. Editable.
   */
  circulationPct?: number;
  /** Floor to floor, in metres. Affects the height estimate only. */
  floorToFloorM?: number;
  /** Area per covered parking bay, in square metres. */
  parkingBayM2?: number;
  /** Room allowances the user changed, by id. */
  roomAreas?: Partial<Record<RoomId, number>>;
};

export const DEFAULTS = {
  circulationPct: 18,
  floorToFloorM: 3,
  parkingBayM2: 15,
} as const;

export type ScheduleLine = {
  id: RoomId | "parking" | "circulation";
  label: string;
  count: number;
  /** Allowance used for ONE of them. Null for the circulation line. */
  eachM2: number | null;
  totalM2: number;
  /** True when the user changed this from its starting allowance. */
  edited: boolean;
};

export type MassingStudy = {
  schedule: ScheduleLine[];
  /** Sum of the rooms, before circulation. */
  netM2: number;
  /** Everything, including circulation and covered parking. */
  grossM2: number;
  /** Storeys the household asked for. */
  storeysRequested: number;
  /** Storeys actually needed to fit inside the envelope. */
  storeysNeeded: number | null;
  /** Floor area on the ground, at the requested number of storeys. */
  footprintM2: number;
  /** The buildable area the setbacks left, from step 4. */
  envelopeM2: number | null;
  /** Does the footprint fit, by area alone? */
  fitsByArea: boolean | null;
  /**
   * Does a rectangle of that footprint actually fit inside the envelope's
   * shape, placed centred and square to the longest boundary? A weaker claim
   * than it sounds, and `fitNote` says so.
   */
  fitsAsRectangle: boolean | null;
  fitNote: string | null;
  /** The rectangle tested, proportioned to the envelope's own extent. */
  rect: { widthM: number; depthM: number } | null;
  /** Footprint as a percentage of the whole plot. */
  coveragePct: number | null;
  /** Storeys times floor-to-floor. A massing height, not a roof height. */
  heightM: number;
  /** Everything the study cannot answer. Always non-empty. */
  limits: string[];
};

function roomArea(id: RoomId, opts: BriefOptions): { m2: number; edited: boolean } {
  const spec = ROOMS.find((r) => r.id === id);
  const base = spec ? spec.defaultM2 : 0;
  const override = opts.roomAreas?.[id];
  if (override != null && Number.isFinite(override) && override > 0 && override !== base) {
    return { m2: override, edited: true };
  }
  return { m2: base, edited: false };
}

/**
 * Build the schedule and the massing study.
 *
 * `envelope` is step 4's buildable envelope. Passing null is normal — it means
 * the person has not drawn a boundary yet — and the study still returns the
 * floor areas their brief implies, with every fit field left null rather than
 * guessed.
 */
export function massingStudy(
  q: Questionnaire,
  envelope: Envelope | null,
  plotAreaM2: number | null,
  opts: BriefOptions = {},
): MassingStudy {
  const circulationPct = Number.isFinite(opts.circulationPct)
    ? Math.max(0, Math.min(60, opts.circulationPct as number))
    : DEFAULTS.circulationPct;
  const floorToFloorM = Number.isFinite(opts.floorToFloorM)
    ? Math.max(2, Math.min(6, opts.floorToFloorM as number))
    : DEFAULTS.floorToFloorM;
  const parkingBayM2 = Number.isFinite(opts.parkingBayM2)
    ? Math.max(1, opts.parkingBayM2 as number)
    : DEFAULTS.parkingBayM2;

  const schedule: ScheduleLine[] = [];
  let net = 0;

  for (const spec of ROOMS) {
    const count = Math.max(0, Math.floor(q.counts[spec.id] ?? 0));
    if (!count) continue;
    const { m2, edited } = roomArea(spec.id, opts);
    const total = count * m2;
    net += total;
    schedule.push({
      id: spec.id,
      label: spec.label,
      count,
      eachM2: m2,
      totalM2: total,
      edited,
    });
  }

  const bays = Math.max(0, Math.floor(q.parkingBays ?? 0));
  if (bays > 0 && q.parkingCovered) {
    const total = bays * parkingBayM2;
    net += total;
    schedule.push({
      id: "parking",
      label: "Covered parking",
      count: bays,
      eachM2: parkingBayM2,
      totalM2: total,
      edited: opts.parkingBayM2 != null && opts.parkingBayM2 !== DEFAULTS.parkingBayM2,
    });
  }

  const circulation = net * (circulationPct / 100);
  if (net > 0) {
    schedule.push({
      id: "circulation",
      label: `Walls, corridors and stairs (${circulationPct}%)`,
      count: 1,
      eachM2: null,
      totalM2: circulation,
      edited: opts.circulationPct != null && opts.circulationPct !== DEFAULTS.circulationPct,
    });
  }

  const gross = net + circulation;
  const storeysRequested = Math.max(1, Math.floor(q.storeys || 1));
  const footprint = gross / storeysRequested;

  const envelopeM2 = envelope?.buildable ? envelope.areaM2 : envelope ? 0 : null;

  let fitsByArea: boolean | null = null;
  let fitsAsRectangle: boolean | null = null;
  let fitNote: string | null = null;
  let rect: { widthM: number; depthM: number } | null = null;
  let storeysNeeded: number | null = null;

  if (envelopeM2 != null && gross > 0) {
    fitsByArea = envelopeM2 > 0 && footprint <= envelopeM2;
    storeysNeeded = envelopeM2 > 0 ? Math.ceil(gross / envelopeM2) : null;

    const ext = envelope && envelope.ring.length >= 3 ? orientedExtent(envelope.ring) : null;
    if (ext && ext.alongM > 0 && ext.acrossM > 0 && footprint > 0) {
      // A rectangle of the required area, proportioned to the envelope's own
      // extent. Keeping the proportion is what a builder does by eye, and it
      // is the only choice here that is not arbitrary.
      const ratio = ext.alongM / ext.acrossM;
      const depth = Math.sqrt(footprint / ratio);
      const width = footprint / depth;
      rect = { widthM: width, depthM: depth };

      const fit = fitFootprint(envelope!.ring, width, depth);
      if (fit) {
        fitsAsRectangle = fit.fits;
        fitNote = fit.method;
      }
    }
  }

  const coveragePct =
    plotAreaM2 != null && plotAreaM2 > 0 && gross > 0 ? (footprint / plotAreaM2) * 100 : null;

  const limits = [
    "This is a massing study, not a design. It says how much floor area the brief needs and whether that much fits inside the setbacks you entered. It does not lay out rooms, place a stair, orient the house or position anything on the plot.",
    "Room sizes above are planning allowances you can change, not a standard and not a regulation. Nothing here is taken from a building code.",
    "Plot ratio, height limits, parking standards, fire access, services and whether the county would approve any of this are not checked.",
    "A buildable envelope is only as good as the boundary that was drawn and the setbacks that were entered. Both came from you, not from a survey.",
  ];
  if (envelopeM2 == null) {
    limits.push(
      "No boundary has been drawn yet, so nothing here has been tested against real ground.",
    );
  } else if (envelope && !envelope.exact) {
    limits.push(
      "This plot has a corner that turns inward, so the buildable area is a cautious under-estimate and the fit test is conservative.",
    );
  }

  return {
    schedule,
    netM2: net,
    grossM2: gross,
    storeysRequested,
    storeysNeeded,
    footprintM2: footprint,
    envelopeM2,
    fitsByArea,
    fitsAsRectangle,
    fitNote,
    rect,
    coveragePct,
    heightM: storeysRequested * floorToFloorM,
    limits,
  };
}

/**
 * The brief, as text an architect can read.
 *
 * Omitted lines are null and dropped; an empty string is a real blank line.
 * That distinction matters — an earlier version filtered out every falsy entry
 * and silently stripped the section breaks with them.
 */
export function briefText(
  q: Questionnaire,
  study: MassingStudy,
  context?: {
    reference?: string | null;
    plotAreaM2?: number | null;
    setbacks?: { frontM: number; sideM: number } | null;
  },
): string {
  const n = (v: number) => Math.round(v).toLocaleString("en-KE");
  const people = q.household.adults + q.household.children;

  const lines: (string | null)[] = [
    "BRIEF FOR AN ARCHITECT",
    context?.reference ? `Parcel: ${context.reference}` : null,
    context?.plotAreaM2 ? `Plot area: ${n(context.plotAreaM2)} m2` : null,
    context?.setbacks
      ? `Setbacks entered: ${context.setbacks.frontM} m front, ${context.setbacks.sideM} m to other boundaries`
      : null,
    "",
    "THE HOUSEHOLD",
    `  ${q.household.adults} adults, ${q.household.children} children${people ? "" : " (not stated)"}`,
    `  Purpose: ${
      q.purpose === "own-home"
        ? "a home to live in"
        : q.purpose === "rental"
          ? "to let"
          : q.purpose === "resale"
            ? "to build and sell"
            : "part home, part let"
    }`,
    "",
    "ACCOMMODATION ASKED FOR",
    ...study.schedule
      .filter((l) => l.id !== "circulation")
      .map(
        (l) =>
          `  ${l.count} x ${l.label} at ${l.eachM2} m2 = ${n(l.totalM2)} m2${l.edited ? "  (allowance changed)" : ""}`,
      ),
    `  Walls, corridors and stairs: ${n(study.grossM2 - study.netM2)} m2`,
    "",
    "WHAT THAT COMES TO",
    `  Total floor area: ${n(study.grossM2)} m2 over ${study.storeysRequested} ${study.storeysRequested === 1 ? "floor" : "floors"}`,
    `  Ground floor footprint: ${n(study.footprintM2)} m2`,
    study.envelopeM2 != null ? `  Buildable area after setbacks: ${n(study.envelopeM2)} m2` : null,
    study.coveragePct != null
      ? `  Ground coverage: ${study.coveragePct.toFixed(0)}% of the plot`
      : null,
    study.fitsByArea == null
      ? null
      : study.fitsByArea
        ? `  Fits by area at ${study.storeysRequested} ${study.storeysRequested === 1 ? "floor" : "floors"}.`
        : `  Does NOT fit at ${study.storeysRequested} ${study.storeysRequested === 1 ? "floor" : "floors"}.${
            study.storeysNeeded ? ` Needs ${study.storeysNeeded}, or a smaller brief.` : ""
          }`,
    study.fitsAsRectangle == null
      ? null
      : study.fitsAsRectangle
        ? `  A ${study.rect!.widthM.toFixed(1)} x ${study.rect!.depthM.toFixed(1)} m block fits inside the envelope.`
        : `  A ${study.rect!.widthM.toFixed(1)} x ${study.rect!.depthM.toFixed(1)} m block does not fit centred and square. A different shape or position may.`,
    `  Massing height: about ${study.heightM.toFixed(1)} m to the top floor level`,
    q.notes.trim() ? "" : null,
    q.notes.trim() ? "FROM THE HOUSEHOLD" : null,
    ...(q.notes.trim()
      ? q.notes
          .trim()
          .split("\n")
          .map((l) => `  ${l}`)
      : []),
    "",
    "WHAT THIS DOCUMENT DOES NOT DO",
    ...study.limits.map((l) => `  - ${l}`),
  ];

  return lines.filter((l): l is string => l !== null).join("\n");
}

/**
 * A massing block per storey, as rings in the local metre frame, for drawing.
 *
 * Each storey is the same rectangle at the centroid of the envelope. That is
 * deliberately the dullest possible massing: anything cleverer would be a
 * design decision, and this file does not make design decisions.
 */
export function massingBlocks(
  study: MassingStudy,
  envelope: Envelope | null,
): { storey: number; ring: LocalXY[] }[] {
  if (!study.rect || !envelope || envelope.ring.length < 3) return [];
  const fit = fitFootprint(envelope.ring, study.rect.widthM, study.rect.depthM);
  if (!fit) return [];
  const out: { storey: number; ring: LocalXY[] }[] = [];
  for (let s = 1; s <= study.storeysRequested; s++) out.push({ storey: s, ring: fit.ring });
  return out;
}

/**
 * What kind of thing a data output is, and therefore what it may claim.
 *
 * This replaces the composite reading that used to lead the location page. That
 * number was a persona-weighted mean of three module scores whose values were
 * hard-coded bands, graded against literal cut-offs, and it could not be
 * checked by anyone — including us. A buyer reading "72 / 100 · Good" had no
 * way to ask "good compared to what?", and there was no answer.
 *
 * The replacement is a structure rather than a number. Every output belongs to
 * exactly one of four classes, and the class decides how it may be presented:
 *
 *   visible    a person can confirm it by looking at imagery of this place
 *   measured   it comes from a named dataset, checkable at the source
 *   inferred   a rule or model produced it; nothing observed it
 *   unprovable no imagery and no open dataset can establish it from here
 *
 * The fourth class is the one that earns trust. Telling somebody plainly that
 * ownership, title and boundaries cannot be established from above — and that
 * they must go to the registry — is worth more than any score, because it is
 * the thing that loses people their money.
 *
 * Only `visible` and `measured` outputs may be drawn on the map as evidence.
 * `inferred` may be shown with its label. `unprovable` is named as a gap and
 * never given a value.
 */

export type EvidenceClass = "visible" | "measured" | "inferred" | "unprovable";

export type ClassMeta = {
  id: EvidenceClass;
  /** Heading a reader sees. Written for someone with no training. */
  label: string;
  /** One sentence telling them what this class is worth. */
  meaning: string;
  /** What to do about it. Empty where no action follows. */
  action: string;
  /** May an output of this class be drawn on the map as evidence? */
  mappable: boolean;
  /** Ordering on screen: what can be checked comes first. */
  rank: number;
};

export const EVIDENCE_CLASSES: readonly ClassMeta[] = [
  {
    id: "visible",
    label: "You can see this",
    meaning:
      "It is there in the satellite, aerial or street imagery of this place. Open the map and look for yourself.",
    action: "Check it on the imagery before you rely on it.",
    mappable: true,
    rank: 0,
  },
  {
    id: "measured",
    label: "Reported by a named dataset",
    meaning:
      "A named dataset reports this. Check its method, date and resolution; a record is not necessarily a direct field measurement.",
    action: "The source is named beside each figure.",
    mappable: true,
    rank: 1,
  },
  {
    id: "inferred",
    label: "Worked out, not observed",
    meaning:
      "A rule produced this from the figures above. Nobody measured it and no dataset holds it. It can be wrong without anything looking wrong.",
    action: "Treat it as a starting point for a question, never as a finding.",
    mappable: false,
    rank: 2,
  },
  {
    id: "unprovable",
    label: "Nobody can tell you this from here",
    meaning:
      "No photograph, satellite pass or open dataset establishes it. Anyone who offers you this from a screen is guessing.",
    action: "This needs a registry search, a licensed surveyor or a site visit.",
    mappable: false,
    rank: 3,
  },
] as const;

export const classMeta = (id: EvidenceClass): ClassMeta =>
  EVIDENCE_CLASSES.find((c) => c.id === id) as ClassMeta;

/** May this class be drawn on the map as evidence? */
export const isMappable = (id: EvidenceClass): boolean => classMeta(id).mappable;

export type OutputDescriptor = {
  /** Stable id, matching the evidence row ids the passport already uses. */
  id: string;
  /** What a reader calls it. */
  label: string;
  cls: EvidenceClass;
  /** The dataset, API or method behind it. Null only where nothing is read. */
  source: string | null;
};

/**
 * Every per-location output, by what can actually be said about it.
 *
 * Derived from a full audit of the location surfaces. Where a value was found
 * to come from a hard-coded band or an uncalibrated weighting it is classed
 * `inferred` however confident its old presentation looked, and where no
 * dataset or image can settle it at all it is `unprovable` even when the app
 * used to print a number for it.
 */
export const OUTPUT_CLASSES: readonly OutputDescriptor[] = [
  // --- visible: confirmable against imagery of this place ---
  {
    id: "schools",
    label: "Schools within 3 km",
    cls: "measured",
    source: "Google Places",
  },
  {
    id: "health",
    label: "Health facilities within 3 km",
    cls: "measured",
    source: "Google Places",
  },
  {
    id: "shops",
    label: "Shops and markets within 3 km",
    cls: "measured",
    source: "Google Places",
  },
  {
    id: "transit",
    label: "Public transport within 3 km",
    cls: "measured",
    source: "Google Places",
  },
  {
    id: "osm-fac",
    label: "Mapped public facilities",
    cls: "measured",
    source: "OpenStreetMap Overpass",
  },
  {
    id: "slope",
    label: "Slope and aspect",
    cls: "inferred",
    source: "Open-Topo-Data ASTER 30 m",
  },
  {
    id: "relief",
    label: "Relief and landform",
    cls: "inferred",
    source: "Open-Topo-Data ASTER 30 m",
  },
  {
    id: "boundary-drawn",
    label: "Boundary you drew",
    cls: "inferred",
    source: "Drawn on the map by you",
  },
  {
    id: "buildable",
    label: "Buildable area inside your setbacks",
    cls: "inferred",
    source: "Computed from your drawn boundary",
  },

  // --- measured: a named dataset, checkable at source ---
  {
    id: "elev",
    label: "Elevation",
    cls: "measured",
    source: "Google Maps Elevation API",
  },
  {
    id: "aqi",
    label: "Air quality now",
    cls: "measured",
    source: "Google Air Quality API",
  },
  {
    id: "rain",
    label: "Mean annual rainfall",
    cls: "inferred",
    source: "Open-Meteo Climate (EC-Earth3P-HR, 2010–2020)",
  },
  {
    id: "temp",
    label: "Mean temperature",
    cls: "inferred",
    source: "Open-Meteo Climate (EC-Earth3P-HR, 2010–2020)",
  },
  {
    id: "weather",
    label: "Weather now and next 7 days",
    cls: "inferred",
    source: "Open-Meteo forecast",
  },
  {
    id: "county",
    label: "County",
    cls: "measured",
    source: "IEBC county boundaries",
  },
  {
    id: "ward",
    label: "Ward and constituency",
    cls: "measured",
    source: "OpenStreetMap Nominatim",
  },
  {
    id: "pop",
    label: "County population",
    cls: "measured",
    source: "KNBS 2019 Census",
  },
  {
    id: "soil",
    label: "Soil composition",
    cls: "inferred",
    source: "ISRIC SoilGrids v2.0 (250 m model)",
  },
  {
    id: "coords",
    label: "Coordinates",
    cls: "inferred",
    source: "Entered, pinned or geocoded — provenance recorded",
  },

  // --- inferred: a rule produced it; nothing observed it ---
  {
    id: "flood-proxy",
    label: "Flood proxy",
    cls: "inferred",
    source: "Elevation bands only — not a flood model",
  },
  {
    id: "erosion",
    label: "Erosion risk",
    cls: "inferred",
    source: "Slope thresholds",
  },
  {
    id: "landform-risk",
    label: "Landform risk notes",
    cls: "inferred",
    source: "Rules over slope and soil",
  },
  {
    id: "geology",
    label: "Geological interpretation",
    cls: "inferred",
    source: "Rules over landform, clay and elevation",
  },
  {
    id: "concepts",
    label: "Indicative development concepts",
    cls: "inferred",
    source: "Thresholds over nearby amenity counts",
  },

  // --- unprovable: no imagery and no open dataset settles it ---
  {
    id: "title",
    label: "Title and its validity",
    cls: "unprovable",
    source: null,
  },
  { id: "owner", label: "Who owns it", cls: "unprovable", source: null },
  {
    id: "encumbrance",
    label: "Charges, caveats and encumbrances",
    cls: "unprovable",
    source: null,
  },
  {
    id: "boundary-legal",
    label: "The legal parcel boundary",
    cls: "unprovable",
    source: null,
  },
  {
    id: "zoning",
    label: "Zoning and planning approval",
    cls: "unprovable",
    source: null,
  },
  {
    id: "bearing",
    label: "Bearing capacity of the ground",
    cls: "unprovable",
    source: null,
  },
  { id: "bedrock", label: "Depth to bedrock", cls: "unprovable", source: null },
  {
    id: "groundwater",
    label: "Shallow groundwater",
    cls: "unprovable",
    source: null,
  },
  {
    id: "comps",
    label: "What comparable plots sold for",
    cls: "unprovable",
    source: null,
  },
] as const;

export const outputsOfClass = (cls: EvidenceClass): OutputDescriptor[] =>
  OUTPUT_CLASSES.filter((o) => o.cls === cls);

export const classOf = (id: string): EvidenceClass | undefined =>
  OUTPUT_CLASSES.find((o) => o.id === id)?.cls;

/** Counts per class, in reading order, for a summary strip. */
export function classTally(): Array<{ meta: ClassMeta; count: number }> {
  return [...EVIDENCE_CLASSES]
    .sort((a, b) => a.rank - b.rank)
    .map((meta) => ({ meta, count: outputsOfClass(meta.id).length }));
}

/**
 * The sentence that replaces the old reading, spoken and shown.
 *
 * It deliberately leads with what cannot be known. A buyer who remembers one
 * thing from this page should remember that the screen cannot tell them who
 * owns the land.
 */
export const EVIDENCE_LEAD =
  "HALISIA publishes no score for this place. Nothing here is graded, ranked or rated. " +
  "The catalogue below describes output types, not evidence retrieved for this location: what imagery may show when available, " +
  "what a named dataset reports, what a rule worked out, and what nobody can tell you from a screen at all. " +
  "Ownership, title, the legal boundary and planning approval are in that last group. " +
  "They need a registry search and a licensed surveyor, and no amount of data on this page replaces them.";

/**
 * Super Land Passport evidence builder.
 *
 * Pure function: maps results the app already fetches (Google location intel,
 * ISRIC/ASTER geotech, OSM/Open-Meteo Wave 4, county facts) into one list of
 * evidence rows, each stating its value, source, method, what it feeds and how
 * sure HALISIA is. A missing value is always a labelled gap — never a default.
 * Nothing in here can mark land, title, boundary or ownership as verified.
 */
import type { LocationIntel } from "@/lib/location-intel.functions";
import type { GeotechIntel } from "@/lib/geotech.functions";
import type { Wave4Intel } from "@/lib/wave4-intel.functions";
import type { CountyFacts } from "@/lib/kenya-county-facts";

export type ChapterId =
  "identity" | "admin" | "physical" | "climate" | "access" | "build" | "market" | "trust";

export const CHAPTERS: Array<{ id: ChapterId; title: string; blurb: string }> = [
  {
    id: "identity",
    title: "Identity & position",
    blurb: "What this is and how sure we are where it is.",
  },
  {
    id: "admin",
    title: "Administrative context",
    blurb: "County, sub-county, ward and county facts.",
  },
  {
    id: "physical",
    title: "Physical land",
    blurb: "Elevation, slope, landform and soil by depth.",
  },
  {
    id: "climate",
    title: "Climate & environment",
    blurb: "Long-term rainfall and temperature, air, water.",
  },
  { id: "access", title: "Access & services", blurb: "Roads, schools, health, shops, transport." },
  {
    id: "build",
    title: "Build & develop",
    blurb: "Ground investigation and planning evidence gaps.",
  },
  {
    id: "market",
    title: "Market & investment",
    blurb:
      "Counts of what is mapped nearby, withheld where mapping is thin. No scores, no return predictions.",
  },
  { id: "trust", title: "Legal, finance & trust", blurb: "What has and has not been checked." },
];

export type EvidenceClass = "measured" | "modelled" | "official" | "user" | "ai" | "gap";
export type Confidence = "high" | "medium" | "low" | "not_assessed";

export const CLASS_LABEL: Record<EvidenceClass, string> = {
  measured: "Measured",
  modelled: "Modelled",
  official: "Official statistics",
  user: "User / seller provided",
  ai: "HALISIA interpretation",
  gap: "Not available",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  not_assessed: "Not assessed",
};

export type EvidenceItem = {
  id: string;
  chapter: ChapterId;
  label: string;
  /** Null means not available; UI must render the gap, not a number. */
  value: string | null;
  source: string;
  method: string;
  usedFor: string[];
  cls: EvidenceClass;
  confidence: Confidence;
  retrieved: string | null;
  note?: string;
};

export type LedgerStatus = "ok" | "no_data" | "failed" | "loading" | "not_connected";

export type LedgerEntry = {
  id: string;
  provider: string;
  status: LedgerStatus;
  detail: string;
  chapters: ChapterId[];
};

export type FetchState = "loading" | "ok" | "error";

export type PassportEvidenceInput = {
  lat: number;
  lng: number;
  ref: string;
  positionLabel: string;
  positionExact: boolean;
  locationConfidencePct: number;
  sourceLabel: string;
  countyName: string | null;
  admin: { subCounty?: string | null; ward?: string | null; locality?: string | null } | null;
  facts: CountyFacts | null;
  intel: LocationIntel | null | undefined;
  intelState: FetchState;
  geotech: GeotechIntel | null | undefined;
  geoState: FetchState;
  wave4: Wave4Intel | null | undefined;
  w4State: FetchState;
  retrievedAt: string;
};

const r = (n: number, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : "—");

function srcUsed(list: Array<{ label: string; used: boolean }> | undefined, needle: string) {
  return !!list?.some((s) => s.used && s.label.toLowerCase().includes(needle.toLowerCase()));
}

function stateGap(state: FetchState, what: string): string {
  if (state === "loading") return `${what}: still loading`;
  if (state === "error")
    return `${what}: provider request failed on this visit (not a zero result)`;
  return `${what}: provider returned no data for this point`;
}

export function buildPassportEvidence(i: PassportEvidenceInput): {
  items: EvidenceItem[];
  ledger: LedgerEntry[];
  summary: { total: number; available: number; missing: number; coveragePct: number };
} {
  const items: EvidenceItem[] = [];
  const t = i.retrievedAt;
  const add = (it: Omit<EvidenceItem, "retrieved"> & { retrieved?: string | null }) =>
    items.push({
      retrieved: t,
      ...it,
      ...(it.value == null ? { cls: "gap", confidence: "not_assessed" } : {}),
    } as EvidenceItem);

  // ---------- 1. Identity ----------
  add({
    id: "ref",
    chapter: "identity",
    label: "Reference supplied",
    value: i.ref || null,
    source: i.sourceLabel || "Not stated",
    method: "As supplied by the user, seller or document reader. Not checked against any registry.",
    usedFor: ["Passport title"],
    cls: "user",
    confidence: "low",
  });
  add({
    id: "coords",
    chapter: "identity",
    label: "Coordinates",
    value: `${i.lat.toFixed(6)}, ${i.lng.toFixed(6)}`,
    source: i.sourceLabel || "Not stated",
    method: `Position class: ${i.positionLabel}. Validated for range, Kenya bounds and known default points.`,
    usedFor: ["Every location-based chapter"],
    cls: i.positionExact ? "measured" : "user",
    confidence:
      i.locationConfidencePct >= 80 ? "high" : i.locationConfidencePct >= 50 ? "medium" : "low",
  });
  add({
    id: "boundary",
    chapter: "identity",
    label: "Parcel boundary & area",
    value: null,
    source: "Survey / cadastral data",
    method: "HALISIA holds no surveyed boundary for this point. Area cannot be stated.",
    usedFor: ["Area, setbacks, buildable envelope"],
    cls: "gap",
    confidence: "not_assessed",
  });

  // ---------- 2. Admin ----------
  add({
    id: "county",
    chapter: "admin",
    label: "County",
    value: i.countyName,
    source: "HALISIA county boundary file (point-in-polygon)",
    method: "Point tested against the 47 county polygons.",
    usedFor: ["County Intelligence link", "County facts", "Local news"],
    cls: "modelled",
    confidence: i.countyName ? "high" : "not_assessed",
  });
  const sub = i.admin?.subCounty ?? i.wave4?.admin?.constituency ?? null;
  add({
    id: "subcounty",
    chapter: "admin",
    label: "Sub-county / constituency",
    value: sub,
    source: i.admin?.subCounty ? "Google reverse geocoding" : "OpenStreetMap Nominatim",
    method: "Reverse geocode of the coordinates.",
    usedFor: ["Location hierarchy"],
    cls: "modelled",
    confidence: "medium",
  });
  add({
    id: "ward",
    chapter: "admin",
    label: "Ward / area",
    value: i.admin?.ward ?? i.wave4?.admin?.ward ?? null,
    source: "Reverse geocoding (Google / OSM)",
    method: "Reverse geocode of the coordinates.",
    usedFor: ["Location hierarchy"],
    cls: "modelled",
    confidence: "medium",
  });
  if (i.facts) {
    const f = i.facts;
    add({
      id: "pop",
      chapter: "admin",
      label: "County population (2019)",
      value: f.population2019.toLocaleString("en-KE"),
      source: "KNBS 2019 Population & Housing Census",
      method: "Published census figure.",
      usedFor: ["Market context"],
      cls: "official",
      confidence: "high",
      retrieved: "2019 census",
    });
    add({
      id: "economy",
      chapter: "admin",
      label: "County economy",
      value: f.economy.join(", "),
      source: "County records (HALISIA reference file)",
      method: "Curated summary of main economic activities.",
      usedFor: ["Market context", "Development concepts"],
      cls: "official",
      confidence: "medium",
      retrieved: null,
    });
  }

  // ---------- 3. Physical ----------
  const el = i.intel?.elevation?.meters;
  add({
    id: "elev",
    chapter: "physical",
    label: "Elevation",
    value: el != null ? `${Math.round(el)} m above sea level` : null,
    source: "Google Elevation API",
    method: `Single-point sample${i.intel?.elevation?.resolution ? `, ~${Math.round(i.intel.elevation.resolution)} m resolution` : ""}.`,
    usedFor: ["Terrain", "Construction notes"],
    cls: "measured",
    confidence: "high",
    note:
      el == null
        ? stateGap(i.intelState, "Elevation")
        : "Elevation alone is not a flood assessment.",
  });
  const g = i.geotech;
  const terrainOk = !!g && (srcUsed(g.sources, "Topo") || srcUsed(g.sources, "Elevation"));
  add({
    id: "slope",
    chapter: "physical",
    label: "Slope & aspect",
    value:
      terrainOk && g?.terrain
        ? `${r(g.terrain.slopePct, 1)}% slope, faces ${g.terrain.aspectLabel}`
        : null,
    source: "OpenTopoData ASTER 30 m grid",
    method: "5×5 elevation grid around the point, finite-difference slope.",
    usedFor: ["Regional terrain context"],
    cls: "modelled",
    confidence: "medium",
    note: terrainOk ? undefined : stateGap(i.geoState, "Terrain grid"),
  });
  add({
    id: "landform",
    chapter: "physical",
    label: "Regional elevation relief",
    value: terrainOk && g?.terrain ? `${r(g.terrain.reliefM)} m elevation range` : null,
    source: "Derived from ASTER 30 m grid",
    method: "Range of returned regional elevation-grid samples; erosion risk is not assessed.",
    usedFor: ["Construction considerations"],
    cls: "ai",
    confidence: "low",
  });
  const top = g?.soilLayers?.[0];
  add({
    id: "soil",
    chapter: "physical",
    label: `Soil model (${top?.depth ?? "depth unavailable"})`,
    value: top
      ? `${top.texture}: clay ${r(top.clayPct)}%, sand ${r(top.sandPct)}%, silt ${r(top.siltPct)}%`
      : null,
    source: "ISRIC SoilGrids v2.0 (250 m model)",
    method: "Global machine-learning soil model sampled at the point. Not a lab test.",
    usedFor: ["Regional soil composition"],
    cls: "modelled",
    confidence: "medium",
    note: top ? undefined : stateGap(i.geoState, "Soil model"),
  });
  const deep = g?.soilLayers?.[g.soilLayers.length - 1];
  if (deep && deep !== top)
    add({
      id: "subsoil",
      chapter: "physical",
      label: `Subsoil (${deep.depth})`,
      value: `${deep.texture}: clay ${r(deep.clayPct)}%, sand ${r(deep.sandPct)}%, silt ${r(deep.siltPct)}%`,
      source: "ISRIC SoilGrids v2.0",
      method: "Deepest complete composition band returned by the regional soil model.",
      usedFor: ["Regional soil composition"],
      cls: "modelled",
      confidence: "medium",
    });

  // ---------- 4. Climate ----------
  const forecast = i.wave4?.weather?.points[0];
  if (forecast?.temperatureC != null)
    add({
      id: "weather",
      chapter: "climate",
      label: "Weather forecast",
      value: `${forecast.temperatureC.toFixed(1)} °C at ${forecast.time}`,
      source: "MET Norway Locationforecast",
      method: "Numerical weather forecast; not an on-site observation.",
      usedFor: ["Short-term planning context"],
      cls: "modelled",
      confidence: "medium",
      retrieved: i.wave4?.weather?.updatedAt ?? t,
    });
  const cl = i.wave4?.climate;
  const rain = cl?.annualRainfallMm ?? g?.groundwater.annualRainMm ?? null;
  add({
    id: "rain",
    chapter: "climate",
    label: "Mean annual rainfall",
    value: rain != null ? `${Math.round(rain)} mm / year` : null,
    source: cl?.source ?? "NASA POWER climatology",
    method:
      "Regional climatology mean daily precipitation converted to an annual mean with 365.25 days.",
    usedFor: ["Groundwater likelihood", "Climate normals for this area"],
    cls: "modelled",
    confidence: "medium",
    note: rain == null ? stateGap(i.w4State, "Climate model") : undefined,
  });
  add({
    id: "temp",
    chapter: "climate",
    label: "Mean temperature",
    value:
      cl?.meanTempC != null
        ? `${r(cl.meanTempC, 1)} °C (range ${r(cl.tempMinC ?? NaN, 1)}–${r(cl.tempMaxC ?? NaN, 1)} °C)`
        : null,
    source: cl?.source ?? "NASA POWER climatology",
    method: `Regional reanalysis mean; displayed range is monthly mean temperatures. ${cl?.period ?? "Provider reference period"}.`,
    usedFor: ["Habitability", "Climate normals for this area"],
    cls: "modelled",
    confidence: "medium",
  });
  const aq = i.intel?.airQuality;
  add({
    id: "aqi",
    chapter: "climate",
    label: "Air quality now",
    value: aq?.category
      ? `${aq.category} (AQI ${aq.universalAqi ?? "—"}${aq.dominant ? `, main pollutant ${aq.dominant}` : ""})`
      : null,
    source: "Google Air Quality API",
    method: "Current-conditions lookup; changes hourly.",
    usedFor: ["Habitability"],
    cls: "measured",
    confidence: "medium",
    note: aq?.category ? undefined : stateGap(i.intelState, "Air quality"),
  });
  add({
    id: "water",
    chapter: "climate",
    label: "Nearest mapped water",
    value:
      g?.groundwater.nearestWaterKm != null ? `${r(g.groundwater.nearestWaterKm, 1)} km` : null,
    // The backing field is never populated, so naming OpenStreetMap here
    // claimed a source for a lookup that does not run.
    source: "No source — this lookup is not implemented",
    method:
      "HALISIA does not currently measure distance to the nearest mapped water feature. This row names no source because none is queried.",
    usedFor: ["Riparian caution", "Groundwater"],
    cls: "modelled",
    confidence: "low",
  });
  add({
    id: "flood",
    chapter: "climate",
    label: "Flood risk",
    value: null,
    source: "Hydrological flood model",
    method:
      "HALISIA does not run a flood model. Elevation and rainfall alone cannot assess flood risk.",
    usedFor: [],
    cls: "gap",
    confidence: "not_assessed",
  });

  // ---------- 5. Access ----------
  const cats = i.intel?.categories;
  const near = (k: keyof NonNullable<typeof cats>, label: string, used: string[]) => {
    const list = cats?.[k] ?? [];
    const p = list[0];
    add({
      id: `acc-${k}`,
      chapter: "access",
      label,
      value: cats
        ? list.length
          ? `${list.length} found · nearest ${p.name}${p.distanceKm != null ? ` (${p.distanceKm.toFixed(1)} km)` : ""}${p.driveMin != null ? `, ~${Math.round(p.driveMin)} min drive` : ""}`
          : "None found in search radius"
        : null,
      source: "Google Places API (New)",
      method:
        "Nearby search around the point; straight-line distance, drive time from Routes where available.",
      usedFor: used,
      cls: "measured",
      confidence: list.length ? "high" : "medium",
      note: cats ? undefined : stateGap(i.intelState, "Places"),
    });
  };
  near("schools", "Schools", ["Habitability", "Residential concepts"]);
  near("hospitals", "Health facilities", ["Habitability"]);
  near("groceries", "Shops & markets", ["Daily needs", "Commercial concepts"]);
  near("transit", "Public transport", ["Accessibility", "Transit-oriented concepts"]);
  near("banks", "Banks", ["Finance access"]);
  const w4f = i.wave4?.facilities;
  if (w4f && srcUsed(i.wave4?.sources, "Overpass")) {
    const n = Object.values(w4f).reduce((a, l) => a + l.length, 0);
    add({
      id: "osm-fac",
      chapter: "access",
      label: "OSM facilities within 3 km",
      value: `${n} mapped (${
        Object.entries(w4f)
          .filter(([, l]) => l.length)
          .map(([k, l]) => `${k} ${l.length}`)
          .join(", ") || "none"
      })`,
      source: "OpenStreetMap Overpass",
      method: "Tag query, 3 km radius. OSM coverage in Kenya is uneven.",
      usedFor: ["What is mapped nearby"],
      cls: "measured",
      confidence: n >= 10 ? "medium" : "low",
      retrieved: i.wave4?.generatedAt ?? t,
    });
  } else {
    add({
      id: "osm-fac",
      chapter: "access",
      label: "OSM facilities within 3 km",
      value: null,
      source: "OpenStreetMap Overpass",
      method: "Tag query, 3 km radius.",
      usedFor: ["What is mapped nearby"],
      cls: "gap",
      confidence: "not_assessed",
      note: stateGap(i.w4State, "OSM"),
    });
  }

  // Regional surface datasets do not establish subsurface conditions or structural design.
  for (const [id, label] of [
    ["foundation", "Foundation suitability"],
    ["groundwater", "Groundwater / waterlogging"],
    ["bedrock", "Bedrock depth"],
    ["bearing", "Bearing capacity"],
    ["erosion", "Erosion risk"],
  ]) {
    add({
      id,
      chapter: "build",
      label,
      value: null,
      source: "No site investigation supplied",
      method: "Not assessed. Requires site-specific investigation by a licensed professional.",
      usedFor: ["Ground investigation planning"],
      cls: "gap",
      confidence: "not_assessed",
      note: "Regional elevation and soil models cannot establish this finding.",
    });
  }
  add({
    id: "zoning",
    chapter: "build",
    label: "Zoning & planning approval",
    value: null,
    source: "County planning department",
    method: "No county planning integration. Development concepts are suggestions, not approvals.",
    usedFor: [],
    cls: "gap",
    confidence: "not_assessed",
  });

  // ---------- 7. Market ----------
  const b = i.wave4?.breakdown;
  /**
   * These rows printed a mark out of 100 — "72/100" — with the arithmetic
   * behind it as the method. The passport is the document a buyer forwards to
   * a lender or an advocate, so it is the worst place in the product for a
   * figure nobody can check. The counts underneath were real and are what the
   * row carries now; the mark is gone, and so is the row's old claim to be a
   * "score". A row whose area is thinly mapped still says so rather than
   * printing a confident number over a thin count.
   */
  const countRow = (k: keyof NonNullable<typeof b>, label: string) => {
    const s = b?.[k];
    const thin = !s || s.confidence === "low";
    // A factor whose reading never arrived is named as absent, never printed
    // as a zero. An empty join collapses to null so the row is classed as a
    // gap rather than carrying an empty string past the gap check.
    const counted =
      s && s.factors.length
        ? s.factors
            .map((f) =>
              f.value == null
                ? `${f.label} not returned`
                : `${f.label} ${Math.round(f.value)} ${f.unit}`,
            )
            .join("; ") || null
        : null;
    add({
      id: `score-${k}`,
      chapter: "market",
      label,
      value: thin ? null : counted,
      source: "OpenStreetMap Overpass and NASA POWER, interpreted by HALISIA",
      method: s
        ? s.method
        : "Needs the OpenStreetMap and climate lookups, which did not return for this point.",
      usedFor: ["What is mapped nearby"],
      cls: "ai",
      confidence: s?.confidence ?? "not_assessed",
      note: thin
        ? s
          ? "Little is mapped here, so the count is withheld. That may mean little is there, or that nobody has mapped it — from a screen those cannot be told apart."
          : stateGap(i.w4State, "Open-data lookup")
        : s.note,
    });
  };
  countRow("accessibility", "Transport and markets mapped nearby");
  countRow("infrastructure", "Services mapped nearby");
  countRow("environment", "Climate normals for this area");
  countRow("development", "Community anchors mapped nearby");
  countRow("investment", "Summary of what is mapped nearby");
  add({
    id: "comps",
    chapter: "market",
    label: "Comparable sales",
    value: null,
    source: "Verified transaction records",
    method: "HALISIA holds no verified sale prices. No price or return forecast is made.",
    usedFor: [],
    cls: "gap",
    confidence: "not_assessed",
  });

  // ---------- 8. Trust ----------
  add({
    id: "title",
    chapter: "trust",
    label: "Official title search",
    value: null,
    source: "Ardhisasa / Ministry of Lands",
    method: "Not connected to HALISIA. Run the search yourself on Ardhisasa.",
    usedFor: [],
    cls: "gap",
    confidence: "not_assessed",
  });
  add({
    id: "owner",
    chapter: "trust",
    label: "Ownership & encumbrances",
    value: null,
    source: "Land registry",
    method: "HALISIA never infers ownership, charges or caveats from location or documents.",
    usedFor: [],
    cls: "gap",
    confidence: "not_assessed",
  });
  add({
    id: "finance",
    chapter: "trust",
    label: "Finance readiness",
    value: "Indicative only — not a loan approval",
    source: "HALISIA interpretation",
    method: "Lenders will need an official search, approved plans and a valuation.",
    usedFor: ["Financing tools"],
    cls: "ai",
    confidence: "low",
  });

  // ---------- Ledger ----------
  const st = (state: FetchState, has: boolean): LedgerStatus =>
    state === "loading" ? "loading" : state === "error" ? "failed" : has ? "ok" : "no_data";
  const ph = i.intel?.providers;
  const phStatus = (p?: { status: string; reason?: string }): LedgerStatus =>
    i.intelState !== "ok"
      ? st(i.intelState, false)
      : !p
        ? "no_data"
        : p.status === "ok"
          ? "ok"
          : p.status === "degraded"
            ? "no_data"
            : "failed";
  const ledger: LedgerEntry[] = [
    {
      id: "met",
      provider: "MET Norway weather forecast",
      status: st(i.w4State, !!i.wave4?.weather?.points.length),
      detail: "Model forecast / CC BY 4.0",
      chapters: ["climate"],
    },
    {
      id: "g-elev",
      provider: "Google Elevation",
      status: phStatus(ph?.elevation),
      detail: ph?.elevation?.reason ?? "",
      chapters: ["physical"],
    },
    {
      id: "g-aq",
      provider: "Google Air Quality",
      status: phStatus(ph?.airQuality),
      detail: ph?.airQuality?.reason ?? "",
      chapters: ["climate"],
    },
    {
      id: "g-places",
      provider: "Google Places (New)",
      status: phStatus(ph?.places),
      detail: ph?.places?.reason ?? "",
      chapters: ["access"],
    },
    {
      id: "g-routes",
      provider: "Google Routes",
      status: phStatus(ph?.routes),
      detail: ph?.routes?.reason ?? "",
      chapters: ["access"],
    },
    {
      id: "soil",
      provider: "ISRIC SoilGrids v2.0",
      status:
        g?.soilStatus === "failed" ? "failed" : st(i.geoState, srcUsed(g?.sources, "SoilGrids")),
      detail: "",
      chapters: ["physical", "build"],
    },
    {
      id: "aster",
      provider: "OpenTopoData ASTER 30 m",
      status: st(i.geoState, terrainOk),
      detail: "",
      chapters: ["physical", "build"],
    },
    {
      id: "om",
      provider: "NASA POWER climatology",
      status: st(
        i.w4State,
        srcUsed(i.wave4?.sources, "NASA POWER") || srcUsed(i.wave4?.sources, "Open-Meteo"),
      ),
      detail: "",
      chapters: ["climate", "market"],
    },
    {
      id: "nom",
      provider: "OSM Nominatim",
      status: st(i.w4State, srcUsed(i.wave4?.sources, "Nominatim")),
      detail: "",
      chapters: ["admin"],
    },
    {
      id: "ovp",
      provider: "OSM Overpass",
      status: st(i.w4State, srcUsed(i.wave4?.sources, "Overpass")),
      detail:
        i.w4State === "ok" && !srcUsed(i.wave4?.sources, "Overpass")
          ? "Busy or rate-limited — facility scores withheld"
          : "",
      chapters: ["access", "market"],
    },
    {
      id: "knbs",
      provider: "KNBS census (reference file)",
      status: i.facts ? "ok" : "no_data",
      detail: "",
      chapters: ["admin"],
    },
    {
      id: "ardhisasa",
      provider: "Ardhisasa land registry",
      status: "not_connected",
      detail: "No integration",
      chapters: ["trust"],
    },
    {
      id: "planning",
      provider: "County planning / zoning",
      status: "not_connected",
      detail: "No integration",
      chapters: ["build"],
    },
  ];

  const available = items.filter((x) => x.value != null).length;
  return {
    items,
    ledger,
    summary: {
      total: items.length,
      available,
      missing: items.length - available,
      coveragePct: Math.round((available / items.length) * 100),
    },
  };
}

/** Compact, citation-keyed text of the evidence for the AI summary prompt. */
export function evidenceDigest(items: EvidenceItem[]): string {
  return items
    .map(
      (x) =>
        `[${x.id}] ${x.label}: ${x.value ?? "NOT AVAILABLE"} | source: ${x.source} | class: ${x.cls} | confidence: ${x.confidence}`,
    )
    .join("\n")
    .slice(0, 12_000);
}

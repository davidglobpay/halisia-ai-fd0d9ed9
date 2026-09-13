/**
 * Evidence & citations for AI outputs.
 *
 * Every AI narrative on HALISIA must be traceable: which signal was used, how
 * strong it is, and where the underlying dataset lives. This module turns the
 * inputs behind the Development Concept AI and the Investment Readiness
 * assessment into an auditable list of signals plus dataset citations.
 */
import type { PropertyRow } from "@/lib/properties";
import type { ConceptOutput } from "@/lib/development-studio";
import type { ReadinessResult } from "@/lib/investment-readiness";

export type Confidence = "high" | "medium" | "low";

export type EvidenceSignal = {
  key: string;
  label: string;
  value: string;
  used: string;
  confidence: Confidence;
  sourceKey: string;
};

export type Citation = {
  key: string;
  label: string;
  url: string;
  detail: string;
};

export type EvidenceBundle = {
  signals: EvidenceSignal[];
  citations: Citation[];
  overall: Confidence;
  overallPct: number;
  wording: string;
};

export const CITATIONS: Record<string, Citation> = {
  listing: {
    key: "listing",
    label: "Owner-declared listing data",
    url: "https://halisia-ai.lovable.app/marketplace",
    detail: "Fields captured by the owner in the HALISIA listing wizard.",
  },
  osm: {
    key: "osm",
    label: "OpenStreetMap (Overpass API)",
    url: "https://www.openstreetmap.org/copyright",
    detail: "Roads, amenities and points of interest around the site pin.",
  },
  soilgrids: {
    key: "soilgrids",
    label: "ISRIC SoilGrids v2.0",
    url: "https://soilgrids.org",
    detail: "Global 250m soil property predictions used for geotechnical context.",
  },
  openmeteo: {
    key: "openmeteo",
    label: "Open-Meteo climate & elevation",
    url: "https://open-meteo.com",
    detail: "Rainfall, temperature normals and terrain elevation samples.",
  },
  knbs: {
    key: "knbs",
    label: "Kenya National Bureau of Statistics",
    url: "https://www.knbs.or.ke",
    detail: "Census, population and county socio-economic indicators.",
  },
  county: {
    key: "county",
    label: "County planning office (to confirm)",
    url: "https://www.cog.go.ke/counties",
    detail: "Zoning, plot ratio and approvals — not yet machine-readable, confirm directly.",
  },
  platform: {
    key: "platform",
    label: "HALISIA platform activity",
    url: "https://halisia-ai.lovable.app/dashboard",
    detail: "Views, saved items, leads, proposals and financing records on this account.",
  },
};

function conf(score: number): Confidence {
  return score >= 70 ? "high" : score >= 40 ? "medium" : "low";
}

export function confidenceWording(c: Confidence): string {
  return c === "high"
    ? "Dense evidence — several independent signals agree."
    : c === "medium"
      ? "Workable evidence — enough to plan with, gaps remain."
      : "Limited evidence — treat the output as a prompt for further checks.";
}

function bundle(signals: EvidenceSignal[]): EvidenceBundle {
  const weight = { high: 100, medium: 55, low: 15 } as const;
  const pct = signals.length
    ? Math.round(signals.reduce((s, x) => s + weight[x.confidence], 0) / signals.length)
    : 0;
  const overall = conf(pct);
  const keys = new Set(signals.map((s) => s.sourceKey));
  return {
    signals,
    citations: [...keys].map((k) => CITATIONS[k]).filter(Boolean) as Citation[],
    overall,
    overallPct: pct,
    wording: confidenceWording(overall),
  };
}

/** Signals behind a generated development concept. */
export function conceptEvidence(p: PropertyRow, concept: ConceptOutput | null): EvidenceBundle {
  const hasPin = p.latitude != null && p.longitude != null;
  const size = p.size_value != null;
  const utilities = (p.utilities ?? []).length;
  const amenities = (p.amenities ?? []).length;

  const signals: EvidenceSignal[] = [
    {
      key: "pin",
      label: "Site coordinates",
      value: hasPin ? `${p.latitude!.toFixed(5)}, ${p.longitude!.toFixed(5)}` : "Not set",
      used: "Anchors terrain, climate and nearby-amenity lookups for the site read.",
      confidence: hasPin ? "high" : "low",
      sourceKey: hasPin ? "osm" : "listing",
    },
    {
      key: "size",
      label: "Site area",
      value: size ? `${p.size_value} ${p.size_unit ?? ""}`.trim() : "Not stated",
      used: "Drives capacity, unit counts and phasing in every option.",
      confidence: size ? "high" : "low",
      sourceKey: "listing",
    },
    {
      key: "utilities",
      label: "Utilities on site",
      value: utilities ? (p.utilities ?? []).join(", ") : "None recorded",
      used: "Determines servicing cost assumptions and Phase 1 scope.",
      confidence: utilities >= 2 ? "high" : utilities ? "medium" : "low",
      sourceKey: "listing",
    },
    {
      key: "amenities",
      label: "Nearby amenities",
      value: amenities ? (p.amenities ?? []).join(", ") : "None recorded",
      used: "Informs demand read for rental vs sale vs mixed-use options.",
      confidence: amenities >= 3 ? "high" : amenities ? "medium" : "low",
      sourceKey: amenities ? "osm" : "listing",
    },
    {
      key: "location",
      label: "County & address",
      value: [p.address, p.county].filter(Boolean).join(", ") || "Not stated",
      used: "Selects county cost/revenue bands and socio-economic context.",
      confidence: p.county ? (p.address ? "high" : "medium") : "low",
      sourceKey: "knbs",
    },
    {
      key: "price",
      label: "Asking price",
      value:
        p.price != null ? `${p.currency} ${Number(p.price).toLocaleString("en-KE")}` : "Not stated",
      used: "Sets the land basis in payback and revenue bands.",
      confidence: p.price != null ? "medium" : "low",
      sourceKey: "listing",
    },
    {
      key: "zoning",
      label: "Zoning & plot ratio",
      value: "Not machine-verifiable",
      used: "Every option lists this as a risk to confirm rather than a fact.",
      confidence: "low",
      sourceKey: "county",
    },
    {
      key: "model",
      label: "Concept generation",
      value: concept
        ? concept.source === "ai"
          ? "AI model output"
          : "Deterministic fallback"
        : "Not generated",
      used: "Options, massing and phasing narratives.",
      confidence: concept?.source === "ai" ? "medium" : "low",
      sourceKey: "platform",
    },
  ];
  return bundle(signals);
}

/** Signals behind the investment-readiness assessment. */
export function readinessEvidence(r: ReadinessResult): EvidenceBundle {
  const sourceFor = (key: string) =>
    key === "location"
      ? "osm"
      : key === "market"
        ? "platform"
        : key === "feasibility"
          ? "openmeteo"
          : key === "documentation"
            ? "listing"
            : key === "concept"
              ? "platform"
              : key === "financial"
                ? "platform"
                : "platform";
  const signals: EvidenceSignal[] = r.factors.map((f) => ({
    key: f.key,
    label: f.label,
    value: `${f.score}% (weight ${f.weight}%)`,
    used: f.evidence,
    confidence: conf(f.score),
    sourceKey: sourceFor(f.key),
  }));
  signals.push({
    key: "soil",
    label: "Geotechnical context",
    value: "SoilGrids-derived profile where a pin exists",
    used: "Foundation and construction-risk commentary supporting the feasibility factor.",
    confidence: "medium",
    sourceKey: "soilgrids",
  });
  return bundle(signals);
}

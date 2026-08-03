/**
 * Shared types + deterministic fallback for the Land Development & Project
 * Concept AI. Kept out of the server-function module so the function file stays
 * a thin wrapper (server-fn splitting removes runtime siblings).
 */
export type ConceptInput = {
  title: string;
  county?: string | null;
  address?: string | null;
  kind: string;
  size_value?: number | null;
  size_unit?: string | null;
  price?: number | null;
  currency?: string | null;
  utilities?: string[];
  amenities?: string[];
  access_type?: string | null;
  slopeHint?: string | null;
  goal?: string | null; // e.g. "rental income", "resale", "own use"
  budget?: number | null;
  clarifications?: string[];
};

export type ConceptOption = {
  name: string;
  useType: string;
  rationale: string;
  massing: string;
  unitMix: string;
  estimatedUnits: number;
  phasing: string[];
  capexBandKes: string;
  revenueBandKes: string;
  paybackYears: string;
  risks: string[];
  confidencePct: number;
};

export type ConceptOutput = {
  summary: string;
  siteRead: string[];
  options: ConceptOption[];
  nextSteps: string[];
  assumptions: string[];
  generatedAt: string;
  source: "ai" | "fallback";
};

export const CONCEPT_DISCLAIMER =
  "Concept-stage guidance only. Not architectural, planning, engineering or investment advice — confirm zoning, plot ratio and approvals with the county government and a registered professional.";

export function conceptFallback(d: ConceptInput): ConceptOutput {
  const acres = d.size_unit?.toLowerCase().startsWith("acre")
    ? (d.size_value ?? 0)
    : (d.size_value ?? 0) / 4046.86;
  const where = d.address ?? d.county ?? "Kenya";
  const dense = acres > 0 && acres <= 0.5;
  const units = Math.max(1, Math.round(acres * (dense ? 16 : 8)));

  const mk = (
    name: string,
    useType: string,
    rationale: string,
    unitMix: string,
    est: number,
    capex: string,
    revenue: string,
    payback: string,
    conf: number,
  ): ConceptOption => ({
    name,
    useType,
    rationale,
    massing: dense
      ? "Ground + 3 walk-up floors around a central court"
      : "Low-rise clusters with shared access spine",
    unitMix,
    estimatedUnits: est,
    phasing: [
      "Phase 1: access, perimeter, services",
      "Phase 2: first block + show unit",
      "Phase 3: remaining blocks and landscaping",
    ],
    capexBandKes: capex,
    revenueBandKes: revenue,
    paybackYears: payback,
    risks: [
      "Plot ratio and zoning not yet confirmed with the county.",
      d.access_type
        ? `Access is ${d.access_type} — check construction haulage.`
        : "Road access undocumented.",
      (d.utilities ?? []).length
        ? "Utility capacity may need upgrading."
        : "No utilities recorded on site.",
    ],
    confidencePct: conf,
  });

  return {
    summary: `Concept-stage read of ${d.title} in ${where}${acres ? ` (~${acres.toFixed(2)} acres)` : ""}. Three directions are outlined below with indicative capacity and cost bands for discussion with a registered professional.`,
    siteRead: [
      `Location: ${where}${d.county ? ` · ${d.county} County` : ""}.`,
      acres
        ? `Site area approximately ${acres.toFixed(2)} acres.`
        : "Site area not stated — capacity figures are illustrative only.",
      d.access_type ? `Access: ${d.access_type}.` : "Access type not recorded.",
      (d.utilities ?? []).length
        ? `Utilities noted: ${(d.utilities ?? []).join(", ")}.`
        : "No utilities recorded on site.",
      d.slopeHint
        ? `Terrain: ${d.slopeHint}.`
        : "Terrain not assessed — commission a topographic survey.",
    ],
    options: [
      mk(
        "Rental income cluster",
        "Residential rental",
        "Steady monthly yield with phased delivery to fund later blocks.",
        dense ? "Studios and 1-bed" : "2-bed and 3-bed units",
        units,
        "KES 6M–9M per unit",
        "KES 25k–55k rent per unit / month",
        "8–12",
        55,
      ),
      mk(
        "Sale-led development",
        "Residential for sale",
        "Faster capital recovery where local demand favours ownership.",
        "3-bed maisonettes",
        Math.max(1, Math.round(units * 0.6)),
        "KES 7M–11M per unit",
        "KES 9M–15M per unit sale",
        "3–5",
        50,
      ),
      mk(
        "Mixed use frontage",
        "Ground-floor retail + upper residential",
        "Suits plots on a busy road frontage; retail underwrites the residential.",
        "Retail bays + 1/2-bed above",
        Math.max(2, Math.round(units * 0.8)),
        "KES 8M–12M per unit",
        "Retail KES 40k–120k / bay / month",
        "7–10",
        45,
      ),
    ],
    nextSteps: [
      "Confirm zoning, plot ratio and ground coverage with the county planning office.",
      "Commission a topographic and geotechnical survey.",
      "Appoint an architect and quantity surveyor for a costed scheme.",
      "Test demand with local letting or selling agents before committing.",
    ],
    assumptions: [
      "Capacity derived from site area and typical Kenyan low-rise densities, not an approved scheme.",
      "Cost and revenue bands are broad market ranges, not quotations.",
      CONCEPT_DISCLAIMER,
    ],
    generatedAt: new Date().toISOString(),
    source: "fallback",
  };
}

export function conceptPrompt(d: ConceptInput): string {
  return `You are HALISIA AI, a Kenyan land development concept analyst.
Return STRICT JSON only (no code fences) matching:
{"summary":string,"siteRead":string[],"options":[{"name":string,"useType":string,"rationale":string,"massing":string,"unitMix":string,"estimatedUnits":number,"phasing":string[],"capexBandKes":string,"revenueBandKes":string,"paybackYears":string,"risks":string[],"confidencePct":number}],"nextSteps":string[],"assumptions":string[]}

SITE:
- Listing: ${d.title} (${d.kind})
- Location: ${d.address ?? "—"}${d.county ? ", " + d.county + " County" : ""}
- Size: ${d.size_value ?? "—"} ${d.size_unit ?? ""}
- Asking price: ${d.price ?? "—"} ${d.currency ?? "KES"}
- Access: ${d.access_type ?? "—"}
- Utilities: ${(d.utilities ?? []).join(", ") || "—"}
- Amenities nearby: ${(d.amenities ?? []).join(", ") || "—"}
- Terrain: ${d.slopeHint ?? "—"}
- Owner goal: ${d.goal ?? "not stated"} | Budget: ${d.budget ?? "not stated"}
${d.clarifications?.length ? `- Owner clarifications:\n${d.clarifications.map((c) => "  · " + c).join("\n")}` : ""}

RULES:
- Exactly 3 options, materially different from each other.
- Ground capacity in the stated site area; if size is unknown, say so and keep numbers illustrative.
- Kenyan cost/revenue bands in KES, expressed as ranges, never single figures.
- Never claim zoning, plot ratio or approval status as fact; list them as things to confirm.
- confidencePct reflects how much real site data was supplied.
- assumptions MUST include: "${CONCEPT_DISCLAIMER}"
- JSON must parse.`;
}

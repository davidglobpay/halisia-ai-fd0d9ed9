import { createServerFn } from "@tanstack/react-start";

export type NarrativeInput = {
  address: string;
  lat: number;
  lng: number;
  elevationM?: number | null;
  airQuality?: { aqi: number | null; category: string | null; dominant: string | null } | null;
  counts: {
    schools: number;
    hospitals: number;
    groceries: number;
    transit: number;
    restaurants: number;
    banks: number;
  };
};

export type NarrativeOutput = {
  ok: true;
  headline: string;
  livability: number;
  confidence: "Low" | "Medium" | "High";
  confidencePct: number;
  lastUpdated: string;
  paragraphs: string[];
  overview: string;
  keyFindings: string[];
  strengths: { point: string; why: string }[];
  weaknesses: { point: string; why: string }[];
  recommendations: string[];
  constructionAdvice: string[];
  investmentAdvice: string[];
  familySuitability: { score: number; note: string };
  businessSuitability: { score: number; note: string };
  environmentalNotes: string[];
  futureOutlook: string;
  watchouts: string[];
  nextSteps: string[];
  dataSources: string[];
};

/**
 * Evidence-bound summary: no model may invent parcel, utility or return claims.
 * Legacy score fields remain amenity-only heuristics, not calibrated suitability.
 */
export function evidenceSummary(input: NarrativeInput): NarrativeOutput {
  const c = input.counts;
  const count = (n: number) => Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const schools=count(c.schools), hospitals=count(c.hospitals), groceries=count(c.groceries);
  const transit=count(c.transit), restaurants=count(c.restaurants), banks=count(c.banks);
  const elevation = input.elevationM != null && Number.isFinite(input.elevationM);
  const air = input.airQuality?.aqi != null && Number.isFinite(input.airQuality.aqi);
  const coverage = Math.round((1 + Number(elevation) + Number(air)) / 3 * 100);
  const caveat = "Counts are provider search results within approximately 3 km. Zero results do not establish absence; coverage and operating status require field checks.";
  const amenityScore=Math.min(95,40+(schools+hospitals+groceries+transit)*4);
  const scoreNote="Unvalidated amenity-count indicator only; not a verified suitability, safety or investment score.";
  const observed = [
    `${schools} schools, ${hospitals} health facilities and ${groceries} groceries returned by the map provider.`,
    `${transit} transit stops, ${restaurants} restaurants and ${banks} banks returned by the map provider.`,
    elevation ? `Elevation reading: ${input.elevationM!.toFixed(0)} m. Height alone cannot establish slope, drainage, flood risk or foundation conditions.` : "Elevation reading unavailable.",
    air ? `Provider air-quality index: ${input.airQuality!.aqi}; category: ${input.airQuality!.category ?? "not supplied"}. This is a time-dependent location reading, not a long-term exposure assessment.` : "Air-quality reading unavailable."
  ];
  return {
    ok:true, headline: `${input.address} — evidence and next checks`,
    livability:amenityScore, confidence:coverage === 100 ? "High" : coverage >= 67 ? "Medium" : "Low",
    confidencePct:coverage, lastUpdated:new Date().toISOString(),
    paragraphs:[observed.slice(0,2).join(" "), caveat],
    overview:`Preliminary location context for ${input.address}. Data coverage is ${coverage}% across amenity, elevation and air-quality inputs; it is not a calibrated accuracy probability. ${scoreNote}`,
    keyFindings:observed,
    strengths:[{point:"Traceable location context",why:"The summary reports only supplied readings and provider counts; each still needs source and freshness checks."}],
    weaknesses:[{point:"Parcel evidence missing",why:"These inputs contain no title, boundary survey, soil test, utility confirmation, zoning approval or verified transaction comparables."},{point:"Map coverage is incomplete",why:caveat}],
    recommendations:["Confirm the pin against the actual parcel and a licensed survey.","Obtain an official title search through the relevant registry or Ardhisasa where available.","Verify permitted use, access and utilities with the responsible authorities and on site."],
    constructionAdvice:["A qualified professional should specify geotechnical investigation and foundation design.","Obtain site drainage and flood assessment; elevation alone cannot answer either.","Confirm county planning requirements before commissioning a build."],
    investmentAdvice:["Collect dated comparable transactions and separate asking prices from achieved sales.","Verify title, planning status, access and servicing costs before deciding.","Prepare a cost and exit scenario; no appreciation or return forecast can be inferred from these inputs."],
    familySuitability:{score:Math.min(95,45+(schools+hospitals)*5),note:scoreNote},
    businessSuitability:{score:Math.min(95,40+(banks+transit)*4),note:scoreNote+" Foot traffic and demand have not been measured."},
    environmentalNotes:[observed[2],observed[3],"Flood, soil, water availability and drainage remain unassessed."],
    futureOutlook:"No future price or infrastructure forecast is supported by the supplied inputs. Check dated county plans, funded projects and verified market evidence separately.",
    watchouts:[caveat,"No ownership, legality, safety, buildability or utility availability is verified.","Coverage percentages and amenity scores are heuristics, not audited confidence measures."],
    nextSteps:["Field-check mapped facilities and journey times.","Ask qualified professionals to resolve title, boundaries and planning.","Record documents, sources and dates in the parcel evidence ledger."],
    dataSources:["Google Places: returned amenity counts","Google Elevation: location height when available","Google Air Quality: provider reading when available"]
  };
}

export const generateNarrative = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as NarrativeInput)
  .handler(async ({ data }): Promise<NarrativeOutput> => evidenceSummary(data));

/**
 * County profile.
 *
 * This module used to produce eleven "dashboard scores" plus an overall score
 * for every county, all of them from a trigonometric hash of the county code.
 * Those numbers then chose which written claims appeared about a real place —
 * a county with a low generated healthcare number was told it had "uneven
 * healthcare access outside major towns", and the executive summary said
 * "HALISIA AI scores it N/100 overall". None of it was measured.
 *
 * All of it is gone. What remains is the published record: the KNBS 2019
 * census figures, the gazetted area, the IEBC constituency and ward counts,
 * the elected governor and senator, the county's principal economic
 * activities and its landmarks. That is a thinner profile, and it is true.
 *
 * Rule for anything added here: a field may only exist if a reader can follow
 * a source to it. No composite indices, no derived narrative, no "AI summary"
 * that asserts a judgement the data does not carry.
 */

import { KENYA_COUNTY_FACTS, type CountyFacts } from "@/lib/kenya-county-facts";
import { countyMetrics, confidence, type CountyMetric } from "@/lib/county-metrics";

export type CountyProfile = {
  facts: CountyFacts;
  latLng: { lat: number; lng: number };
  /** People per km², from the census. Null when the county has no figure. */
  density: number | null;
  metrics: ReturnType<typeof countyMetrics>;
  metricConfidence: Record<CountyMetric, "low" | "med" | "high">;
  /** One sentence of plain record — no scores, no judgements, no forecast. */
  summary: string;
};

export function buildCountyProfile(
  code: number,
  latLng: { lat: number; lng: number },
): CountyProfile | null {
  const facts = KENYA_COUNTY_FACTS[code];
  if (!facts) return null;

  const metrics = countyMetrics(code);
  const density =
    facts.areaKm2 > 0 ? Math.round(facts.population2019 / facts.areaKm2) : null;

  // Region is omitted when it merely repeats the county's own name, as it does
  // for Nairobi and Mombasa. Economic activities keep their published casing
  // so proper nouns survive — "ICT/BPO", "Lake Turkana".
  const where =
    facts.region === facts.name
      ? `${facts.name} County is headquartered at ${facts.headquarters}.`
      : `${facts.name} County is headquartered at ${facts.headquarters} in the ${facts.region} region.`;

  const summary =
    `${where} ` +
    `It covers ${facts.areaKm2.toLocaleString()} km² and recorded ` +
    `${facts.population2019.toLocaleString()} residents at the 2019 census` +
    (density != null ? `, or about ${density.toLocaleString()} people per km²` : "") +
    `. It returns ${facts.constituencies} constituencies and ${facts.wards} wards. ` +
    `Its recorded economic activities are ${facts.economy.join(", ")}.`;

  return {
    facts,
    latLng,
    density,
    metrics,
    metricConfidence: { population: confidence(code, "population") },
    summary,
  };
}

/**
 * The sources behind everything on a county page. Each one is actually used:
 * KNBS for the population and area, IEBC for the constituency, ward and
 * turnout figures and the elected leadership, OpenStreetMap for the basemap.
 *
 * Nothing else belongs in this list. It previously cited WASREB, the Council
 * of Governors, KenInvest, the Kenya Meteorological Department and the Kenya
 * Tourism Board, none of whose data appeared anywhere in the product.
 */
export const COUNTY_DATA_SOURCES = [
  {
    label: "KNBS — 2019 Kenya Population & Housing Census",
    url: "https://www.knbs.or.ke/",
    used: "Population and county area, and the density derived from them.",
  },
  {
    label: "IEBC — constituency and ward register, 2022 results",
    url: "https://www.iebc.or.ke/",
    used: "Constituency and ward counts, elected governor and senator, 2022 turnout.",
  },
  {
    label: "OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/relation/192798",
    used: "County boundaries and the basemap shown on this page.",
  },
];

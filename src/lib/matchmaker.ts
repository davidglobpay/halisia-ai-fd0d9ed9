/**
 * Deterministic natural-language → search criteria parser for the
 * Property Matchmaker. No AI call: transparent, cheap and repeatable.
 */
import type { PropertyKind, PropertyRow, ListingIntent } from "./properties";

export type MatchCriteria = {
  kind: PropertyKind | null;
  intent: ListingIntent | null;
  county: string | null;
  maxPrice: number | null;
  minAcres: number | null;
  wants: string[];
};

const COUNTIES = [
  "Nairobi",
  "Kiambu",
  "Machakos",
  "Kajiado",
  "Nakuru",
  "Mombasa",
  "Kisumu",
  "Uasin Gishu",
  "Kilifi",
  "Kwale",
  "Murang'a",
  "Nyeri",
  "Meru",
  "Embu",
  "Kirinyaga",
  "Laikipia",
  "Nyandarua",
  "Narok",
  "Kericho",
  "Bomet",
  "Kakamega",
  "Bungoma",
  "Busia",
  "Vihiga",
  "Siaya",
  "Homa Bay",
  "Migori",
  "Kisii",
  "Nyamira",
  "Trans Nzoia",
  "Nandi",
  "Baringo",
  "Elgeyo-Marakwet",
  "West Pokot",
  "Turkana",
  "Samburu",
  "Isiolo",
  "Marsabit",
  "Mandera",
  "Wajir",
  "Garissa",
  "Tana River",
  "Lamu",
  "Taita-Taveta",
  "Makueni",
  "Kitui",
  "Tharaka-Nithi",
];

const KIND_WORDS: [RegExp, PropertyKind][] = [
  [/\b(plot|land|acre|shamba)s?\b/i, "land"],
  [/\bapartment|flat\b/i, "apartment"],
  [/\bhouse|home|bungalow|maisonette\b/i, "house"],
  [/\bcommercial|office|shop\b/i, "commercial"],
  [/\bfarm|agricultur/i, "agricultural"],
];

const WANTS: [RegExp, string][] = [
  [/school/i, "schools nearby"],
  [/road|access|tarmac/i, "good road access"],
  [/commut|near nairobi|within .* of nairobi/i, "commuting distance to Nairobi"],
  [/hospital|clinic/i, "healthcare nearby"],
  [/water/i, "water supply"],
  [/residential/i, "residential use"],
];

function parseMoney(t: string): number | null {
  const m = t.match(
    /(?:ksh|kes|under|below|budget|max|up to)?\s*([\d.,]+)\s*(m|million|k|thousand)?\b/i,
  );
  const all = [...t.matchAll(/([\d.,]+)\s*(m|million|k|thousand)\b/gi)];
  const hit = all[0] ?? (m && /ksh|kes|under|below|budget/i.test(t) ? m : null);
  if (!hit) return null;
  const n = parseFloat(hit[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const u = (hit[2] ?? "").toLowerCase();
  return u.startsWith("m") ? n * 1_000_000 : u.startsWith("k") || u === "thousand" ? n * 1000 : n;
}

export function parseRequest(text: string): MatchCriteria {
  const t = text.trim();
  const county =
    COUNTIES.find((c) => new RegExp(`\\b${c.replace(/[-']/g, ".")}\\b`, "i").test(t)) ?? null;
  const kind = KIND_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
  const intent: ListingIntent | null = /\brent|to let\b/i.test(t)
    ? "rent"
    : /\blease\b/i.test(t)
      ? "lease"
      : /\bbuy|purchase|sale\b/i.test(t)
        ? "sale"
        : null;
  const acres = t.match(/([\d.]+)\s*acres?/i);
  let maxPrice = parseMoney(t.replace(/[\d.]+\s*acres?/gi, ""));
  if (!maxPrice && /moderate budget|affordable|cheap/i.test(t)) maxPrice = null;
  return {
    kind,
    intent,
    county,
    maxPrice,
    minAcres: acres ? parseFloat(acres[1]) : null,
    wants: WANTS.filter(([re]) => re.test(t)).map(([, w]) => w),
  };
}

export type MatchExplanation = {
  row: PropertyRow;
  matched: string[];
  unmet: string[];
  score: number;
};

const NEAR_NAIROBI = new Set(["Nairobi", "Kiambu", "Machakos", "Kajiado", "Murang'a"]);

export function explainMatches(rows: PropertyRow[], c: MatchCriteria): MatchExplanation[] {
  return rows
    .map((row) => {
      const matched: string[] = [];
      const unmet: string[] = [];
      if (c.kind) (row.kind === c.kind ? matched : unmet).push(`Type: ${c.kind}`);
      if (c.county) (row.county === c.county ? matched : unmet).push(`County: ${c.county}`);
      if (c.maxPrice != null) {
        if (row.price == null) unmet.push("Price not stated");
        else (Number(row.price) <= c.maxPrice ? matched : unmet).push("Within budget");
      }
      if (c.wants.includes("commuting distance to Nairobi")) {
        (row.county && NEAR_NAIROBI.has(row.county) ? matched : unmet).push(
          "Nairobi metro county (commute time not measured)",
        );
      }
      const score = matched.length - unmet.length * 0.5;
      return { row, matched, unmet, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function unassessedWants(c: MatchCriteria): string[] {
  return c.wants.filter((w) => w !== "commuting distance to Nairobi" && w !== "residential use");
}

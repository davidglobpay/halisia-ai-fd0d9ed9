import type { PropertyRow, PropertyKind, ListingIntent } from "@/lib/properties";

/**
 * Marketplace-side derivations for HALISIA listings.
 *
 * Everything here is computed from the existing `properties` row shape — no
 * schema changes — so the marketplace can expose categories, verification,
 * completeness, trending and AI recommendations without new backend surface.
 */

export type MarketplaceCategory =
  | "land"
  | "residential"
  | "apartments"
  | "houses"
  | "commercial"
  | "industrial"
  | "agricultural"
  | "rental_homes"
  | "rental_apartments"
  | "commercial_rentals"
  | "short_stay"
  | "investment"
  | "development";

export const CATEGORIES: { value: MarketplaceCategory; label: string }[] = [
  { value: "land", label: "Land" },
  { value: "residential", label: "Residential property" },
  { value: "apartments", label: "Apartments" },
  { value: "houses", label: "Houses" },
  { value: "commercial", label: "Commercial property" },
  { value: "industrial", label: "Industrial property" },
  { value: "agricultural", label: "Agricultural land" },
  { value: "rental_homes", label: "Rental homes" },
  { value: "rental_apartments", label: "Rental apartments" },
  { value: "commercial_rentals", label: "Commercial rentals" },
  { value: "short_stay", label: "Short-stay accommodation" },
  { value: "investment", label: "Investment opportunities" },
  { value: "development", label: "Development opportunities" },
];

export const MARKET_ACTIONS = [
  { value: "buy", label: "Buy", intents: ["sale"] as ListingIntent[] },
  { value: "sell", label: "Sell", intents: [] as ListingIntent[] },
  { value: "rent", label: "Rent", intents: ["rent"] as ListingIntent[] },
  { value: "lease", label: "Lease", intents: ["lease"] as ListingIntent[] },
  { value: "invest", label: "Invest", intents: [] as ListingIntent[] },
  { value: "develop", label: "Develop", intents: [] as ListingIntent[] },
  { value: "connect", label: "Connect", intents: [] as ListingIntent[] },
] as const;

export type MarketAction = (typeof MARKET_ACTIONS)[number]["value"];

function scoreObj(row: PropertyRow): Record<string, unknown> {
  return row.ai_score && typeof row.ai_score === "object"
    ? (row.ai_score as Record<string, unknown>)
    : {};
}

function numField(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Overall Land Intelligence Score (0-100) when the engine has run. */
export function intelligenceScore(row: PropertyRow): number | null {
  return numField(scoreObj(row).overall);
}

export function investmentScore(row: PropertyRow): number | null {
  const s = scoreObj(row);
  return numField(s.investment) ?? numField(s.investment_potential) ?? intelligenceScore(row);
}

export function developmentScore(row: PropertyRow): number | null {
  const s = scoreObj(row);
  return numField(s.construction) ?? numField(s.development) ?? intelligenceScore(row);
}

export function environmentScore(row: PropertyRow): number | null {
  const s = scoreObj(row);
  return numField(s.environment) ?? numField(s.environmental) ?? null;
}

/** Percentage of the marketplace-critical fields the seller has supplied. */
export function completeness(row: PropertyRow): number {
  const checks: boolean[] = [
    Boolean(row.title),
    Boolean(row.description && row.description.length > 40),
    row.price != null,
    row.size_value != null,
    Boolean(row.county),
    Boolean(row.address),
    row.latitude != null && row.longitude != null,
    (row.amenities?.length ?? 0) > 0,
    (row.utilities?.length ?? 0) > 0,
    Boolean(row.cover_image),
    Boolean(row.ai_summary),
    Boolean(row.ai_score),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export type VerificationStatus = "verified" | "reviewed" | "unverified";

export function verification(row: PropertyRow): VerificationStatus {
  const c = completeness(row);
  const hasGeo = row.latitude != null && row.longitude != null;
  if (c >= 85 && hasGeo && row.ai_score) return "verified";
  if (c >= 60 && hasGeo) return "reviewed";
  return "unverified";
}

export function isNew(row: PropertyRow, days = 14): boolean {
  return Date.now() - new Date(row.created_at).getTime() < days * 86_400_000;
}

/** Views normalised by listing age — a simple, explainable trend signal. */
export function trendingScore(row: PropertyRow): number {
  const ageDays = Math.max(1, (Date.now() - new Date(row.created_at).getTime()) / 86_400_000);
  return (row.view_count ?? 0) / Math.sqrt(ageDays);
}

const RENTAL_INTENTS: ListingIntent[] = ["rent", "lease"];

export function categoriesOf(row: PropertyRow): MarketplaceCategory[] {
  const out: MarketplaceCategory[] = [];
  const rental = RENTAL_INTENTS.includes(row.intent);
  const kind = row.kind as PropertyKind;

  if (kind === "land") out.push("land");
  if (kind === "agricultural") out.push("agricultural", "land");
  if (kind === "house") out.push(rental ? "rental_homes" : "houses", "residential");
  if (kind === "apartment") out.push(rental ? "rental_apartments" : "apartments", "residential");
  if (kind === "rental") out.push("rental_homes", "residential");
  if (kind === "commercial") out.push(rental ? "commercial_rentals" : "commercial");
  if (kind === "industrial") out.push("industrial");
  if (kind === "mixed_use") out.push("development", "commercial");

  const amen = (row.amenities ?? []).map((a) => a.toLowerCase());
  if (amen.some((a) => a.includes("short stay") || a.includes("airbnb") || a.includes("furnished")))
    out.push("short_stay");

  const inv = investmentScore(row);
  if (inv != null && inv >= 70) out.push("investment");
  const dev = developmentScore(row);
  if (
    (dev != null && dev >= 70 && (kind === "land" || kind === "agricultural")) ||
    kind === "mixed_use"
  )
    out.push("development");

  return Array.from(new Set(out));
}

export type MarketplaceFilters = {
  q?: string;
  category?: MarketplaceCategory | "all";
  action?: MarketAction | "all";
  intent?: ListingIntent | "all";
  county?: string;
  town?: string;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  roadAccess?: boolean;
  verified?: boolean;
  minScore?: number;
  minInvestment?: number;
  minDevelopment?: number;
  minEnvironment?: number;
};

const ROAD_HINTS = ["road", "tarmac", "murram", "access", "highway", "motorable"];

function hasRoadAccess(row: PropertyRow): boolean {
  const hay = [...(row.amenities ?? []), ...(row.utilities ?? []), row.description ?? ""]
    .join(" ")
    .toLowerCase();
  return ROAD_HINTS.some((h) => hay.includes(h));
}

export function applyFilters(rows: PropertyRow[], f: MarketplaceFilters): PropertyRow[] {
  const q = f.q?.trim().toLowerCase();
  const town = f.town?.trim().toLowerCase();
  return rows.filter((r) => {
    if (q) {
      const hay =
        `${r.title} ${r.description ?? ""} ${r.county ?? ""} ${r.address ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (town && !`${r.address ?? ""} ${r.county ?? ""}`.toLowerCase().includes(town)) return false;
    if (f.county && r.county !== f.county) return false;
    if (f.intent && f.intent !== "all" && r.intent !== f.intent) return false;
    if (f.category && f.category !== "all" && !categoriesOf(r).includes(f.category)) return false;
    if (f.action && f.action !== "all") {
      const spec = MARKET_ACTIONS.find((a) => a.value === f.action);
      if (spec && spec.intents.length && !spec.intents.includes(r.intent)) return false;
      if (f.action === "invest" && !categoriesOf(r).includes("investment")) return false;
      if (f.action === "develop" && !categoriesOf(r).includes("development")) return false;
    }
    if (f.minPrice != null && (r.price == null || Number(r.price) < f.minPrice)) return false;
    if (f.maxPrice != null && (r.price == null || Number(r.price) > f.maxPrice)) return false;
    if (f.minSize != null && (r.size_value == null || Number(r.size_value) < f.minSize))
      return false;
    if (f.maxSize != null && (r.size_value == null || Number(r.size_value) > f.maxSize))
      return false;
    if (f.bedrooms != null && (r.bedrooms ?? 0) < f.bedrooms) return false;
    if (f.bathrooms != null && (r.bathrooms ?? 0) < f.bathrooms) return false;
    if (f.amenities?.length) {
      const set = (r.amenities ?? []).map((a) => a.toLowerCase());
      if (!f.amenities.every((a) => set.includes(a.toLowerCase()))) return false;
    }
    if (f.roadAccess && !hasRoadAccess(r)) return false;
    if (f.verified && verification(r) !== "verified") return false;
    if (f.minScore != null && (intelligenceScore(r) ?? 0) < f.minScore) return false;
    if (f.minInvestment != null && (investmentScore(r) ?? 0) < f.minInvestment) return false;
    if (f.minDevelopment != null && (developmentScore(r) ?? 0) < f.minDevelopment) return false;
    if (f.minEnvironment != null && (environmentScore(r) ?? 0) < f.minEnvironment) return false;
    return true;
  });
}

export type RecommendationPrefs = {
  county?: string;
  budget?: number;
  intent?: ListingIntent | "all";
  bedrooms?: number;
};

export type Recommendation = { row: PropertyRow; score: number; reasons: string[] };

/**
 * Transparent, consent-based recommender: every point of the score comes with
 * a human-readable reason so the UI can answer "Why am I seeing this?".
 */
export function recommend(
  rows: PropertyRow[],
  prefs: RecommendationPrefs,
  limit = 6,
): Recommendation[] {
  return rows
    .map((row) => {
      const reasons: string[] = [];
      let score = 0;
      const lios = intelligenceScore(row);
      if (lios != null) {
        score += lios * 0.4;
        reasons.push(`Land Intelligence Score ${Math.round(lios)}/100`);
      }
      if (prefs.county && row.county === prefs.county) {
        score += 25;
        reasons.push(`In your preferred county (${prefs.county})`);
      }
      if (prefs.intent && prefs.intent !== "all" && row.intent === prefs.intent) {
        score += 12;
        reasons.push(`Matches your ${row.intent} goal`);
      }
      if (prefs.budget && row.price != null) {
        const p = Number(row.price);
        if (p <= prefs.budget) {
          score += 20;
          reasons.push("Within your budget");
        } else if (p <= prefs.budget * 1.15) {
          score += 8;
          reasons.push("Slightly above your budget");
        }
      }
      if (prefs.bedrooms && (row.bedrooms ?? 0) >= prefs.bedrooms) {
        score += 8;
        reasons.push(`${row.bedrooms} bedrooms meets your minimum`);
      }
      if (verification(row) === "verified") {
        score += 10;
        reasons.push("Verified listing with complete data");
      }
      if (isNew(row)) {
        score += 6;
        reasons.push("Newly listed");
      }
      const c = completeness(row);
      score += c * 0.1;
      reasons.push(`${c}% data completeness`);
      return { row, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const RAILS = [
  { value: "recommended", label: "AI recommendations" },
  { value: "new", label: "New listings" },
  { value: "trending", label: "Trending" },
  { value: "verified", label: "Verified" },
  { value: "investment", label: "Investment" },
  { value: "rentals", label: "Rental vacancies" },
  { value: "developments", label: "Featured developments" },
] as const;

export type Rail = (typeof RAILS)[number]["value"];

export function railFilter(rows: PropertyRow[], rail: Rail): PropertyRow[] {
  switch (rail) {
    case "new":
      return rows.filter((r) => isNew(r));
    case "trending":
      return [...rows].sort((a, b) => trendingScore(b) - trendingScore(a));
    case "verified":
      return rows.filter((r) => verification(r) === "verified");
    case "investment":
      return rows.filter((r) => categoriesOf(r).includes("investment"));
    case "rentals":
      return rows.filter((r) => RENTAL_INTENTS.includes(r.intent));
    case "developments":
      return rows.filter((r) => r.featured || categoriesOf(r).includes("development"));
    default:
      return rows;
  }
}

/**
 * HALISIA Pulse — classification and AI enrichment.
 *
 * Two layers, in this order:
 *   1. Deterministic: county / place detection and keyword category scoring.
 *      Always runs, costs nothing, and gives every article a usable baseline.
 *   2. AI: summary, "why it matters" and sector impact analysis via the
 *      Lovable AI gateway. Fails soft — the deterministic layer stands alone.
 */
import counties from "@/data/kenya-counties.json";
import type { PulseGeoLevel } from "./types";
import type { RawArticle } from "./providers.server";

type CountyFeature = { properties: { code: number; name: string; lat: number; lng: number } };

const COUNTIES = (counties as { features: CountyFeature[] }).features.map((f) => f.properties);

/** Well-known towns / estates that should resolve to a county. */
const PLACES: Array<{ label: string; county: string; level: PulseGeoLevel }> = [
  { label: "Westlands", county: "Nairobi", level: "neighbourhood" },
  { label: "Karen", county: "Nairobi", level: "neighbourhood" },
  { label: "Kilimani", county: "Nairobi", level: "neighbourhood" },
  { label: "Ruaka", county: "Kiambu", level: "town" },
  { label: "Thika", county: "Kiambu", level: "town" },
  { label: "Juja", county: "Kiambu", level: "town" },
  { label: "Ruiru", county: "Kiambu", level: "town" },
  { label: "Limuru", county: "Kiambu", level: "town" },
  { label: "Kitengela", county: "Kajiado", level: "town" },
  { label: "Ngong", county: "Kajiado", level: "town" },
  { label: "Ongata Rongai", county: "Kajiado", level: "town" },
  { label: "Athi River", county: "Machakos", level: "town" },
  { label: "Mlolongo", county: "Machakos", level: "town" },
  { label: "Naivasha", county: "Nakuru", level: "town" },
  { label: "Gilgil", county: "Nakuru", level: "town" },
  { label: "Nyali", county: "Mombasa", level: "neighbourhood" },
  { label: "Diani", county: "Kwale", level: "town" },
  { label: "Watamu", county: "Kilifi", level: "town" },
  { label: "Malindi", county: "Kilifi", level: "town" },
  { label: "Eldoret", county: "Uasin Gishu", level: "town" },
  { label: "Kisumu City", county: "Kisumu", level: "town" },
  { label: "Nakuru City", county: "Nakuru", level: "town" },
  { label: "Konza", county: "Machakos", level: "town" },
  { label: "Tatu City", county: "Kiambu", level: "town" },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  politics: ["parliament", "senate", "governor", "mp ", "president", "ruto", "cabinet", "bill"],
  infrastructure: ["infrastructure", "bypass", "bridge", "sewer", "pipeline", "railway", "sgr"],
  roads: ["road", "highway", "expressway", "kenha", "kura", "tarmac", "dualling"],
  transport: ["matatu", "bus", "brt", "commuter rail", "airport", "port", "transport"],
  housing: ["housing", "affordable homes", "estate", "apartments", "levy", "tenant"],
  land: ["land", "title deed", "parcel", "adjudication", "survey", "ardhisasa", "acre"],
  property: ["property", "real estate", "rent", "developer", "valuation", "mortgage"],
  environment: ["environment", "nema", "forest", "pollution", "conservation", "wetland"],
  climate: ["climate", "rainfall", "drought", "el nino", "la nina", "weather", "met department"],
  flooding: ["flood", "flooding", "burst banks", "displaced", "dam", "riparian"],
  agriculture: ["farmer", "maize", "tea", "coffee", "irrigation", "agriculture", "livestock"],
  business: ["business", "economy", "shilling", "inflation", "market", "company", "profit"],
  technology: ["technology", "startup", "digital", "fintech", "ai ", "innovation", "broadband"],
  health: ["hospital", "health", "sha ", "nhif", "clinic", "disease"],
  education: ["school", "university", "students", "education", "cbc", "tvet"],
  security: ["police", "security", "crime", "insecurity", "bandits"],
  investment: ["investment", "investor", "fund", "capital", "ipo", "bond", "fdi"],
  energy: ["energy", "power", "kplc", "solar", "geothermal", "electricity", "fuel"],
  utilities: ["water", "sanitation", "utility", "supply", "borehole"],
  tourism: ["tourism", "tourist", "hotel", "safari", "park", "beach"],
  "county-government": ["county government", "county assembly", "ward", "mca", "devolution"],
};

export type Classification = {
  category: string;
  tags: string[];
  county: string | null;
  geoLevel: PulseGeoLevel;
  placeLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  confidence: number;
};

/** Deterministic keyword + gazetteer classification. Never throws. */
export function classify(article: RawArticle): Classification {
  const text = `${article.title} ${article.excerpt ?? ""}`.toLowerCase();

  // Category scoring.
  let best =
    article.categoryHint && CATEGORY_KEYWORDS[article.categoryHint]
      ? article.categoryHint
      : "business";
  let bestScore = article.categoryHint ? 1 : 0;
  const tags = new Set<string>();
  for (const [slug, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = words.reduce((n, w) => (text.includes(w) ? n + 1 : n), 0);
    if (score > 0) tags.add(slug);
    if (score > bestScore) {
      best = slug;
      bestScore = score;
    }
  }

  // Place detection: specific places win over bare county names.
  let county: string | null = null;
  let placeLabel: string | null = null;
  let geoLevel: PulseGeoLevel = "national";
  for (const p of PLACES) {
    if (text.includes(p.label.toLowerCase())) {
      county = p.county;
      placeLabel = p.label;
      geoLevel = p.level;
      break;
    }
  }
  if (!county) {
    for (const c of COUNTIES) {
      if (text.includes(c.name.toLowerCase())) {
        county = c.name;
        placeLabel = c.name;
        geoLevel = "county";
        break;
      }
    }
  }
  const centroid = county ? COUNTIES.find((c) => c.name === county) : undefined;

  const confidence = Math.max(
    25,
    Math.min(
      92,
      30 +
        bestScore * 8 +
        (county ? 15 : 0) +
        (geoLevel !== "county" && geoLevel !== "national" ? 8 : 0) +
        (article.excerpt ? 10 : 0) +
        (article.publishedAt ? 5 : 0),
    ),
  );

  return {
    category: best,
    tags: [...tags].slice(0, 8),
    county,
    geoLevel,
    placeLabel,
    latitude: centroid?.lat ?? null,
    longitude: centroid?.lng ?? null,
    confidence,
  };
}

export type AiEnrichment = {
  summary: string;
  whyItMatters: string;
  propertyImpact: string | null;
  landImpact: string | null;
  infrastructureImpact: string | null;
  investmentImpact: string | null;
  environmentalImpact: string | null;
  category: string | null;
  tags: string[];
  county: string | null;
  importance: number;
};

const SYSTEM = `You are HALISIA Pulse, a Kenyan land & property intelligence analyst.
You read a news headline and excerpt and explain, in plain professional English,
what it means for land, property, infrastructure, investment and the environment in Kenya.
Never invent facts that are not implied by the text. If a sector is not affected, return null for it.
Return STRICT JSON only.`;

/**
 * Enrich a batch of articles with one AI call each (bounded concurrency by the
 * caller). Returns null when the gateway is unavailable or the reply is unusable.
 */
export async function enrichWithAi(
  article: RawArticle,
  base: Classification,
): Promise<AiEnrichment | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;

  const prompt = `HEADLINE: ${article.title}
SOURCE: ${article.sourceName ?? "unknown"}
EXCERPT: ${(article.excerpt ?? "").slice(0, 1200) || "(no excerpt available)"}
DETECTED COUNTY: ${base.county ?? "unknown"}

Return JSON with exactly these keys:
{
  "summary": "2-3 sentence neutral summary",
  "why_it_matters": "1-2 sentences on why a Kenyan land or property decision-maker should care",
  "property_impact": "string or null",
  "land_impact": "string or null",
  "infrastructure_impact": "string or null",
  "investment_impact": "string or null",
  "environmental_impact": "string or null",
  "category": "one of: ${Object.keys(CATEGORY_KEYWORDS).join(", ")}",
  "tags": ["max 6 short lowercase tags"],
  "county": "Kenyan county name or null",
  "importance": 0-100
}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
      summary: str(parsed["summary"]) ?? article.excerpt?.slice(0, 300) ?? article.title,
      whyItMatters: str(parsed["why_it_matters"]) ?? "",
      propertyImpact: str(parsed["property_impact"]),
      landImpact: str(parsed["land_impact"]),
      infrastructureImpact: str(parsed["infrastructure_impact"]),
      investmentImpact: str(parsed["investment_impact"]),
      environmentalImpact: str(parsed["environmental_impact"]),
      category: str(parsed["category"]),
      tags: Array.isArray(parsed["tags"])
        ? (parsed["tags"] as unknown[])
            .filter((t): t is string => typeof t === "string")
            .slice(0, 6)
        : [],
      county: str(parsed["county"]),
      importance: typeof parsed["importance"] === "number" ? parsed["importance"] : 50,
    };
  } catch {
    return null;
  }
}

/** Kenyan county names, exported for filters and validation. */
export const COUNTY_NAMES = COUNTIES.map((c) => c.name).sort();

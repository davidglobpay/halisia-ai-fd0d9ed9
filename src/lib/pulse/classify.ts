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

export const COUNTIES = (counties as { features: CountyFeature[] }).features.map(
  (f) => f.properties,
);

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

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  politics: ["parliament", "senate", "governor", "mp ", "president", "ruto", "cabinet", "bill"],
  infrastructure: [
    "infrastructure",
    "bypass",
    "bridge",
    "sewer",
    "pipeline",
    "railway",
    "sgr",
    "industrial park",
    "refinery",
  ],
  roads: ["road", "highway", "expressway", "kenha", "kura", "tarmac", "dualling"],
  transport: ["matatu", "bus", "brt", "commuter rail", "airport", "port", "transport"],
  housing: ["housing", "affordable homes", "estate", "apartment", "levy", "tenant"],
  land: [
    "land",
    "title deed",
    "parcel",
    "adjudication",
    "survey",
    "ardhisasa",
    "acre",
    "mining",
    "mineral",
    "quarry",
  ],
  property: ["property", "real estate", "rent", "developer", "valuation", "mortgage"],
  environment: [
    "environment",
    "nema",
    "forest",
    "pollution",
    "conservation",
    "wetland",
    "mazingira",
  ],
  climate: [
    "climate",
    "rain",
    "rainfall",
    "drought",
    "el nino",
    "la nina",
    "weather",
    "met department",
  ],
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

/**
 * Categories that are themselves about land, place or the built environment.
 * A hit in one of these is evidence on its own. A hit anywhere else ("market",
 * "school", "police") describes most news published anywhere on earth, so it
 * only counts when a Kenyan place was also detected.
 */
const CORE_CATEGORIES = new Set([
  "land",
  "property",
  "housing",
  "roads",
  "infrastructure",
  "environment",
  "flooding",
  "county-government",
]);

/**
 * Terms that place a story in Kenya without naming a county. A headline can be
 * unmistakably Kenyan with no placename in it — "Ardhisasa rollout stalls as
 * Lands ministry clears title deed backlog" is one — so institutions, statutes
 * and currency carry the anchor where a gazetteer lookup cannot. Dropping this
 * list costs exactly that headline in the test corpus, which is why it exists.
 */
const KENYA_TERMS =
  /\b(?:ardhisasa|kenha|kura|nema|matatu|shilling|kplc|nhif|mca|devolution|county assembly|county government|title deed|huduma|safaricom|ruto|national land commission|sacco|shamba|ksh|kes)\b/i;

const escapeRx = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Keywords were matched with String.includes(). That is why the feed carried
 * foreign news: "Poland" and "Thailand" matched `land`, "massacre" matched
 * `acre`, "Adam" matched `dam`, "imports" matched `port`, "business" matched
 * `bus`, and "team"/"instead" matched `tea`. Nine of eleven sampled foreign
 * wire headlines were classified as Kenyan land intelligence.
 *
 * Word boundaries fix that. An optional plural is kept because headlines are
 * written "roads", "farmers", "investors". `-ing` is deliberately NOT allowed:
 * it is what let `land` match "landing". The three keywords that carried a
 * trailing space as a hand-rolled boundary ("mp ", "ai ", "sha ") have it
 * removed here, because \b now does that job properly.
 */
const KEYWORD_PATTERNS: Record<string, RegExp[]> = Object.fromEntries(
  Object.entries(CATEGORY_KEYWORDS).map(([slug, words]) => [
    slug,
    words.map((w) => new RegExp(`\\b${escapeRx(w.trim())}(?:s|es)?\\b`, "i")),
  ]),
);

export type Classification = {
  category: string;
  tags: string[];
  county: string | null;
  geoLevel: PulseGeoLevel;
  placeLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  confidence: number;
  /**
   * False when nothing tied this article to Kenyan land, property or place.
   * The caller must act on it AND report the count — a filter that silently
   * discards stories is its own kind of dishonesty.
   */
  relevant: boolean;
};

/** Deterministic keyword + gazetteer classification. Never throws. */
export function classify(article: RawArticle): Classification {
  const text = `${article.title} ${article.excerpt ?? ""}`
    .toLowerCase()
    .replace(/\bland\s+rover\b/g, "vehicle");

  // Category scoring.
  let best =
    article.categoryHint && CATEGORY_KEYWORDS[article.categoryHint]
      ? article.categoryHint
      : "business";
  let bestScore = article.categoryHint ? 1 : 0;
  const tags = new Set<string>();
  let coreHits = 0;
  let topicHits = 0;
  for (const [slug, patterns] of Object.entries(KEYWORD_PATTERNS)) {
    const score = patterns.reduce((n, rx) => (rx.test(text) ? n + 1 : n), 0);
    if (score > 0) {
      tags.add(slug);
      if (
        ["transport", "agriculture", "climate", "investment", "energy", "utilities"].includes(slug)
      )
        topicHits += score;
      if (CORE_CATEGORIES.has(slug)) coreHits += score;
    }
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
    if (new RegExp(`\\b${escapeRx(p.label)}\\b`, "i").test(text)) {
      county = p.county;
      placeLabel = p.label;
      geoLevel = p.level;
      break;
    }
  }
  if (!county) {
    for (const c of COUNTIES) {
      if (new RegExp(`\\b${escapeRx(c.name)}\\b`, "i").test(text)) {
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
    // A land/place category firing is evidence by itself. Anything else needs
    // a Kenyan place beside it. Matching nothing is not a "business" story —
    // it is a story we have no reason to publish.
    // A core category firing is a strong topical signal, but it is not a
    // Kenyan one: "Forest fires rage across southern California" fired
    // `environment`, and "Bridge collapses in Genoa" fired `infrastructure`.
    // Nine of twelve foreign probe headlines were admitted this way. So the
    // Kenyan anchor is now required of every article, not only of the ones
    // that missed a core category.
    relevant:
      (county !== null || /\bkenyan?s?\b/i.test(text) || KENYA_TERMS.test(text)) &&
      (coreHits > 0 || topicHits > 0),
  };
}

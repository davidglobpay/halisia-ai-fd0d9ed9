/**
 * Which county stories belong in a Land Passport.
 *
 * The Passport used to take the six most recent stories tagged to the county.
 * On the Usenge export of 22 Oct 2026 that produced, in order: two national
 * political stories, a memorial service, a politician's visit — and, last,
 * "Govt Banks On Usenge Pier Project to Boost Lake Victoria Trade and
 * Transport". A government pier at the exact place being bought was the most
 * consequential fact in twenty pages, and recency buried it under a funeral.
 *
 * Recency is a tie-break, not a ranking. What a buyer needs first is the
 * story that changes what the land is worth or what can be done with it.
 *
 * Scoring is deliberately shallow and inspectable. It does not try to
 * understand the story; it weighs the signals already attached to it. Every
 * score is returned alongside the article so a reader can see why something
 * ranked where it did, and so this file can be argued with.
 */

export type RankableArticle = {
  title: string;
  source_name: string | null;
  published_at: string | null;
  url: string | null;
  category: string | null;
};

export type RankedArticle<T extends RankableArticle = RankableArticle> = T & {
  /** Higher ranks first. Composed of the three signals below. */
  relevanceScore: number;
};

/**
 * Categories that are about land, place or the built environment. These are
 * the same CORE set the Pulse classifier uses, so the two agree by
 * construction rather than by coincidence.
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
 * Categories that change what a place is worth without being about land
 * directly: a new road, a power line, a water scheme, an investment.
 */
const ADJACENT_CATEGORIES = new Set([
  "transport",
  "energy",
  "utilities",
  "agriculture",
  "investment",
]);

/**
 * Words that mark a story as being about something being built, allocated or
 * fought over on the ground. Matched on word boundaries: "port" must not fire
 * on "important", which is the substring bug that put foreign wire copy in
 * this feed in the first place.
 */
const GROUND_TERMS =
  /\b(?:project|projects|construction|build|builds|built|road|roads|highway|bypass|pier|port|jetty|dam|dams|bridge|railway|rail|market|markets|land|plot|plots|title|titles|deed|deeds|housing|estate|settlement|water|sewer|electricity|power|grid|airport|zoning|survey|compensation|evict|eviction|acquisition|allocation|tender|county assembly|master plan|masterplan)\b/i;

const CATEGORY_WEIGHT = 2;
const GROUND_TERM_WEIGHT = 2;
/** Naming the town or estate. */
const PLACE_WEIGHT = 2;
/**
 * Naming the county only. Deliberately lower: every story in this feed is
 * already tagged to the county, so the county name is nearly free. Scoring it
 * equally let a regional round-up outrank a project at the actual place.
 */
const COUNTY_WEIGHT = 1;

function categoryScore(category: string | null): number {
  if (!category) return 0;
  const c = category.toLowerCase();
  if (CORE_CATEGORIES.has(c)) return CATEGORY_WEIGHT * 1.5;
  if (ADJACENT_CATEGORIES.has(c)) return CATEGORY_WEIGHT;
  return 0;
}

/**
 * Build the place terms for a location. The county alone is too broad to be
 * useful — every story in the feed is already tagged to it — so the town or
 * estate is what carries the signal.
 */
export function placeTerms(...parts: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const token of part.split(/[^A-Za-z']+/)) {
      const t = token.trim();
      // Two-letter fragments match far too much to be evidence of anything.
      if (t.length >= 3) out.add(t.toLowerCase());
    }
  }
  return [...out];
}

function mentions(title: string, terms: string[]): boolean {
  if (!terms.length) return false;
  const lower = title.toLowerCase();
  return terms.some((t) =>
    new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower),
  );
}

export function scoreArticle(
  article: RankableArticle,
  terms: string[] = [],
  countyTerms: string[] = [],
): number {
  const title = article.title ?? "";
  return (
    categoryScore(article.category) +
    (GROUND_TERMS.test(title) ? GROUND_TERM_WEIGHT : 0) +
    (mentions(title, terms) ? PLACE_WEIGHT : 0) +
    (mentions(title, countyTerms) ? COUNTY_WEIGHT : 0)
  );
}

/**
 * Rank, then cut. Stories that score nothing are still eligible: a thin feed
 * should show what it has rather than an empty page, and the Passport already
 * labels the whole section as county-level and unverified.
 */
export function rankCountyNews<T extends RankableArticle>(
  articles: T[],
  options: { limit?: number; terms?: string[]; countyTerms?: string[] } = {},
): Array<RankedArticle<T>> {
  const limit = options.limit ?? 6;
  const terms = options.terms ?? [];
  const countyTerms = options.countyTerms ?? [];

  return articles
    .map((a) => ({ ...a, relevanceScore: scoreArticle(a, terms, countyTerms) }))
    .sort((x, z) => {
      if (z.relevanceScore !== x.relevanceScore) return z.relevanceScore - x.relevanceScore;
      // Recency decides only between stories of equal standing.
      const tx = x.published_at ? Date.parse(x.published_at) : 0;
      const tz = z.published_at ? Date.parse(z.published_at) : 0;
      return (Number.isFinite(tz) ? tz : 0) - (Number.isFinite(tx) ? tx : 0);
    })
    .slice(0, limit);
}

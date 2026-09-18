/**
 * HALISIA Pulse — browser data layer.
 * Public news reads go through the anon-readable Data API; saves are
 * user-scoped by RLS.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  PulseArticle,
  PulseGeoLevel,
  PulseIngestionLog,
  PulseProvider,
  PulseProviderHealth,
} from "./pulse/types";

export * from "./pulse/types";

const ARTICLE_COLUMNS =
  "id, provider, url, title, author, source_name, source_logo_url, image_url, raw_excerpt, summary, why_it_matters, property_impact, land_impact, infrastructure_impact, investment_impact, environmental_impact, category, tags, county, geo_level, place_label, latitude, longitude, confidence, view_count, save_count, share_count, published_at, ingested_at";

type Row = Record<string, unknown>;

/**
 * Pulse only carries stories that bear on land decisions. Everything else in
 * the archive — politics, sport, health, general business — stays out of the
 * feed even though it is still stored.
 */
export const TOPIC_CATEGORIES = [
  "land",
  "property",
  "housing",
  "infrastructure",
  "roads",
  "transport",
  "utilities",
  "energy",
  "agriculture",
  "environment",
  "climate",
  "flooding",
  "investment",
] as const;

/**
 * Mining and natural-resource stories have no category of their own in the
 * archive, so they are matched on the headline instead.
 */
const TOPIC_KEYWORDS = ["mining", "mineral", "quarry", "geothermal", "titanium", "gemstone"];

const TOPIC_FILTER = [
  `category.in.(${TOPIC_CATEGORIES.join(",")})`,
  "tags.cs.{land}",
  ...TOPIC_KEYWORDS.map((k) => `title.ilike.*${k}*`),
].join(",");

/** True when an article belongs in Pulse; used where filtering happens client-side. */
export function isTopicArticle(a: Pick<PulseArticle, "category" | "tags" | "title">): boolean {
  if ((TOPIC_CATEGORIES as readonly string[]).includes(a.category)) return true;
  if (a.tags?.includes("land")) return true;
  const t = a.title.toLowerCase();
  return TOPIC_KEYWORDS.some((k) => t.includes(k));
}

function toArticle(r: Row): PulseArticle {
  return {
    id: String(r["id"]),
    provider: r["provider"] as PulseProvider,
    url: String(r["url"]),
    title: String(r["title"]),
    author: (r["author"] as string) ?? null,
    sourceName: (r["source_name"] as string) ?? null,
    sourceLogoUrl: (r["source_logo_url"] as string) ?? null,
    imageUrl: (r["image_url"] as string) ?? null,
    rawExcerpt: (r["raw_excerpt"] as string) ?? null,
    summary: (r["summary"] as string) ?? null,
    whyItMatters: (r["why_it_matters"] as string) ?? null,
    propertyImpact: (r["property_impact"] as string) ?? null,
    landImpact: (r["land_impact"] as string) ?? null,
    infrastructureImpact: (r["infrastructure_impact"] as string) ?? null,
    investmentImpact: (r["investment_impact"] as string) ?? null,
    environmentalImpact: (r["environmental_impact"] as string) ?? null,
    category: String(r["category"] ?? "business"),
    tags: (r["tags"] as string[]) ?? [],
    county: (r["county"] as string) ?? null,
    geoLevel: (r["geo_level"] as PulseGeoLevel) ?? "national",
    placeLabel: (r["place_label"] as string) ?? null,
    latitude: (r["latitude"] as number) ?? null,
    longitude: (r["longitude"] as number) ?? null,
    confidence: Number(r["confidence"] ?? 50),
    viewCount: Number(r["view_count"] ?? 0),
    saveCount: Number(r["save_count"] ?? 0),
    shareCount: Number(r["share_count"] ?? 0),
    publishedAt: (r["published_at"] as string) ?? null,
    ingestedAt: String(r["ingested_at"] ?? new Date().toISOString()),
  };
}

export type FeedFilters = {
  search?: string;
  county?: string | null;
  category?: string | null;
  tag?: string | null;
  timeframe?: "today" | "week" | "month" | "all";
  sort?: "latest" | "trending";
  limit?: number;
  offset?: number;
};

function sinceFor(timeframe: FeedFilters["timeframe"]): string | null {
  const days =
    timeframe === "today" ? 1 : timeframe === "week" ? 7 : timeframe === "month" ? 30 : 0;
  return days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
}

export async function fetchFeed(filters: FeedFilters = {}): Promise<PulseArticle[]> {
  const limit = filters.limit ?? 24;
  const offset = filters.offset ?? 0;

  if (filters.sort === "trending") {
    const { data, error } = await supabase
      .from("trending_scores")
      .select(`score, news_articles!inner(${ARTICLE_COLUMNS})`)
      .order("score", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const mapped: PulseArticle[] = [];
    for (const row of data ?? []) {
      const a = (row as Row)["news_articles"] as Row | null;
      if (a) mapped.push({ ...toArticle(a), trendingScore: Number((row as Row)["score"] ?? 0) });
    }
    return mapped
      .filter(isTopicArticle)
      .filter((a) => (filters.county ? a.county === filters.county : true))
      .filter((a) => (filters.category ? a.category === filters.category : true));
  }

  let q = supabase
    .from("news_articles")
    .select(ARTICLE_COLUMNS)
    .eq("archived", false)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  q = q.or(TOPIC_FILTER);
  if (filters.county) q = q.eq("county", filters.county);
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.tag) q = q.contains("tags", [filters.tag]);
  const since = sinceFor(filters.timeframe);
  if (since) q = q.gte("published_at", since);
  if (filters.search?.trim()) {
    const s = filters.search.trim().replace(/[%,]/g, " ");
    q = q.or(`title.ilike.%${s}%,summary.ilike.%${s}%,raw_excerpt.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => toArticle(r as Row));
}

export async function fetchArticle(id: string): Promise<PulseArticle | null> {
  const { data, error } = await supabase
    .from("news_articles")
    .select(ARTICLE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toArticle(data as Row) : null;
}

export async function fetchRelated(article: PulseArticle, limit = 4): Promise<PulseArticle[]> {
  let q = supabase
    .from("news_articles")
    .select(ARTICLE_COLUMNS)
    .eq("archived", false)
    .neq("id", article.id)
    .or(TOPIC_FILTER)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (article.county) q = q.eq("county", article.county);
  else q = q.eq("category", article.category);
  const { data } = await q;
  return (data ?? []).map((r) => toArticle(r as Row));
}

export async function fetchCountyCounts(): Promise<Array<{ county: string; count: number }>> {
  const { data } = await supabase
    .from("news_articles")
    .select("county")
    .eq("archived", false)
    .or(TOPIC_FILTER)
    .not("county", "is", null)
    .limit(1000);
  const tally = new Map<string, number>();
  for (const r of (data ?? []) as Row[]) {
    const c = r["county"] as string;
    tally.set(c, (tally.get(c) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([county, count]) => ({ county, count }))
    .sort((a, b) => b.count - a.count);
}

/* ---------------- saved articles ---------------- */

export async function listSavedArticles(userId: string): Promise<PulseArticle[]> {
  const { data, error } = await supabase
    .from("saved_articles")
    .select(`created_at, news_articles!inner(${ARTICLE_COLUMNS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row) => (row as Row)["news_articles"] as Row | null)
    .filter((a): a is Row => !!a)
    .map(toArticle);
}

export async function listSavedIds(userId: string): Promise<string[]> {
  const { data } = await supabase.from("saved_articles").select("article_id").eq("user_id", userId);
  return (data ?? []).map((r) => String((r as Row)["article_id"]));
}

export async function saveArticle(userId: string, articleId: string) {
  const { error } = await supabase
    .from("saved_articles")
    .insert({ user_id: userId, article_id: articleId });
  if (error && error.code !== "23505") throw error;
}

export async function unsaveArticle(userId: string, articleId: string) {
  const { error } = await supabase
    .from("saved_articles")
    .delete()
    .eq("user_id", userId)
    .eq("article_id", articleId);
  if (error) throw error;
}

/* ---------------- admin ---------------- */

export async function fetchProviderHealth(): Promise<PulseProviderHealth[]> {
  const { data } = await supabase.from("news_provider_health").select("*");
  return ((data ?? []) as Row[]).map((r) => ({
    provider: r["provider"] as PulseProvider,
    status: r["status"] as PulseProviderHealth["status"],
    lastOkAt: (r["last_ok_at"] as string) ?? null,
    lastErrorAt: (r["last_error_at"] as string) ?? null,
    lastError: (r["last_error"] as string) ?? null,
    latencyMs: (r["latency_ms"] as number) ?? null,
    requestsToday: Number(r["requests_today"] ?? 0),
    quotaNote: (r["quota_note"] as string) ?? null,
  }));
}

export async function fetchIngestionLogs(limit = 25): Promise<PulseIngestionLog[]> {
  const { data } = await supabase
    .from("news_ingestion_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map((r) => ({
    id: String(r["id"]),
    provider: r["provider"] as PulseProvider,
    startedAt: String(r["started_at"]),
    finishedAt: (r["finished_at"] as string) ?? null,
    fetchedCount: Number(r["fetched_count"] ?? 0),
    insertedCount: Number(r["inserted_count"] ?? 0),
    duplicateCount: Number(r["duplicate_count"] ?? 0),
    failedCount: Number(r["failed_count"] ?? 0),
    ok: Boolean(r["ok"]),
    errorMessage: (r["error_message"] as string) ?? null,
  }));
}

/* ---------------- audio (browser speech synthesis) ---------------- */

export function speakArticle(article: PulseArticle): (() => void) | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const script = [
    article.title,
    article.summary ?? article.rawExcerpt ?? "",
    article.whyItMatters ? `Why it matters. ${article.whyItMatters}` : "",
  ]
    .filter(Boolean)
    .join(". ");
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(script);
  utter.rate = 1;
  utter.lang = "en-KE";
  window.speechSynthesis.speak(utter);
  return () => window.speechSynthesis.cancel();
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "recently";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" });
}
/* ---------------- admin metrics ---------------- */

export type PulseStats = {
  totalArticles: number;
  activeArticles: number;
  archivedArticles: number;
  last24h: number;
  withAi: number;
  sources: number;
  lastRefreshAt: string | null;
  inserted7d: number;
  duplicates7d: number;
  failed7d: number;
  fetched7d: number;
};

export async function fetchPulseStats(): Promise<PulseStats> {
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const head = () => supabase.from("news_articles").select("id", { count: "exact", head: true });
  const [totalRes, sourcesRes, archivedRes, last24Res, aiRes] = await Promise.all([
    head(),
    supabase.from("news_sources").select("id", { count: "exact", head: true }),
    head().eq("archived", true),
    head().gte("ingested_at", since24),
    head().not("why_it_matters", "is", null),
  ]);
  const total = totalRes.count ?? 0;
  const sources = sourcesRes.count ?? 0;
  const archived = archivedRes.count ?? 0;
  const last24h = last24Res.count ?? 0;
  const withAi = aiRes.count ?? 0;

  const { data: logs } = await supabase
    .from("news_ingestion_logs")
    .select("started_at, fetched_count, inserted_count, duplicate_count, failed_count")
    .gte("started_at", since7)
    .order("started_at", { ascending: false })
    .limit(500);

  const rows = (logs ?? []) as Array<Record<string, unknown>>;
  const sum = (k: string) => rows.reduce((n, r) => n + Number(r[k] ?? 0), 0);

  return {
    totalArticles: total,
    activeArticles: total - archived,
    archivedArticles: archived,
    last24h,
    withAi,
    sources,
    lastRefreshAt: rows[0] ? String(rows[0]["started_at"]) : null,
    fetched7d: sum("fetched_count"),
    inserted7d: sum("inserted_count"),
    duplicates7d: sum("duplicate_count"),
    failed7d: sum("failed_count"),
  };
}

export type PulseSourceRow = {
  id: string;
  name: string;
  slug: string;
  provider: PulseProvider;
  status: string;
  feedUrl: string | null;
  county: string | null;
  refreshMinutes: number;
  lastFetchedAt: string | null;
};

export async function fetchPulseSources(): Promise<PulseSourceRow[]> {
  const { data } = await supabase
    .from("news_sources")
    .select("id, name, slug, provider, status, feed_url, county, refresh_minutes, last_fetched_at")
    .order("name");
  return ((data ?? []) as Row[]).map((r) => ({
    id: String(r["id"]),
    name: String(r["name"]),
    slug: String(r["slug"]),
    provider: r["provider"] as PulseProvider,
    status: String(r["status"]),
    feedUrl: (r["feed_url"] as string) ?? null,
    county: (r["county"] as string) ?? null,
    refreshMinutes: Number(r["refresh_minutes"] ?? 60),
    lastFetchedAt: (r["last_fetched_at"] as string) ?? null,
  }));
}

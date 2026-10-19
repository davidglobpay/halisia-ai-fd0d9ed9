/**
 * HALISIA Pulse — ingestion pipeline.
 *
 * fetch → normalise → deduplicate → classify → AI enrich → store → cluster →
 * score trending → log. Runs on the server only, with the service-role client.
 */
import { classify, enrichWithAi } from "./enrich.server";
import {
  fetchGNews,
  fetchGdelt,
  fetchNewsData,
  fetchRss,
  type ProviderResult,
  type RawArticle,
} from "./providers.server";
import type { PulseProvider } from "./types";

export type IngestSummary = {
  startedAt: string;
  finishedAt: string;
  providers: Array<{
    provider: PulseProvider;
    ok: boolean;
    fetched: number;
    inserted: number;
    duplicates: number;
    rejected: number;
    failed: number;
    error: string | null;
    latencyMs: number;
  }>;
  totalInserted: number;
};

/** Stable hash for URL-level deduplication (FNV-1a, hex). */
function hashUrl(url: string): string {
  const clean = url.split("?")[0]!.replace(/\/$/, "").toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16)}-${clean.length}-${clean.slice(-24)}`;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 3)
    .slice(0, 10)
    .join(" ");
}

function clusterKey(title: string, county: string | null): string {
  return `${county ?? "national"}::${normalizeTitle(title).split(" ").slice(0, 6).join("-")}`;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Fetch from every configured provider, including all active RSS sources. */
export async function fetchAllProviders(limitPerProvider = 30): Promise<ProviderResult[]> {
  const db = await admin();
  const { data: sources } = await db
    .from("news_sources")
    .select("id, slug, name, provider, feed_url, logo_url, category_hint, status")
    .eq("provider", "rss")
    .eq("status", "active");

  const rssJobs = (sources ?? [])
    .filter((s) => !!s.feed_url)
    .map((s) =>
      fetchRss(
        {
          url: s.feed_url!,
          name: s.name,
          logoUrl: s.logo_url,
          categoryHint: s.category_hint,
        },
        { limit: 15 },
      ),
    );

  const results = await Promise.all([
    fetchNewsData({ limit: limitPerProvider }),
    fetchGNews({ limit: limitPerProvider }),
    fetchGdelt({ limit: limitPerProvider }),
    ...rssJobs,
  ]);
  return results;
}

/** Persist one raw article; returns "inserted" | "duplicate" | "failed". */
async function storeArticle(
  raw: RawArticle,
  useAi: boolean,
): Promise<"inserted" | "duplicate" | "failed" | "irrelevant"> {
  const db = await admin();
  const urlHash = hashUrl(raw.url);
  const titleNorm = normalizeTitle(raw.title);

  const { data: existing } = await db
    .from("news_articles")
    .select("id")
    .or(`url_hash.eq.${urlHash},title_normalized.eq.${titleNorm.replace(/,/g, " ")}`)
    .limit(1);
  if (existing && existing.length > 0) return "duplicate";

  const base = classify(raw);
  // Before the AI call, not after: an article we will not publish should not
  // cost a gateway request either.
  if (!base.relevant) return "irrelevant";
  const ai = useAi ? await enrichWithAi(raw, base) : null;

  const county = ai?.county ?? base.county;
  const category = ai?.category ?? base.category;
  const tags = [...new Set([...(ai?.tags ?? []), ...base.tags])].slice(0, 10);

  const { data: inserted, error } = await db
    .from("news_articles")
    .insert({
      provider: raw.provider,
      external_id: raw.externalId,
      url: raw.url,
      url_hash: urlHash,
      title: raw.title,
      title_normalized: titleNorm,
      author: raw.author,
      source_name: raw.sourceName,
      source_logo_url: raw.sourceLogoUrl,
      image_url: raw.imageUrl,
      language: raw.language,
      raw_excerpt: raw.excerpt,
      summary: ai?.summary ?? raw.excerpt?.slice(0, 400) ?? null,
      why_it_matters: ai?.whyItMatters ?? null,
      property_impact: ai?.propertyImpact ?? null,
      land_impact: ai?.landImpact ?? null,
      infrastructure_impact: ai?.infrastructureImpact ?? null,
      investment_impact: ai?.investmentImpact ?? null,
      environmental_impact: ai?.environmentalImpact ?? null,
      category,
      tags,
      county,
      geo_level: base.geoLevel,
      place_label: base.placeLabel,
      latitude: base.latitude,
      longitude: base.longitude,
      confidence: ai ? Math.min(95, base.confidence + 8) : base.confidence,
      ai_processed: !!ai,
      published_at: raw.publishedAt,
    })
    .select("id")
    .single();

  if (error || !inserted) return error?.code === "23505" ? "duplicate" : "failed";

  // Location row for the map layer.
  if (county) {
    await db.from("news_locations").insert({
      article_id: inserted.id,
      label: base.placeLabel ?? county,
      geo_level: base.geoLevel,
      county,
      latitude: base.latitude,
      longitude: base.longitude,
      confidence: base.confidence,
    });
  }

  // Tag vocabulary.
  for (const t of tags) {
    await db
      .from("news_tags")
      .upsert(
        { slug: t, label: t.replace(/-/g, " ") },
        { onConflict: "slug", ignoreDuplicates: true },
      );
  }

  // Clustering: same story, multiple outlets.
  const key = clusterKey(raw.title, county);
  const { data: cluster } = await db
    .from("news_clusters")
    .select("id, article_count, source_count")
    .eq("key", key)
    .maybeSingle();
  if (cluster) {
    await db
      .from("news_clusters")
      .update({
        article_count: cluster.article_count + 1,
        source_count: cluster.source_count + 1,
        last_article_at: raw.publishedAt ?? new Date().toISOString(),
      })
      .eq("id", cluster.id);
    await db.from("news_articles").update({ cluster_id: cluster.id }).eq("id", inserted.id);
  } else {
    const { data: created } = await db
      .from("news_clusters")
      .insert({
        key,
        title: raw.title,
        county,
        category,
        last_article_at: raw.publishedAt ?? new Date().toISOString(),
      })
      .select("id")
      .single();
    if (created)
      await db.from("news_articles").update({ cluster_id: created.id }).eq("id", inserted.id);
  }

  // Trending seed score.
  await db.from("trending_scores").upsert({
    article_id: inserted.id,
    freshness: 100,
    source_spread: cluster ? Math.min(100, (cluster.source_count + 1) * 20) : 20,
    engagement: 0,
    ai_importance: ai?.importance ?? 50,
    score: 0.4 * 100 + 0.25 * (cluster ? 40 : 20) + 0.35 * (ai?.importance ?? 50),
    computed_at: new Date().toISOString(),
  });

  return "inserted";
}

/** Full refresh across all providers. */
export async function runIngestion(opts: { useAi?: boolean; maxPerProvider?: number } = {}) {
  const db = await admin();
  const startedAt = new Date().toISOString();
  const useAi = opts.useAi ?? true;
  const results = await fetchAllProviders(opts.maxPerProvider ?? 30);

  const summary: IngestSummary = {
    startedAt,
    finishedAt: startedAt,
    providers: [],
    totalInserted: 0,
  };

  // Merge RSS results (many feeds) into one reported provider row.
  const byProvider = new Map<PulseProvider, ProviderResult[]>();
  for (const r of results) {
    const list = byProvider.get(r.provider) ?? [];
    list.push(r);
    byProvider.set(r.provider, list);
  }

  for (const [provider, group] of byProvider) {
    const logStart = new Date().toISOString();
    let inserted = 0;
    let duplicates = 0;
    let rejected = 0;
    let failed = 0;
    const articles = group.flatMap((g) => g.articles);
    const ok = group.some((g) => g.ok);
    const error = group.find((g) => g.error)?.error ?? null;
    const latencyMs = Math.max(...group.map((g) => g.latencyMs), 0);

    for (const raw of articles) {
      try {
        const outcome = await storeArticle(raw, useAi);
        if (outcome === "inserted") inserted++;
        else if (outcome === "duplicate") duplicates++;
        else if (outcome === "irrelevant") rejected++;
        else failed++;
      } catch {
        failed++;
      }
    }

    summary.providers.push({
      provider,
      ok,
      fetched: articles.length,
      inserted,
      duplicates,
      rejected,
      failed,
      error,
      latencyMs,
    });
    summary.totalInserted += inserted;

    await db.from("news_ingestion_logs").insert({
      provider,
      started_at: logStart,
      finished_at: new Date().toISOString(),
      fetched_count: articles.length,
      inserted_count: inserted,
      duplicate_count: duplicates,
      rejected_count: rejected,
      failed_count: failed,
      ok,
      error_message: error,
    });

    await db.from("news_provider_health").upsert({
      provider,
      status: ok ? "active" : error?.includes("not configured") ? "awaiting_api_key" : "degraded",
      last_ok_at: ok ? new Date().toISOString() : undefined,
      last_error_at: ok ? undefined : new Date().toISOString(),
      last_error: error,
      latency_ms: latencyMs,
      updated_at: new Date().toISOString(),
    });
  }

  summary.finishedAt = new Date().toISOString();
  await recomputeTrending();
  return summary;
}

/**
 * Trending = 40% freshness + 25% multi-source spread + 20% engagement +
 * 15% AI importance, decayed over 72 hours.
 */
export async function recomputeTrending(): Promise<number> {
  const db = await admin();
  const since = new Date(Date.now() - 72 * 3600_000).toISOString();
  const { data: rows } = await db
    .from("news_articles")
    .select("id, published_at, ingested_at, view_count, save_count, share_count, cluster_id")
    .gte("ingested_at", since)
    .eq("archived", false)
    .limit(500);

  if (!rows?.length) return 0;

  const clusterIds = [...new Set(rows.map((r) => r.cluster_id).filter(Boolean))] as string[];
  const spread = new Map<string, number>();
  if (clusterIds.length) {
    const { data: clusters } = await db
      .from("news_clusters")
      .select("id, source_count")
      .in("id", clusterIds);
    for (const c of clusters ?? []) spread.set(c.id, c.source_count);
  }

  const now = Date.now();
  for (const r of rows) {
    const ageH = (now - new Date(r.published_at ?? r.ingested_at).getTime()) / 3600_000;
    const freshness = Math.max(0, 100 - (ageH / 72) * 100);
    const sourceSpread = Math.min(100, (spread.get(r.cluster_id ?? "") ?? 1) * 20);
    const engagement = Math.min(100, r.save_count * 5 + r.share_count * 8);
    const { data: prior } = await db
      .from("trending_scores")
      .select("ai_importance")
      .eq("article_id", r.id)
      .maybeSingle();
    const importance = prior?.ai_importance ?? 50;
    await db.from("trending_scores").upsert({
      article_id: r.id,
      freshness,
      source_spread: sourceSpread,
      engagement,
      ai_importance: importance,
      score: 0.4 * freshness + 0.25 * sourceSpread + 0.2 * engagement + 0.15 * Number(importance),
      computed_at: new Date().toISOString(),
    });
  }
  return rows.length;
}

/** Archive anything older than the retention window. */
export async function archiveOldArticles(days = 45): Promise<number> {
  const db = await admin();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await db
    .from("news_articles")
    .update({ archived: true })
    .lt("ingested_at", cutoff)
    .eq("archived", false)
    .select("id");
  return data?.length ?? 0;
}

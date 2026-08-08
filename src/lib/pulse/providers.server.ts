/**
 * HALISIA Pulse — provider layer.
 *
 * Every provider normalises to a single `RawArticle` shape so the ingestion
 * pipeline never has to care where a story came from. Providers fail soft:
 * a dead feed degrades that provider only, never the whole refresh.
 */
import type { PulseProvider } from "./types";

export type RawArticle = {
  provider: PulseProvider;
  externalId: string | null;
  url: string;
  title: string;
  author: string | null;
  sourceName: string | null;
  sourceLogoUrl: string | null;
  imageUrl: string | null;
  excerpt: string | null;
  language: string;
  publishedAt: string | null;
  categoryHint: string | null;
  countryHint: string | null;
};

export type ProviderResult = {
  provider: PulseProvider;
  articles: RawArticle[];
  ok: boolean;
  error: string | null;
  latencyMs: number;
};

export type FetchOptions = {
  /** Keyword / boolean query. */
  query?: string;
  /** Category hint understood by the provider. */
  category?: string;
  /** County name to bias the query towards. */
  county?: string;
  limit?: number;
};

const UA = "HalisiaPulse/1.0 (+https://halisia-ai.lovable.app)";
const KENYA_QUERY =
  "Kenya AND (land OR property OR housing OR infrastructure OR road OR county OR investment OR flooding)";

async function timed<T>(fn: () => Promise<T>) {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { value, error: null as string | null, latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      value: null as T | null,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - t0,
    };
  }
}

async function getJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 180)}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(to);
  }
}

async function getText(url: string, timeoutMs = 12_000): Promise<string> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(to);
  }
}

function buildQuery(opts: FetchOptions): string {
  const bits: string[] = [];
  if (opts.query) bits.push(opts.query);
  if (opts.county) bits.push(`"${opts.county}"`);
  if (opts.category) bits.push(opts.category);
  return bits.length ? `Kenya AND (${bits.join(" AND ")})` : KENYA_QUERY;
}

/* ------------------------------------------------------------------ */
/* NewsData.io                                                         */
/* ------------------------------------------------------------------ */

type NewsDataResp = {
  results?: Array<{
    article_id?: string;
    title?: string;
    link?: string;
    description?: string;
    content?: string;
    pubDate?: string;
    image_url?: string;
    source_id?: string;
    source_name?: string;
    source_icon?: string;
    creator?: string[] | null;
    language?: string;
    category?: string[];
    country?: string[];
  }>;
};

export async function fetchNewsData(opts: FetchOptions = {}): Promise<ProviderResult> {
  const key = process.env["NEWSDATA_API_KEY"];
  if (!key) {
    return {
      provider: "newsdata",
      articles: [],
      ok: false,
      error: "NEWSDATA_API_KEY is not configured",
      latencyMs: 0,
    };
  }
  const params = new URLSearchParams({
    apikey: key,
    country: "ke",
    language: "en",
    q: buildQuery(opts).slice(0, 100),
  });
  const { value, error, latencyMs } = await timed(() =>
    getJson<NewsDataResp>(`https://newsdata.io/api/1/latest?${params.toString()}`),
  );
  const rows = value?.results ?? [];
  return {
    provider: "newsdata",
    ok: !error,
    error,
    latencyMs,
    articles: rows
      .filter((r) => r.link && r.title)
      .slice(0, opts.limit ?? 40)
      .map((r) => ({
        provider: "newsdata" as const,
        externalId: r.article_id ?? null,
        url: r.link!,
        title: r.title!,
        author: r.creator?.[0] ?? null,
        sourceName: r.source_name ?? r.source_id ?? null,
        sourceLogoUrl: r.source_icon ?? null,
        imageUrl: r.image_url ?? null,
        excerpt: (r.description || r.content || "").slice(0, 1500) || null,
        language: r.language ?? "en",
        publishedAt: r.pubDate ? new Date(r.pubDate.replace(" ", "T") + "Z").toISOString() : null,
        categoryHint: r.category?.[0] ?? null,
        countryHint: r.country?.[0] ?? "kenya",
      })),
  };
}

/* ------------------------------------------------------------------ */
/* GNews                                                               */
/* ------------------------------------------------------------------ */

type GNewsResp = {
  articles?: Array<{
    title?: string;
    description?: string;
    content?: string;
    url?: string;
    image?: string;
    publishedAt?: string;
    source?: { name?: string; url?: string };
  }>;
};

export async function fetchGNews(opts: FetchOptions = {}): Promise<ProviderResult> {
  const key = process.env["GNEWS_API_KEY"];
  if (!key) {
    return {
      provider: "gnews",
      articles: [],
      ok: false,
      error: "GNEWS_API_KEY is not configured",
      latencyMs: 0,
    };
  }
  const params = new URLSearchParams({
    apikey: key,
    country: "ke",
    lang: "en",
    max: String(Math.min(opts.limit ?? 25, 100)),
    q: buildQuery(opts).slice(0, 190),
  });
  const { value, error, latencyMs } = await timed(() =>
    getJson<GNewsResp>(`https://gnews.io/api/v4/search?${params.toString()}`),
  );
  const rows = value?.articles ?? [];
  return {
    provider: "gnews",
    ok: !error,
    error,
    latencyMs,
    articles: rows
      .filter((r) => r.url && r.title)
      .map((r) => ({
        provider: "gnews" as const,
        externalId: null,
        url: r.url!,
        title: r.title!,
        author: null,
        sourceName: r.source?.name ?? null,
        sourceLogoUrl: null,
        imageUrl: r.image ?? null,
        excerpt: (r.description || r.content || "").slice(0, 1500) || null,
        language: "en",
        publishedAt: r.publishedAt ?? null,
        categoryHint: opts.category ?? null,
        countryHint: "kenya",
      })),
  };
}

/* ------------------------------------------------------------------ */
/* GDELT (free, no key)                                                */
/* ------------------------------------------------------------------ */

type GdeltResp = {
  articles?: Array<{
    url?: string;
    title?: string;
    seendate?: string;
    socialimage?: string;
    domain?: string;
    language?: string;
  }>;
};

function gdeltDate(seen?: string): string | null {
  // "20260115T093000Z"
  if (!seen || seen.length < 15) return null;
  const iso = `${seen.slice(0, 4)}-${seen.slice(4, 6)}-${seen.slice(6, 8)}T${seen.slice(9, 11)}:${seen.slice(11, 13)}:${seen.slice(13, 15)}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function fetchGdelt(opts: FetchOptions = {}): Promise<ProviderResult> {
  const q = opts.county
    ? `sourcecountry:kenya ${opts.county} ${opts.category ?? ""}`.trim()
    : `sourcecountry:kenya (land OR property OR housing OR infrastructure OR county)`;
  const params = new URLSearchParams({
    query: q,
    mode: "artlist",
    format: "json",
    maxrecords: String(Math.min(opts.limit ?? 40, 75)),
    sort: "datedesc",
  });
  const { value, error, latencyMs } = await timed(() =>
    getJson<GdeltResp>(`https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`),
  );
  const rows = value?.articles ?? [];
  return {
    provider: "gdelt",
    ok: !error,
    error,
    latencyMs,
    articles: rows
      .filter((r) => r.url && r.title)
      .map((r) => ({
        provider: "gdelt" as const,
        externalId: null,
        url: r.url!,
        title: r.title!,
        author: null,
        sourceName: r.domain ?? null,
        sourceLogoUrl: null,
        imageUrl: r.socialimage || null,
        excerpt: null,
        language: r.language?.toLowerCase().startsWith("eng") ? "en" : (r.language ?? "en"),
        publishedAt: gdeltDate(r.seendate),
        categoryHint: opts.category ?? null,
        countryHint: "kenya",
      })),
  };
}

/* ------------------------------------------------------------------ */
/* RSS / Atom                                                          */
/* ------------------------------------------------------------------ */

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]!.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || null : null;
}

function attr(block: string, name: string, key: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*\\b${key}=["']([^"']+)["']`, "i"));
  return m ? decodeEntities(m[1]!) : null;
}

/** Minimal, dependency-free RSS 2.0 + Atom parser (Worker-safe). */
export function parseFeed(xml: string): Array<{
  title: string;
  link: string;
  description: string | null;
  pubDate: string | null;
  image: string | null;
  author: string | null;
}> {
  const blocks = [
    ...(xml.match(/<item[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []),
  ];
  const out: ReturnType<typeof parseFeed> = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const link = tag(b, "link") || attr(b, "link", "href");
    if (!title || !link || !/^https?:/i.test(link)) continue;
    const raw = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
    const when = raw ? new Date(raw) : null;
    out.push({
      title,
      link,
      description: tag(b, "description") || tag(b, "summary") || tag(b, "content"),
      pubDate: when && !Number.isNaN(when.getTime()) ? when.toISOString() : null,
      image:
        attr(b, "media:content", "url") ||
        attr(b, "media:thumbnail", "url") ||
        attr(b, "enclosure", "url"),
      author: tag(b, "dc:creator") || tag(b, "author") || null,
    });
  }
  return out;
}

export async function fetchRss(
  feed: { url: string; name: string; logoUrl?: string | null; categoryHint?: string | null },
  opts: FetchOptions = {},
): Promise<ProviderResult> {
  const { value, error, latencyMs } = await timed(() => getText(feed.url));
  const items = value ? parseFeed(value) : [];
  return {
    provider: "rss",
    ok: !error,
    error,
    latencyMs,
    articles: items.slice(0, opts.limit ?? 25).map((i) => ({
      provider: "rss" as const,
      externalId: null,
      url: i.link,
      title: i.title,
      author: i.author,
      sourceName: feed.name,
      sourceLogoUrl: feed.logoUrl ?? null,
      imageUrl: i.image,
      excerpt: i.description ? i.description.slice(0, 1500) : null,
      language: "en",
      publishedAt: i.pubDate,
      categoryHint: feed.categoryHint ?? null,
      countryHint: "kenya",
    })),
  };
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Newspaper, Search, TrendingUp, Volume2 } from "lucide-react";
import {
  PULSE_CATEGORIES,
  fetchCountyCounts,
  fetchFeed,
  relativeTime,
  speakArticle,
  type PulseArticle,
} from "@/lib/pulse";

export const Route = createFileRoute("/pulse/")({
  component: PulsePage,
  head: () => ({
    meta: [
      { title: "HALISIA Pulse — Kenyan land & property news intelligence" },
      {
        name: "description",
        content:
          "Live Kenyan news read through a land, property, infrastructure and investment lens, with county tagging and AI impact analysis.",
      },
      { property: "og:title", content: "HALISIA Pulse — land & property news intelligence" },
      {
        property: "og:description",
        content: "AI-analysed Kenyan news for land, property and infrastructure decisions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ArticleCard({ a }: { a: PulseArticle }) {
  return (
    <article className="elev-1 flex flex-col overflow-hidden rounded-2xl border border-white/10">
      {a.imageUrl && (
        <img
          src={a.imageUrl}
          alt=""
          loading="lazy"
          className="h-40 w-full object-cover"
          onError={(e) => ((e.currentTarget.style.display = "none"), undefined)}
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-accent">
          <span>{a.category.replace(/-/g, " ")}</span>
          {a.county && <span className="text-muted-foreground">· {a.county}</span>}
          <span className="text-muted-foreground">· {relativeTime(a.publishedAt)}</span>
        </div>
        <h3 className="text-sm font-semibold leading-snug">{a.title}</h3>
        {a.summary && (
          <p className="line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">
            {a.summary}
          </p>
        )}
        {a.whyItMatters && (
          <p className="rounded-lg border border-accent/25 bg-accent/10 p-2 text-[11px] leading-relaxed">
            <span className="font-semibold text-accent">Why it matters — </span>
            {a.whyItMatters}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
          <span>
            {a.sourceName ?? a.provider} · {a.confidence}% confidence
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => speakArticle(a)}
              aria-label={`Listen to ${a.title}`}
              className="hover:text-accent"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              Read source
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function PulsePage() {
  const [search, setSearch] = useState("");
  const [county, setCounty] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<"today" | "week" | "month" | "all">("week");
  const [sort, setSort] = useState<"latest" | "trending">("latest");

  const filters = useMemo(
    () => ({ search, county, category, timeframe, sort, limit: 30 }),
    [search, county, category, timeframe, sort],
  );

  const feed = useQuery({
    queryKey: ["pulse-feed", filters],
    queryFn: () => fetchFeed(filters),
  });
  const countyCounts = useQuery({ queryKey: ["pulse-counties"], queryFn: fetchCountyCounts });

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="max-w-2xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-accent">
          <Newspaper className="h-3.5 w-3.5" /> HALISIA Pulse
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Kenyan news, read as <span className="text-gradient">land intelligence</span>.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every story is county-tagged and analysed for what it means for property, land,
          infrastructure, investment and the environment.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="elev-1 flex min-h-11 flex-1 min-w-[240px] items-center gap-2 rounded-full border border-white/10 px-4">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search headlines, places, topics…"
            aria-label="Search Pulse"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => setSort(sort === "latest" ? "trending" : "latest")}
          aria-pressed={sort === "trending"}
          className="elev-1 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-xs"
        >
          <TrendingUp className="h-3.5 w-3.5" /> {sort === "trending" ? "Trending" : "Latest"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["today", "week", "month", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTimeframe(t)}
            aria-pressed={timeframe === t}
            className={`rounded-full border px-3 py-1.5 text-[11px] capitalize ${
              timeframe === t ? "border-accent/60 text-accent" : "border-white/10 text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-white/10" aria-hidden="true" />
        {PULSE_CATEGORIES.slice(0, 12).map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setCategory(category === c.slug ? null : c.slug)}
            aria-pressed={category === c.slug}
            className={`rounded-full border px-3 py-1.5 text-[11px] ${
              category === c.slug
                ? "border-accent/60 text-accent"
                : "border-white/10 text-muted-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {!!countyCounts.data?.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {countyCounts.data.slice(0, 12).map((c) => (
            <button
              key={c.county}
              type="button"
              onClick={() => setCounty(county === c.county ? null : c.county)}
              aria-pressed={county === c.county}
              className={`rounded-full border px-3 py-1 text-[11px] ${
                county === c.county
                  ? "border-primary/60 text-primary"
                  : "border-white/10 text-muted-foreground"
              }`}
            >
              {c.county} · {c.count}
            </button>
          ))}
        </div>
      )}

      {feed.isLoading && <p className="mt-10 text-sm text-muted-foreground">Loading the feed…</p>}
      {feed.isError && (
        <p className="mt-10 text-sm text-destructive">
          The feed could not be loaded. Please try again.
        </p>
      )}
      {feed.data?.length === 0 && (
        <div className="elev-1 mt-10 rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
          No stories yet for these filters. Pulse fills up as the ingestion pipeline runs — an
          administrator can trigger a refresh from the Pulse admin panel.
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {feed.data?.map((a) => <ArticleCard key={a.id} a={a} />)}
      </div>

      <p className="mt-10 text-[11px] text-muted-foreground/80">
        Headlines and excerpts remain the property of their publishers; Pulse links to the original
        source. AI impact analysis is decision support, not advice.{" "}
        <Link to="/marketplace" className="text-accent hover:underline">
          Back to the marketplace
        </Link>
      </p>
    </main>
  );
}
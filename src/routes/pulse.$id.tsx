import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Leaf,
  Map as MapIcon,
  Mountain,
  TrendingUp,
} from "lucide-react";
import countiesData from "@/data/kenya-counties.json";
import { fetchArticle, fetchRelated, relativeTime, type PulseArticle } from "@/lib/pulse";
import { trackArticleView } from "@/lib/pulse.functions";
import { listProperties } from "@/lib/properties";
import { formatPrice } from "@/lib/properties";
import { PulseAudioPlayer } from "@/components/halisia/pulse-audio";
import { HCarousel } from "@/components/halisia/ds/h-carousel";

type CountyProps = { code: number; name: string };
const COUNTIES = (countiesData as { features: { properties: CountyProps }[] }).features.map(
  (f) => f.properties,
);

export const Route = createFileRoute("/pulse/$id")({
  component: ArticlePage,
  head: () => ({
    meta: [
      { title: "Pulse story — HALISIA land & property intelligence" },
      {
        name: "description",
        content:
          "AI impact analysis of a Kenyan news story across property, land, infrastructure, investment and the environment.",
      },
      { property: "og:title", content: "HALISIA Pulse story" },
      {
        property: "og:description",
        content: "What this story means for land, property and investment decisions in Kenya.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const IMPACTS: Array<{
  key: keyof PulseArticle;
  label: string;
  icon: typeof Building2;
}> = [
  { key: "propertyImpact", label: "Property impact", icon: Building2 },
  { key: "landImpact", label: "Land impact", icon: MapIcon },
  { key: "infrastructureImpact", label: "Infrastructure impact", icon: Mountain },
  { key: "investmentImpact", label: "Investment impact", icon: TrendingUp },
  { key: "environmentalImpact", label: "Environmental impact", icon: Leaf },
];

function ArticlePage() {
  const { id } = Route.useParams();

  const article = useQuery({ queryKey: ["pulse-article", id], queryFn: () => fetchArticle(id) });
  const a = article.data ?? null;

  useEffect(() => {
    if (a?.id) void trackArticleView({ data: { articleId: a.id } }).catch(() => undefined);
  }, [a?.id]);

  const related = useQuery({
    queryKey: ["pulse-related", a?.id],
    queryFn: () => fetchRelated(a!, 8),
    enabled: !!a,
  });

  const listings = useQuery({
    queryKey: ["pulse-listings", a?.county],
    queryFn: () => listProperties({ county: a?.county ?? undefined }),
    enabled: !!a?.county,
  });

  if (article.isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-sm text-muted-foreground">
        Loading story…
      </main>
    );
  }
  if (!a) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-sm text-muted-foreground">This story is no longer available.</p>
        <Link to="/pulse" className="mt-3 inline-block text-sm text-accent hover:underline">
          Back to Pulse
        </Link>
      </main>
    );
  }

  const countyCode = COUNTIES.find((c) => c.name === a.county)?.code ?? null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link
        to="/pulse"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Pulse
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-accent">
          <span>{a.category.replace(/-/g, " ")}</span>
          {a.county && <span className="text-muted-foreground">· {a.county}</span>}
          {a.placeLabel && <span className="text-muted-foreground">· {a.placeLabel}</span>}
          <span className="text-muted-foreground">· {relativeTime(a.publishedAt)}</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
          {a.title}
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          {a.sourceName ?? a.provider}
          {a.author ? ` · ${a.author}` : ""} · {a.confidence}% geo-confidence · {a.viewCount} reads
        </p>
      </header>

      {a.imageUrl && (
        <img
          src={a.imageUrl}
          alt=""
          loading="lazy"
          className="mt-5 max-h-[380px] w-full rounded-2xl object-cover"
          onError={(e) => ((e.currentTarget.style.display = "none"), undefined)}
        />
      )}

      <div className="mt-5">
        <PulseAudioPlayer article={a} />
      </div>

      {(a.summary || a.rawExcerpt) && (
        <section className="elev-1 mt-5 rounded-2xl border border-white/10 p-5">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Summary</h2>
          <p className="mt-2 text-sm leading-relaxed">{a.summary ?? a.rawExcerpt}</p>
        </section>
      )}

      {a.whyItMatters && (
        <section className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-5">
          <h2 className="text-xs uppercase tracking-widest text-accent">Why it matters</h2>
          <p className="mt-2 text-sm leading-relaxed">{a.whyItMatters}</p>
        </section>
      )}

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        {IMPACTS.filter((i) => !!a[i.key]).map(({ key, label, icon: Icon }) => (
          <article key={String(key)} className="elev-1 rounded-2xl border border-white/10 p-4">
            <h3 className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> {label}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed">{String(a[key])}</p>
          </article>
        ))}
      </section>

      {(a.county || a.tags.length > 0) && (
        <section className="mt-6">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Related locations & topics
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {countyCode != null && (
              <Link
                to="/county/$code"
                params={{ code: String(countyCode) }}
                className="rounded-full border border-primary/50 px-3 py-1.5 text-[11px] text-primary hover:bg-primary/10"
              >
                {a.county} County profile
              </Link>
            )}
            {a.county && (
              <Link
                to="/explore"
                search={{ q: a.placeLabel ?? a.county }}
                className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Explore {a.placeLabel ?? a.county}
              </Link>
            )}
            {a.tags.slice(0, 8).map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        </section>
      )}

      {(listings.isLoading || !!listings.data?.length) && !!a.county && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Listings in {a.county}</h2>
          <HCarousel
            label={`Listings in ${a.county}`}
            className="mt-2"
            itemClassName="w-[240px]"
            loading={listings.isLoading}
          >
            {(listings.data ?? []).slice(0, 12).map((p) => (
              <Link
                key={p.id}
                to="/marketplace/$id"
                params={{ id: p.id }}
                preload="intent"
                className="elev-1 block h-full rounded-2xl border border-white/10 p-3 hover:bg-white/5"
              >
                <div className="text-[13px] font-semibold leading-snug">{p.title}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {p.county ?? "Kenya"} · {formatPrice(p)}
                </div>
              </Link>
            ))}
          </HCarousel>
        </section>
      )}

      {(related.isLoading || !!related.data?.length) && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Related stories</h2>
          <HCarousel
            label="Related stories"
            className="mt-2"
            itemClassName="w-[240px]"
            loading={related.isLoading}
          >
            {(related.data ?? []).map((r) => (
              <Link
                key={r.id}
                to="/pulse/$id"
                params={{ id: r.id }}
                preload="intent"
                className="elev-1 block h-full rounded-2xl border border-white/10 p-3 hover:bg-white/5"
              >
                <div className="text-[10px] uppercase tracking-widest text-accent">
                  {r.category.replace(/-/g, " ")}
                </div>
                <div className="mt-1 line-clamp-3 text-[13px] font-semibold leading-snug">
                  {r.title}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {relativeTime(r.publishedAt)}
                </div>
              </Link>
            ))}
          </HCarousel>
        </section>
      )}

      <section className="mt-8 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <a
          href={a.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-accent hover:underline"
        >
          Read the original at {a.sourceName ?? a.provider} <ExternalLink className="h-3 w-3" />
        </a>
        <Link to="/reports" className="hover:text-foreground">
          Save location reports
        </Link>
      </section>

      <p className="mt-6 text-[11px] text-muted-foreground/80">
        Headline and excerpt © {a.sourceName ?? "the publisher"}. HALISIA links to the original
        source; AI impact analysis is decision support, not advice.
      </p>
    </main>
  );
}

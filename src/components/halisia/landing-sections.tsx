import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  LayoutDashboard,
  Newspaper,
  Scale,
  Users,
} from "lucide-react";
import { HCarousel } from "@/components/halisia/ds/h-carousel";
import { PulseImage } from "@/components/halisia/pulse-image";
import { fetchFeed, relativeTime } from "@/lib/pulse";
import { listProperties, formatPrice } from "@/lib/properties";
import countiesData from "@/data/kenya-counties.json";

type CountyProps = { code: number; name: string };

const COUNTIES: CountyProps[] = (
  countiesData as { features: { properties: CountyProps }[] }
).features
  .map((f) => f.properties)
  .sort((a, b) => a.name.localeCompare(b.name));

function SectionShell({
  id,
  eyebrow,
  title,
  intro,
  action,
  children,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  intro?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.25em] text-accent">{eyebrow}</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
          {intro && <p className="mt-2 text-sm text-muted-foreground">{intro}</p>}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Live Pulse headlines, in a compact horizontal window. */
export function PulseWindow() {
  const feed = useQuery({
    queryKey: ["landing-pulse"],
    queryFn: () => fetchFeed({ sort: "latest", limit: 18 }),
  });

  return (
    <SectionShell
      id="pulse"
      eyebrow="HALISIA Pulse"
      title={
        <>
          Kenyan news, read as <span className="text-gradient">land intelligence</span>.
        </>
      }
      intro="County-tagged headlines with AI impact analysis for property, infrastructure and investment."
      action={
        <Link
          to="/pulse"
          preload="intent"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs text-accent hover:bg-white/5"
        >
          <Newspaper className="h-3.5 w-3.5" aria-hidden="true" /> Open Pulse
        </Link>
      }
    >
      {feed.isError ? (
        <div className="elev-1 rounded-2xl border border-white/10 p-5 text-sm text-muted-foreground">
          Pulse could not be loaded right now.{" "}
          <button type="button" onClick={() => void feed.refetch()} className="text-accent underline">
            Retry
          </button>
        </div>
      ) : (
        <HCarousel
          label="Latest Pulse stories"
          itemClassName="w-[240px]"
          loading={feed.isLoading}
          skeletonCount={5}
        >
          {(feed.data ?? []).map((a) => (
            <article
              key={a.id}
              className="elev-1 flex h-full flex-col overflow-hidden rounded-2xl border border-white/10"
            >
              {a.imageUrl && <PulseImage src={a.imageUrl} />}
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="text-[10px] uppercase tracking-widest text-accent">
                  {a.county ?? "Kenya"} · {relativeTime(a.publishedAt)}
                </div>
                <h3 className="text-[13px] font-semibold leading-snug">
                  <Link
                    to="/pulse/$id"
                    params={{ id: a.id }}
                    preload="intent"
                    className="hover:text-accent"
                  >
                    <span className="line-clamp-3">{a.title}</span>
                  </Link>
                </h3>
                {a.whyItMatters && (
                  <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                    {a.whyItMatters}
                  </p>
                )}
              </div>
            </article>
          ))}
        </HCarousel>
      )}
    </SectionShell>
  );
}

/** All 47 counties, searchable, as a compact rail. */
export function CountyListSection() {
  const [q, setQ] = useState("");
  const list = useMemo(
    () => COUNTIES.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())),
    [q],
  );

  return (
    <SectionShell
      id="county-list"
      eyebrow="County directory"
      title={
        <>
          All 47 counties, <span className="text-gradient">one tap away</span>.
        </>
      }
      action={
        <label className="elev-1 flex min-h-10 items-center rounded-full border border-white/10 px-4">
          <span className="sr-only">Filter counties</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter counties…"
            className="w-44 bg-transparent text-xs outline-none"
          />
        </label>
      }
    >
      <HCarousel label="County directory" itemClassName="w-[150px]">
        {list.map((c) => (
          <Link
            key={c.code}
            to="/county/$code"
            params={{ code: String(c.code) }}
            preload="intent"
            className="elev-1 flex h-full flex-col justify-between rounded-2xl border border-white/10 p-3 hover:border-accent/40"
          >
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Code {c.code}
            </span>
            <span className="mt-2 text-sm font-semibold">{c.name}</span>
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent">
              Profile <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </HCarousel>
    </SectionShell>
  );
}

/** Quick entry into the side-by-side county comparison workspace. */
export function CountyComparisonSection() {
  const [a, setA] = useState<number>(47);
  const [b, setB] = useState<number>(22);

  return (
    <SectionShell
      id="county-comparison"
      eyebrow="Comparison"
      title={
        <>
          Compare counties <span className="text-gradient">side by side</span>.
        </>
      }
      intro="Livability, growth, water reliability and investment signals, aligned on one screen."
    >
      <div className="elev-1 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 p-5">
        {(
          [
            ["First county", a, setA],
            ["Second county", b, setB],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {label}
            <select
              value={value}
              onChange={(e) => set(Number(e.target.value))}
              className="min-h-10 rounded-full border border-white/10 bg-transparent px-3 text-sm"
            >
              {COUNTIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-background">
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <Link
          to="/compare"
          search={{ codes: `${a},${b}` }}
          preload="intent"
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 text-sm font-medium text-primary-foreground"
        >
          <Scale className="h-4 w-4" aria-hidden="true" /> Compare
        </Link>
        <Link
          to="/compare-locations"
          preload="intent"
          className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-xs text-accent"
        >
          Compare two locations instead
        </Link>
      </div>
    </SectionShell>
  );
}

/** Freshest marketplace listings as a rail. */
export function MarketplaceSection() {
  const listings = useQuery({
    queryKey: ["landing-listings"],
    queryFn: () => listProperties({}),
  });

  return (
    <SectionShell
      id="marketplace"
      eyebrow="Marketplace"
      title={
        <>
          Listings with an <span className="text-gradient">intelligence score</span>.
        </>
      }
      intro="Every listing is verified through the HALISIA data pipeline before it reaches you."
      action={
        <Link
          to="/marketplace"
          preload="intent"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs text-accent hover:bg-white/5"
        >
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Browse marketplace
        </Link>
      }
    >
      {listings.isError ? (
        <div className="elev-1 rounded-2xl border border-white/10 p-5 text-sm text-muted-foreground">
          Listings could not be loaded.{" "}
          <button
            type="button"
            onClick={() => void listings.refetch()}
            className="text-accent underline"
          >
            Retry
          </button>
        </div>
      ) : listings.data?.length === 0 ? (
        <div className="elev-1 rounded-2xl border border-white/10 p-5 text-sm text-muted-foreground">
          No published listings yet — be the first to list a property.
        </div>
      ) : (
        <HCarousel
          label="Marketplace listings"
          itemClassName="w-[240px]"
          loading={listings.isLoading}
          skeletonCount={5}
        >
          {(listings.data ?? []).map((p) => (
            <Link
              key={p.id}
              to="/marketplace/$id"
              params={{ id: p.id }}
              preload="intent"
              className="elev-1 flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 hover:border-accent/40"
            >
              {p.media_urls?.[0] && <PulseImage src={p.media_urls[0]} alt={p.title} />}
              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <div className="text-[10px] uppercase tracking-widest text-accent">
                  {p.county ?? "Kenya"} · {p.intent}
                </div>
                <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug">{p.title}</h3>
                <div className="mt-auto pt-2 text-sm font-semibold text-gradient">
                  {formatPrice(p)}
                </div>
              </div>
            </Link>
          ))}
        </HCarousel>
      )}
    </SectionShell>
  );
}

/** Contributor platform + personal dashboard entry points. */
export function ContributorAndDashboardSection() {
  const cards = [
    {
      icon: Users,
      title: "Contributor platform",
      body: "Add photos, voice notes and on-the-ground observations. Verified contributions raise county confidence scores and earn reputation.",
      to: "/contributions" as const,
      cta: "Start contributing",
    },
    {
      icon: LayoutDashboard,
      title: "Your dashboard",
      body: "Saved places, reports, listings, leads and professional workflows — tailored to your role on the platform.",
      to: "/dashboard" as const,
      cta: "Open dashboard",
    },
    {
      icon: BarChart3,
      title: "Professional connections",
      body: "Match with surveyors, valuers, architects and lawyers, with verification status and availability.",
      to: "/connections" as const,
      cta: "Find professionals",
    },
  ];

  return (
    <SectionShell
      id="community"
      eyebrow="People"
      title={
        <>
          Built with the people <span className="text-gradient">on the ground</span>.
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="elev-1 flex flex-col rounded-2xl border border-white/10 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5">
              <c.icon className="h-5 w-5 text-accent" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            <Link
              to={c.to}
              preload="intent"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
            >
              {c.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

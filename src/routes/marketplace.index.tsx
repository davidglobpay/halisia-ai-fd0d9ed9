import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { MapPin, Sparkles, Building2, Plus, Search, Loader2 } from "lucide-react";
import {
  listProperties,
  PROPERTY_KINDS,
  INTENTS,
  formatPrice,
  type PropertyKind,
  type ListingIntent,
  type PropertyRow,
} from "@/lib/properties";

const searchSchema = z.object({
  kind: z.string().optional(),
  intent: z.string().optional(),
  county: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/marketplace/")({
  validateSearch: (s) => searchSchema.parse(s),
  component: MarketplaceIndex,
});

function MarketplaceIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q ?? "");

  const filters = useMemo(
    () => ({
      kind: (search.kind as PropertyKind | "all") ?? "all",
      intent: (search.intent as ListingIntent | "all") ?? "all",
      county: search.county || undefined,
      q: search.q || undefined,
    }),
    [search],
  );

  const query = useQuery({
    queryKey: ["marketplace", filters],
    queryFn: () => listProperties(filters),
  });

  const listings = query.data ?? [];

  const setFilter = (patch: Record<string, string | undefined>) =>
    navigate({ search: { ...search, ...patch } as never, replace: true });

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-7xl mx-auto">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Halisia AI</div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold mt-1">AI Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Every listing inherits the Land Intelligence Score — investment, construction,
            environment, infrastructure and more. AI-generated estimates carry a confidence rating.
          </p>
        </div>
        <Link
          to="/sell/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> List a property
        </Link>
      </header>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter({ q: q || undefined });
        }}
        className="glass rounded-2xl border border-white/10 p-3 mb-6 flex flex-wrap items-center gap-2"
      >
        <label className="flex items-center gap-2 flex-1 min-w-[220px] bg-white/5 rounded-xl px-3 py-2 border border-white/10">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, area, county…"
            className="bg-transparent outline-none text-sm w-full"
            aria-label="Search listings"
          />
        </label>
        <select
          value={filters.kind}
          onChange={(e) => setFilter({ kind: e.target.value === "all" ? undefined : e.target.value })}
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
          aria-label="Property type"
        >
          <option value="all">All types</option>
          {PROPERTY_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <select
          value={filters.intent}
          onChange={(e) => setFilter({ intent: e.target.value === "all" ? undefined : e.target.value })}
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
          aria-label="Intent"
        >
          <option value="all">Sale & Rent</option>
          {INTENTS.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
        >
          Apply
        </button>
      </form>

      {query.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading listings…
        </div>
      ) : listings.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((p) => (
            <ListingCard key={p.id} p={p} />
          ))}
        </ul>
      )}
    </main>
  );
}

function ListingCard({ p }: { p: PropertyRow }) {
  const aiScore =
    p.ai_score && typeof p.ai_score === "object" && "overall" in (p.ai_score as Record<string, unknown>)
      ? ((p.ai_score as { overall: number }).overall ?? null)
      : null;
  return (
    <li className="glass rounded-2xl border border-white/10 overflow-hidden flex flex-col">
      <Link to="/marketplace/$id" params={{ id: p.id }} className="block">
        <div className="aspect-[16/10] bg-gradient-to-br from-primary/30 via-accent/10 to-emerald-500/20 relative">
          {p.cover_image ? (
            <img
              src={p.cover_image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground/60">
              <Building2 className="h-10 w-10" />
            </div>
          )}
          {p.featured && (
            <span className="absolute top-2 left-2 rounded-full bg-amber-glow/90 text-black text-[10px] uppercase tracking-widest px-2 py-0.5">
              Featured
            </span>
          )}
          {aiScore != null && (
            <span className="absolute top-2 right-2 rounded-full bg-black/70 backdrop-blur px-2 py-0.5 text-[11px] font-mono">
              LIOS {aiScore}
            </span>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm leading-tight line-clamp-2">{p.title}</h3>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {p.county ?? "Kenya"}
            <span className="mx-1">·</span>
            <span className="capitalize">{p.kind.replace("_", " ")}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm font-semibold">{formatPrice(p)}</div>
            <div className="inline-flex items-center gap-1 text-[11px] text-accent">
              <Sparkles className="h-3 w-3" /> AI verified
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl border border-white/10 p-10 text-center">
      <h2 className="text-lg font-medium">No listings match yet</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Try clearing filters, or be the first to list in this segment.
      </p>
      <Link
        to="/sell/new"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-medium"
      >
        <Plus className="h-3.5 w-3.5" /> List a property
      </Link>
    </div>
  );
}
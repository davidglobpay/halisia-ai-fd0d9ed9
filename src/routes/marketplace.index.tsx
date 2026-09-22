import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  MapPin,
  Building2,
  Plus,
  Search,
  Loader2,
  LayoutGrid,
  Rows3,
  Map as MapIcon,
  BadgeCheck,
  Share2,
  Scale,
  Flag,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import {
  listProperties,
  INTENTS,
  formatPrice,
  type ListingIntent,
  type PropertyRow,
} from "@/lib/properties";
import { HoloTile } from "@/components/halisia/ds/holo-tile";
import { DataPipeline } from "@/components/halisia/data-pipeline";
import {
  CATEGORIES,
  MARKET_ACTIONS,
  RAILS,
  applyFilters,
  categoriesOf,
  completeness,
  isNew,
  railFilter,
  recommend,
  verification,
  type MarketAction,
  type MarketplaceCategory,
  type MarketplaceFilters,
  type Rail,
} from "@/lib/marketplace";
import { SaveButton } from "@/components/halisia/save-button";
import { PartnerListings } from "@/components/halisia/partner-listings";
import { LeafletLayersMap } from "@/components/halisia/leaflet-layers-map";

const searchSchema = z.object({
  category: z.string().optional(),
  action: z.string().optional(),
  intent: z.string().optional(),
  county: z.string().optional(),
  town: z.string().optional(),
  q: z.string().optional(),
  view: z.string().optional(),
  rail: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minSize: z.coerce.number().optional(),
  beds: z.coerce.number().optional(),
  baths: z.coerce.number().optional(),
  road: z.coerce.boolean().optional(),
  verified: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/marketplace/")({
  validateSearch: (s) => searchSchema.parse(s),
  component: MarketplaceIndex,
});

function MarketplaceIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [whyId, setWhyId] = useState<string | null>(null);

  const view = (search.view as "grid" | "list" | "map") ?? "grid";
  const rail = (search.rail as Rail) ?? "recommended";

  // Server-side coarse fetch (published only), then rich client-side filtering.
  const query = useQuery({
    queryKey: ["marketplace", search.county, search.intent],
    queryFn: () =>
      listProperties({
        intent: (search.intent as ListingIntent | "all") ?? "all",
        county: search.county || undefined,
      }),
  });

  const all = useMemo(() => query.data ?? [], [query.data]);

  const filters: MarketplaceFilters = useMemo(
    () => ({
      q: search.q || undefined,
      category: (search.category as MarketplaceCategory | "all") ?? "all",
      action: (search.action as MarketAction | "all") ?? "all",
      intent: (search.intent as ListingIntent | "all") ?? "all",
      county: search.county || undefined,
      town: search.town || undefined,
      minPrice: search.minPrice,
      maxPrice: search.maxPrice,
      minSize: search.minSize,
      bedrooms: search.beds,
      bathrooms: search.baths,
      roadAccess: search.road || undefined,
      verified: search.verified || undefined,
    }),
    [search],
  );

  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);
  const recs = useMemo(
    () =>
      recommend(filtered, {
        county: filters.county,
        budget: filters.maxPrice,
        intent: filters.intent,
        bedrooms: filters.bedrooms,
      }),
    [filtered, filters],
  );
  const listings = useMemo(
    () => (rail === "recommended" ? recs.map((r) => r.row) : railFilter(filtered, rail)),
    [rail, recs, filtered],
  );
  const counties = useMemo(
    () => Array.from(new Set(all.map((p) => p.county).filter(Boolean) as string[])).sort(),
    [all],
  );

  const setFilter = (patch: Record<string, unknown>) =>
    navigate({ search: { ...search, ...patch } as never, replace: true });

  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-3)));

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-7xl mx-auto">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Halisia AI</div>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold mt-1">AI Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Buy, sell, rent, lease, invest, develop and connect. Every listing shows its source
            and how complete its details are. Open one with coordinates to read the site's terrain,
            air quality and nearby amenities — and what HALISIA cannot assess.
          </p>
        </div>
        <Link
          to="/sell/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> List a property
        </Link>
      </header>

      {/* Marketplace actions */}
      <nav aria-label="Marketplace actions" className="mb-4 flex flex-wrap gap-2">
        {[{ value: "all", label: "All" }, ...MARKET_ACTIONS].map((a) => {
          const active = (search.action ?? "all") === a.value;
          return (
            <button
              key={a.value}
              onClick={() => setFilter({ action: a.value === "all" ? undefined : a.value })}
              aria-pressed={active}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide border transition ${
                active
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "glass border-white/10 text-muted-foreground hover:text-foreground"
              }`}
            >
              {a.label}
            </button>
          );
        })}
      </nav>

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
            placeholder="Search title, estate, town, county…"
            className="bg-transparent outline-none text-sm w-full"
            aria-label="Search listings"
          />
        </label>
        <select
          value={filters.category}
          onChange={(e) =>
            setFilter({ category: e.target.value === "all" ? undefined : e.target.value })
          }
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
          aria-label="Listing category"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <select
          value={filters.intent}
          onChange={(e) =>
            setFilter({ intent: e.target.value === "all" ? undefined : e.target.value })
          }
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
          aria-label="Intent"
        >
          <option value="all">Sale, rent & lease</option>
          {INTENTS.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
        <select
          value={filters.county ?? ""}
          onChange={(e) => setFilter({ county: e.target.value || undefined })}
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
          aria-label="County"
        >
          <option value="">All counties</option>
          {counties.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          aria-expanded={showFilters}
          className="rounded-xl glass border border-white/10 px-3 py-2 text-sm inline-flex items-center gap-1.5"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
      </form>

      {showFilters && (
        <section
          aria-label="Advanced filters"
          className="glass rounded-2xl border border-white/10 p-4 mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <NumField
            label="Min price (KES)"
            value={search.minPrice}
            onChange={(v) => setFilter({ minPrice: v })}
          />
          <NumField
            label="Max price (KES)"
            value={search.maxPrice}
            onChange={(v) => setFilter({ maxPrice: v })}
          />
          <NumField
            label="Min land size"
            value={search.minSize}
            onChange={(v) => setFilter({ minSize: v })}
          />
          <TextField
            label="Town / estate"
            value={search.town ?? ""}
            onChange={(v) => setFilter({ town: v || undefined })}
          />
          <NumField
            label="Min bedrooms"
            value={search.beds}
            onChange={(v) => setFilter({ beds: v })}
          />
          <NumField
            label="Min bathrooms"
            value={search.baths}
            onChange={(v) => setFilter({ baths: v })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(search.road)}
              onChange={(e) => setFilter({ road: e.target.checked || undefined })}
            />
            Road access
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(search.verified)}
              onChange={(e) => setFilter({ verified: e.target.checked || undefined })}
            />
            Complete listings only
          </label>
        </section>
      )}

      {/* Rails + view switcher */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Listing collections" className="flex flex-wrap gap-2">
          {RAILS.map((r) => {
            const active = rail === r.value;
            return (
              <button
                key={r.value}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter({ rail: r.value })}
                className={`rounded-full px-3 py-1.5 text-xs border transition ${
                  active
                    ? "bg-accent/20 border-accent/40 text-accent"
                    : "glass border-white/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <div
          className="inline-flex rounded-xl glass border border-white/10 p-1"
          role="group"
          aria-label="View mode"
        >
          {[
            { v: "grid", icon: LayoutGrid, label: "Grid view" },
            { v: "list", icon: Rows3, label: "List view" },
            { v: "map", icon: MapIcon, label: "Map view" },
          ].map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              onClick={() => setFilter({ view: v })}
              aria-label={label}
              aria-pressed={view === v}
              className={`rounded-lg p-2 ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        {listings.length} listing{listings.length === 1 ? "" : "s"}
        {rail === "recommended" &&
          " · ranked by your preferences, never by sensitive personal data"}
      </p>

      {compare.length > 0 && (
        <div className="glass rounded-xl border border-white/10 p-3 mb-4 flex items-center gap-3 text-xs">
          <Scale className="h-4 w-4 text-accent" />
          {compare.length} selected for comparison
          <button onClick={() => setCompare([])} className="underline">
            Clear
          </button>
        </div>
      )}

      {query.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading listings…
        </div>
      ) : listings.length === 0 ? (
        <EmptyState />
      ) : view === "map" ? (
        <MapView listings={listings} />
      ) : view === "list" ? (
        <ul className="grid gap-3">
          {listings.map((p) => (
            <ListingRow
              key={p.id}
              p={p}
              compared={compare.includes(p.id)}
              onCompare={() => toggleCompare(p.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="space-y-4">
          {groupByCounty(listings).map(([county, rows]) => (
            <HoloTile
              key={county}
              eyebrow="Marketplace"
              title={county}
              summary={`${rows.length} listing${rows.length === 1 ? "" : "s"}`}
              defaultOpen
              data-testid="marketplace-county-rail"
            >
              <ul className="scrollbar-none flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-2">
                {rows.map((p) => (
                  <li key={p.id} className="w-[280px] shrink-0 snap-start sm:w-[320px]">
                    <ListingCard
                      p={p}
                      compared={compare.includes(p.id)}
                      onCompare={() => toggleCompare(p.id)}
                      reasons={recs.find((r) => r.row.id === p.id)?.reasons}
                      showWhy={whyId === p.id}
                      onWhy={() => setWhyId((id) => (id === p.id ? null : p.id))}
                    />
                  </li>
                ))}
              </ul>
            </HoloTile>
          ))}
        </div>
      )}

      <PartnerListings />

      <DataPipeline />

      <section className="mt-10 glass rounded-2xl border border-white/10 p-4 text-xs text-muted-foreground">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Your recommendations, your rules
        </h2>
        <p>
          Recommendations use only the filters and goals you set here plus public listing
          intelligence. Reset them any time — we never target on sensitive personal information and
          never contact you without permission.
        </p>
        <button
          onClick={() => navigate({ search: { view, rail } as never, replace: true })}
          className="mt-2 rounded-full glass border border-white/10 px-3 py-1.5 text-xs"
        >
          Reset recommendations
        </button>
      </section>
    </main>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="text-xs text-muted-foreground grid gap-1">
      {label}
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-xs text-muted-foreground grid gap-1">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground"
      />
    </label>
  );
}

/**
 * Listing badges.
 *
 * The tier used to read "Verified / Reviewed / Unverified" and depended in
 * part on the presence of an `ai_score` object — so a listing was called
 * verified because a generated score existed on it. Nothing here verifies a
 * claim, so the labels now say what is actually measured: how much of the
 * listing the seller filled in. The old score badge is gone along with the
 * stored figure it came from.
 */
function Badges({ p }: { p: PropertyRow }) {
  const v = verification(p);
  const c = completeness(p);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      <span
        className={`rounded-full px-2 py-0.5 border ${
          v === "verified"
            ? "border-emerald-400/40 text-emerald-300 bg-emerald-400/10"
            : v === "reviewed"
              ? "border-amber-400/40 text-amber-300 bg-amber-400/10"
              : "border-white/15 text-muted-foreground"
        }`}
      >
        {v === "verified"
          ? "Details complete"
          : v === "reviewed"
            ? "Most details given"
            : "Sparse details"}
      </span>
      <span className="rounded-full border border-white/15 px-2 py-0.5 text-muted-foreground">
        {c}% of fields filled
      </span>
      {isNew(p) && (
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-accent">
          New
        </span>
      )}
    </div>
  );
}

function Actions({
  p,
  compared,
  onCompare,
}: {
  p: PropertyRow;
  compared: boolean;
  onCompare: () => void;
}) {
  const share = async () => {
    const url = `${window.location.origin}/marketplace/${p.id}`;
    if (navigator.share) await navigator.share({ title: p.title, url }).catch(() => {});
    else await navigator.clipboard.writeText(url).catch(() => {});
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <SaveButton
        kind="property"
        ref_={p.id}
        label={p.title}
        latitude={p.latitude}
        longitude={p.longitude}
      />
      <button
        onClick={share}
        className="inline-flex items-center gap-1 rounded-full glass border border-white/10 px-2.5 py-1"
      >
        <Share2 className="h-3 w-3" /> Share
      </button>
      <button
        onClick={onCompare}
        aria-pressed={compared}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
          compared ? "border-accent/50 text-accent bg-accent/10" : "glass border-white/10"
        }`}
      >
        <Scale className="h-3 w-3" /> Compare
      </button>
      <a
        href={`mailto:report@halisia.ai?subject=${encodeURIComponent(`Report listing ${p.id}`)}`}
        className="inline-flex items-center gap-1 rounded-full glass border border-white/10 px-2.5 py-1"
      >
        <Flag className="h-3 w-3" /> Report
      </a>
    </div>
  );
}

function MapView({ listings }: { listings: PropertyRow[] }) {
  const withGeo = listings.filter((p) => p.latitude != null && p.longitude != null);
  const first = withGeo[0];
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      {first ? (
        <LeafletLayersMap
          lat={Number(first.latitude)}
          lng={Number(first.longitude)}
          label={first.title}
        />
      ) : (
        <div className="glass rounded-2xl border border-white/10 p-8 text-sm text-muted-foreground">
          No listings in this view have map coordinates yet.
        </div>
      )}
      <ul className="grid gap-2 max-h-[70vh] overflow-auto pr-1">
        {listings.map((p) => (
          <li key={p.id} className="glass rounded-xl border border-white/10 p-3">
            <Link to="/marketplace/$id" params={{ id: p.id }} className="text-sm font-medium">
              {p.title}
            </Link>
            <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {p.county ?? "Kenya"} · {formatPrice(p)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListingRow({
  p,
  compared,
  onCompare,
}: {
  p: PropertyRow;
  compared: boolean;
  onCompare: () => void;
}) {
  return (
    <li className="glass rounded-2xl border border-white/10 p-3 flex flex-col sm:flex-row gap-3">
      <Link
        to="/marketplace/$id"
        params={{ id: p.id }}
        className="sm:w-52 shrink-0 aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-br from-primary/30 via-accent/10 to-emerald-500/20 relative"
      >
        {p.cover_image ? (
          <img
            src={p.cover_image}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground/60">
            <Building2 className="h-8 w-8" />
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <Link to="/marketplace/$id" params={{ id: p.id }} className="font-medium text-sm">
          {p.title}
        </Link>
        <div className="mt-1 text-[11px] text-muted-foreground flex flex-wrap items-center gap-1">
          <MapPin className="h-3 w-3" /> {p.address ?? p.county ?? "Kenya"}
          <span>·</span>
          <span className="capitalize">{p.kind.replace("_", " ")}</span>
          <span>·</span>
          <span className="capitalize">{p.intent}</span>
          {p.size_value != null && (
            <>
              <span>·</span>
              <span>
                {p.size_value} {p.size_unit ?? "acres"}
              </span>
            </>
          )}
          {p.bedrooms != null && (
            <>
              <span>·</span>
              <span>{p.bedrooms} bd</span>
            </>
          )}
        </div>
        <div className="mt-2">
          <Badges p={p} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">{formatPrice(p)}</div>
          <Actions p={p} compared={compared} onCompare={onCompare} />
        </div>
      </div>
    </li>
  );
}

function ListingCard({
  p,
  compared,
  onCompare,
  reasons,
  showWhy,
  onWhy,
}: {
  p: PropertyRow;
  compared: boolean;
  onCompare: () => void;
  reasons?: string[];
  showWhy?: boolean;
  onWhy?: () => void;
}) {
  const cats = categoriesOf(p);
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
        </div>
      </Link>
      <div className="px-4 pb-4 -mt-1 space-y-2">
        <Badges p={p} />
        {cats.length > 0 && (
          <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
            {cats.slice(0, 3).map((c) => (
              <span key={c} className="rounded-full bg-white/5 px-2 py-0.5 capitalize">
                {c.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{formatPrice(p)}</div>
          {p.latitude != null && p.longitude != null && (
            <span className="text-[11px] text-muted-foreground">Open for readings</span>
          )}
        </div>
        <Actions p={p} compared={compared} onCompare={onCompare} />
        {reasons?.length ? (
          <div>
            <button
              onClick={onWhy}
              aria-expanded={Boolean(showWhy)}
              className="inline-flex items-center gap-1 text-[11px] text-accent underline"
            >
              <Info className="h-3 w-3" /> Why am I seeing this?
            </button>
            {showWhy && (
              <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        <Link
          to="/marketplace/$id"
          params={{ id: p.id }}
          className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-[11px] font-semibold"
        >
          <BadgeCheck className="h-3 w-3" /> Contact & full intelligence
        </Link>
      </div>
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

/** Groups listings into county rails so the marketplace reads as horizontal shelves. */
function groupByCounty<T extends { county?: string | null }>(rows: T[]): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const key = r.county?.trim() || "Kenya";
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

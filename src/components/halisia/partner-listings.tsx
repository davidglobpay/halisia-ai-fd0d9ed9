import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Clock, Store } from "lucide-react";
import {
  listPartnerListings,
  formatPartnerPrice,
  formatSize,
  formatCheckedDate,
  mayBeOutOfDate,
  partnerUrl,
  CATEGORY_LABELS,
  INTENT_LABELS,
  AVAILABILITY_LABELS,
  type PartnerListing,
} from "@/lib/marketplace-external";

type Filters = { county: string; category: string; intent: string; sourceId: string };
const EMPTY: Filters = { county: "", category: "", intent: "", sourceId: "" };

/**
 * Listings HALISIA did not create. They are kept in their own section, always
 * labelled with the source, and never merged into the HALISIA grid above.
 */
export function PartnerListings() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const query = useQuery({
    queryKey: ["partner-listings"],
    queryFn: () => listPartnerListings(),
    staleTime: 5 * 60_000,
  });
  const all = useMemo(() => query.data ?? [], [query.data]);

  const counties = useMemo(
    () => [...new Set(all.map((l) => l.county).filter(Boolean) as string[])].sort(),
    [all],
  );
  const categories = useMemo(
    () => [...new Set(all.map((l) => l.listing_category).filter(Boolean) as string[])].sort(),
    [all],
  );
  const intents = useMemo(
    () => [...new Set(all.map((l) => l.intent).filter(Boolean) as string[])].sort(),
    [all],
  );
  const sources = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of all) if (l.source) map.set(l.source.id, l.source.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);

  const rows = useMemo(
    () =>
      all.filter(
        (l) =>
          (!filters.county || l.county === filters.county) &&
          (!filters.category || l.listing_category === filters.category) &&
          (!filters.intent || l.intent === filters.intent) &&
          (!filters.sourceId || l.source?.id === filters.sourceId),
      ),
    [all, filters],
  );

  const oldestChecked = useMemo(() => {
    const dates = all.map((l) => l.source_checked_at).filter(Boolean) as string[];
    if (!dates.length) return null;
    return formatCheckedDate(dates.sort()[0]);
  }, [all]);

  if (query.isLoading) {
    return (
      <section className="mt-10" data-testid="partner-listings">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading partner listings…
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section
        className="mt-10 glass rounded-2xl border border-white/10 p-4"
        data-testid="partner-listings"
      >
        <h2 className="text-sm font-semibold">Partner listings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These could not be loaded just now. Your own listings above are unaffected.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10" data-testid="partner-listings">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Store className="h-4 w-4 text-accent" /> Partner listings
        </h2>
        <p className="text-xs text-muted-foreground">
          {rows.length} of {all.length} listed by others
          {oldestChecked ? ` · checked from ${oldestChecked}` : ""}
        </p>
      </div>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Collected from public listings by other companies. HALISIA has not inspected these
        properties, confirmed ownership, or verified any figure shown. Always check with the source
        before paying anything.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <FilterSelect
          label="County"
          value={filters.county}
          onChange={(county) => setFilters((f) => ({ ...f, county }))}
          options={counties.map((c) => [c, c])}
        />
        <FilterSelect
          label="Type"
          value={filters.category}
          onChange={(category) => setFilters((f) => ({ ...f, category }))}
          options={categories.map((c) => [c, CATEGORY_LABELS[c] ?? c])}
        />
        <FilterSelect
          label="Intent"
          value={filters.intent}
          onChange={(intent) => setFilters((f) => ({ ...f, intent }))}
          options={intents.map((i) => [i, INTENT_LABELS[i] ?? i])}
        />
        <FilterSelect
          label="Source"
          value={filters.sourceId}
          onChange={(sourceId) => setFilters((f) => ({ ...f, sourceId }))}
          options={sources}
        />
        {(filters.county || filters.category || filters.intent || filters.sourceId) && (
          <button
            onClick={() => setFilters(EMPTY)}
            className="rounded-full glass border border-white/10 px-3 py-1.5 text-xs focus-ring"
          >
            Clear filters
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 glass rounded-2xl border border-white/10 p-8 text-center">
          <p className="text-sm">No partner listings match these filters.</p>
          <button onClick={() => setFilters(EMPTY)} className="mt-3 text-xs underline focus-ring">
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((l) => (
            <li key={l.id}>
              <PartnerCard listing={l} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  if (options.length === 0) return null;
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="sr-only sm:not-sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input py-1 text-xs"
        aria-label={label}
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Text only. Every source is discovery-only, so images and descriptions are
 * withheld unless the source record grants those rights.
 */
function PartnerCard({ listing }: { listing: PartnerListing }) {
  const stale = mayBeOutOfDate(listing);
  const size = formatSize(listing);
  const hasUrl = partnerUrl(listing) != null;
  const availability =
    listing.availability_status && listing.availability_status !== "available"
      ? (AVAILABILITY_LABELS[listing.availability_status] ?? listing.availability_status)
      : null;

  return (
    <article className="glass glow-sheen flex h-full flex-col rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {listing.source?.name ?? "Source unavailable"}
      </p>
      <h3 className="mt-1 text-sm font-semibold leading-snug">{listing.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {[listing.locality, listing.county].filter(Boolean).join(", ") || "Location not stated"}
      </p>
      <p className="mt-2 text-sm font-semibold">{formatPartnerPrice(listing)}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
        {listing.listing_category && (
          <Chip>{CATEGORY_LABELS[listing.listing_category] ?? listing.listing_category}</Chip>
        )}
        {listing.intent && <Chip>{INTENT_LABELS[listing.intent] ?? listing.intent}</Chip>}
        {size && <Chip>{size}</Chip>}
        {listing.bedrooms != null && <Chip>{listing.bedrooms} bed</Chip>}
        {availability && <Chip>{availability}</Chip>}
      </ul>
      {stale && (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" /> May be out of date
        </p>
      )}
      <div className="mt-auto pt-3">
        <Link
          to="/partner-listing/$id"
          params={{ id: listing.id }}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground focus-ring"
        >
          {hasUrl ? (
            <>
              <ExternalLink className="h-3 w-3" aria-hidden="true" /> View details
            </>
          ) : (
            "View details"
          )}
        </Link>
        {!hasUrl && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Link to the source is being confirmed.
          </p>
        )}
      </div>
    </article>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <li className="rounded-full border border-white/10 px-2 py-0.5">{children}</li>;
}

import { isSampleListing, SAMPLE_LISTING_LABEL, SAMPLE_LISTING_NOTE } from "@/lib/sample-listing";

/** Small badge beside a listing title; renders nothing for real listings. */
export function SampleListingBadge({
  listing,
  className = "",
}: {
  listing: unknown;
  className?: string;
}) {
  if (!isSampleListing(listing)) return null;
  return (
    <span
      data-testid="sample-listing-badge"
      title={SAMPLE_LISTING_NOTE}
      className={`inline-flex shrink-0 items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-glow ${className}`}
    >
      {SAMPLE_LISTING_LABEL}
    </span>
  );
}

/** Full-width notice for a listing's own page. */
export function SampleListingNotice({ listing }: { listing: unknown }) {
  if (!isSampleListing(listing)) return null;
  return (
    <p
      role="note"
      data-testid="sample-listing-notice"
      className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-glow"
    >
      {SAMPLE_LISTING_NOTE}
    </p>
  );
}

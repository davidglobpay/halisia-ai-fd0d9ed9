/**
 * Demonstration listings and parcels carry `is_sample = true` (migration
 * 20261028190000_label_sample_listings). They stay visible so the marketplace
 * can be shown working, but they must never read as real offers.
 *
 * The check reads the column defensively: until the migration is applied the
 * column is absent and nothing is labelled, rather than the query failing.
 */
export function isSampleListing(row: unknown): boolean {
  return (
    typeof row === "object" && row !== null && (row as { is_sample?: unknown }).is_sample === true
  );
}

export const SAMPLE_LISTING_LABEL = "Sample listing";

export const SAMPLE_LISTING_NOTE =
  "This is an example listing used to demonstrate the marketplace. It is not for sale, and its details — including any title, survey or approval described — are illustrative and have not been verified.";

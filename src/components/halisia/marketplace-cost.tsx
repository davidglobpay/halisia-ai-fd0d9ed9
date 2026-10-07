import { priceKes } from "@/lib/service-pricing";
import {
  proposedCommissionKes,
  PROPOSED_MARKETPLACE_COMMISSION_PCT,
} from "@/lib/marketplace-pricing";

/** A proposed seller/provider fee, not an added buyer charge or agreed partner contract. */
export function MarketplaceCost({
  price,
  currency,
  intent,
}: {
  price?: unknown;
  currency?: string | null;
  intent?: string | null;
}) {
  const estimate = proposedCommissionKes(price, currency);
  return (
    <div
      className="my-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs"
      aria-label="HALISIA commission disclosure"
    >
      <p className="font-bold text-primary">
        HALISIA commission charged now · 0% · KES 0
      </p>
      <p className="mt-1 font-semibold">
        Proposed seller/provider commission ·{" "}
        {PROPOSED_MARKETPLACE_COMMISSION_PCT}%
        {estimate !== null
          ? " · " + priceKes(estimate)
          : " · amount requires a confirmed KES price"}
      </p>
      <p className="mt-1 text-muted-foreground">
        Illustration only, based on the advertised{" "}
        {intent === "rent" || intent === "lease"
          ? "single rental/lease period"
          : "price"}
        . Not added to the buyer price. Final basis, tax, provider agreement and
        payment activation pending; no commission is collected here.
      </p>
    </div>
  );
}

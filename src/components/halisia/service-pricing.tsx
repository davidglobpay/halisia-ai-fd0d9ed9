import { Link, useRouterState } from "@tanstack/react-router";
import { SERVICE_PRICES, pricesForPath, priceKes } from "@/lib/service-pricing";

export function ServicePricing({ all = false }: { all?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prices = all ? SERVICE_PRICES : pricesForPath(pathname);
  if (!all && pathname === "/financing")
    return (
      <section
        aria-label="Financing costs"
        className="relative mx-auto my-6 max-w-6xl px-4 pb-8"
      >
        <div className="glass rounded-2xl border border-primary/20 p-5">
          <h2 className="text-xl font-semibold">Financing enquiry · KES 0</h2>
          <p className="mt-2 text-sm">
            Submit an enquiry free. Loan interest, insurance premiums and lender
            charges are provided by the selected provider; a HALISIA enquiry is
            not loan approval.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Any future referral commission requires an agreed provider contract.
            Payment integration and live activation are pending.
          </p>
          <Link
            to="/pricing"
            className="mt-3 inline-block text-sm text-primary underline"
          >
            View HALISIA pricing
          </Link>
        </div>
      </section>
    );
  if (!prices.length) return null;
  return (
    <section
      aria-label="HALISIA service pricing"
      className="relative mx-auto my-6 max-w-6xl px-4 pb-8"
    >
      <div className="glass rounded-2xl border border-primary/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">
            Service pricing · Kenya pilot
          </h2>
          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium">
            Payment integration and live activation pending
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Suggested launch prices in KES. No charge is collected here. Current
          beta access stays free; paid benefits are activated only after
          delivery and billing are ready.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {prices.map((p) => (
            <article
              key={p.id}
              className="rounded-xl border border-border bg-background/70 p-4"
            >
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-1 text-xl font-semibold text-primary">
                {priceKes(p.amount)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {p.unit}
                </span>
              </p>
              <p className="mt-2 text-sm">{p.scope}</p>
              <p className="mt-2 text-xs text-muted-foreground">{p.free}</p>
              <p className="mt-2 text-xs">{p.readiness}</p>
              <button
                type="button"
                disabled
                className="mt-3 min-h-11 w-full rounded-xl border border-border px-3 text-sm opacity-60"
              >
                Paid activation pending
              </button>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          These are HALISIA service prices. Government charges, legal or survey
          fees, third-party work, travel and construction costs are separate.
          Final tax-inclusive payable totals must be confirmed before payment
          activation.
        </p>
        {!all && (
          <Link
            to="/pricing"
            className="mt-3 inline-block text-sm font-medium text-primary underline"
          >
            View all pricing and Scout costs
          </Link>
        )}
      </div>
    </section>
  );
}

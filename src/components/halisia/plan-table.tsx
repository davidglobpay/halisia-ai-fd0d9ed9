import { useState } from "react";
import { Check } from "lucide-react";
import {
  PLANS,
  BUNDLES,
  bundleListKes,
  bundleSavingKes,
  annualSavingKes,
  serviceById,
  priceKes,
  priceUsd,
  type Plan,
  type Bundle,
} from "@/lib/service-pricing";

type Currency = "KES" | "USD";
type Term = "monthly" | "annual";

/**
 * Plans and packages.
 *
 * The currency switch is the only reason this component holds state. A buyer
 * in Nairobi pays by M-Pesa in shillings and a buyer in Boston pays by card in
 * dollars, and the two prices are set separately rather than converted, so the
 * page has to be able to show either without implying one is the other. The
 * note under the switch says so in as many words; it is not a disclaimer to be
 * trimmed later.
 */
export function PlanTable() {
  const [currency, setCurrency] = useState<Currency>("KES");
  const [term, setTerm] = useState<Term>("monthly");
  const kes = currency === "KES";

  const planPrice = (p: Plan) => {
    if (p.quoteOnly) return kes ? priceKes(p.annualKes) : priceUsd(p.annualUsd);
    if (p.monthlyKes === 0) return kes ? priceKes(0) : priceUsd(0);
    if (term === "annual") return kes ? priceKes(p.annualKes) : priceUsd(p.annualUsd);
    return kes ? priceKes(p.monthlyKes) : priceUsd(p.monthlyUsd);
  };
  const planUnit = (p: Plan) => {
    if (p.quoteOnly) return "a year, from — by agreement";
    if (p.monthlyKes === 0) return "always";
    return term === "annual" ? "a year" : "a month";
  };

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">
          Plans · pick the one that matches how often you look
        </h2>
        <div className="flex flex-wrap gap-2">
          <div
            role="group"
            aria-label="Currency"
            className="glass inline-flex rounded-full p-1"
          >
            {(["KES", "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={currency === c}
                onClick={() => setCurrency(c)}
                className={`min-h-11 rounded-full px-4 text-sm ${
                  currency === c
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {c === "KES" ? "KES · M-Pesa" : "USD · card"}
              </button>
            ))}
          </div>
          <div
            role="group"
            aria-label="Billing term"
            className="glass inline-flex rounded-full p-1"
          >
            {(["monthly", "annual"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={term === t}
                onClick={() => setTerm(t)}
                className={`min-h-11 rounded-full px-4 text-sm ${
                  term === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {t === "monthly" ? "Monthly" : "Yearly · 2 months free"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Paying for a year costs ten months. USD prices are set separately for
        payment by card from outside Kenya and are not a live conversion of the
        shilling price; card settlement costs more than M-Pesa and the
        difference is in the price rather than hidden in a rate. Payment
        integration and live activation are pending, so no plan can be bought
        yet and nothing that is free today becomes paid.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PLANS.map((p) => {
          const saving = annualSavingKes(p);
          return (
            <article
              key={p.id}
              className={`rounded-2xl border p-5 ${
                p.id === "plus"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-background/70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                {p.id === "plus" && (
                  <span className="rounded-full bg-primary/15 px-2 py-1 text-[11px] font-medium">
                    Most people start here
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.audience}</p>
              <p className="mt-3 text-2xl font-semibold text-primary">
                {p.quoteOnly && (
                  <span className="text-sm font-normal text-muted-foreground">
                    from{" "}
                  </span>
                )}
                {planPrice(p)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {planUnit(p)}
                </span>
              </p>
              {term === "annual" && saving > 0 && kes && (
                <p className="text-xs text-primary">
                  Saves {priceKes(saving)} against paying monthly
                </p>
              )}
              <ul className="mt-4 grid gap-2 text-sm">
                {p.includes.map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {p.readiness}
              </p>
              <button
                type="button"
                disabled
                className="mt-4 min-h-11 w-full rounded-xl border border-border px-3 text-sm opacity-60"
              >
                {p.monthlyKes === 0 && !p.quoteOnly
                  ? "Available now — nothing to pay"
                  : p.quoteOnly
                    ? "Talk to us — activation pending"
                    : "Paid activation pending"}
              </button>
            </article>
          );
        })}
      </div>

      <h2 className="mt-14 font-display text-2xl font-semibold">
        Packages · the same reports, bought together
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Every package is built from the individual reports listed below it, at
        less than the sum of their prices. The saving shown is the difference
        between the package price and those reports bought one at a time.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {BUNDLES.map((b: Bundle) => (
          <article
            key={b.id}
            className="rounded-2xl border border-border bg-background/70 p-5"
          >
            <h3 className="font-display text-lg font-semibold">{b.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{b.audience}</p>
            <p className="mt-3 text-2xl font-semibold text-primary">
              {kes ? priceKes(b.amountKes) : priceUsd(b.amountUsd)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                once
              </span>
            </p>
            {kes && (
              <p className="text-xs">
                <span className="text-muted-foreground line-through">
                  {priceKes(bundleListKes(b))}
                </span>{" "}
                <span className="text-primary">
                  saves {priceKes(bundleSavingKes(b))}
                </span>
              </p>
            )}
            <ul className="mt-4 grid gap-2 text-sm">
              {b.includes.map((id) => {
                const s = serviceById(id);
                if (!s) return null;
                return (
                  <li key={id} className="flex justify-between gap-2">
                    <span>{s.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {priceKes(s.amount)}
                    </span>
                  </li>
                );
              })}
              {(b.extras ?? []).map((e) => (
                <li key={e.label} className="flex justify-between gap-2">
                  <span>{e.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {priceKes(e.kes)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{b.readiness}</p>
            <button
              type="button"
              disabled
              className="mt-4 min-h-11 w-full rounded-xl border border-border px-3 text-sm opacity-60"
            >
              Paid activation pending
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

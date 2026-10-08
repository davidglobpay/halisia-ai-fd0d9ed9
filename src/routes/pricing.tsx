import { createFileRoute, Link } from "@tanstack/react-router";
import { ServicePricing } from "@/components/halisia/service-pricing";
import { PlanTable } from "@/components/halisia/plan-table";
import { SCOUT_TASKS, previewQuote } from "@/lib/scout-pricing";
import {
  priceKes,
  planById,
  PLANS,
  lowestOneOffKes,
  lowestBundleKes,
  lowestPaidPlanMonthlyKes,
  type PlanId,
} from "@/lib/service-pricing";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/pricing")({
  // The figures in the description are read from the pricing module for the
  // same reason the figures on the page are: a number typed into a meta tag is
  // a number nobody remembers to update.
  head: () => {
    const summary =
      `Free location profiles, reports from ${priceKes(lowestOneOffKes())}, ` +
      `packages from ${priceKes(lowestBundleKes())} and plans from ` +
      `${priceKes(lowestPaidPlanMonthlyKes())} a month. ` +
      `Payment integration and live activation are pending.`;
    return {
      meta: [
        { title: "Pricing — HALISIA" },
        { name: "description", content: summary },
        { property: "og:title", content: "Pricing — HALISIA" },
        { property: "og:description", content: summary },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: PricingPage,
});

const monthly = (id: PlanId) => priceKes(planById(id)?.monthlyKes ?? 0);

/** Who the page is for, in the order a visitor is likely to recognise
 * themselves. Each one points at a section further down rather than at a
 * different price list, so nobody has to wonder whether they are being quoted
 * a different number from the person next to them. Every figure is read from
 * the pricing module; none is typed in here. */
const AUDIENCES = [
  {
    id: "free",
    label: "Just looking",
    line: "Read any place in Kenya. Costs nothing, now or later.",
  },
  {
    id: "plans",
    label: "Buying a plot or a home",
    line: `A plan from ${monthly("plus")} a month, or a package from ${priceKes(
      lowestBundleKes(),
    )}.`,
  },
  {
    id: "plans",
    label: "Buying from abroad",
    line: "Priced in USD, with a Scout credit so somebody stands on the plot.",
  },
  {
    id: "services",
    label: "Selling or letting",
    line: "Brochure packs and featured placement, or Seller Pro.",
  },
  {
    id: "plans",
    label: "Agent, architect or valuer",
    line: `Report credits and seats, from ${monthly("pro")} a month.`,
  },
  {
    id: "plans",
    label: "County, bank or SACCO",
    line: "An institutional licence, scoped and priced by agreement.",
  },
] as const;

function PricingPage() {
  const catalog = useQuery({
    queryKey: ["scout-catalog"],
    queryFn: async () => {
      const r = await supabase
        .from("scout_price_catalog")
        .select("*")
        .order("sort");
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
  });
  const base = previewQuote({}, "easy", 0, catalog.data);
  const tasks = SCOUT_TASKS.filter(
    (t) =>
      !catalog.data || catalog.data.some((c) => c.code === t.code && c.active),
  );
  const full = previewQuote(
    Object.fromEntries(tasks.map((t) => [t.code, "check" as const])),
    "easy",
    0,
    catalog.data,
  );
  const free = planById("free");

  return (
    <main className="relative mx-auto max-w-6xl pt-24 pb-20">
      <header className="px-4">
        <h1 className="font-display text-3xl font-semibold">
          Clear prices. Start free.
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Explore locations, read available evidence, browse properties and
          preview concepts with current free beta tools. Paid service prices are
          visible ahead of payment integration and live activation. Nothing that
          is free today becomes paid.
        </p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <li key={a.label}>
              <a
                href={"#" + a.id}
                className="glass block h-full rounded-xl p-3 transition hover:border-primary/40"
              >
                <span className="text-sm font-medium">{a.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {a.line}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </header>

      <section id="free" className="mt-12 px-4" aria-label="What stays free">
        <div className="glass rounded-2xl border border-primary/20 p-5">
          <h2 className="font-display text-xl font-semibold">
            Free · {priceKes(0)}, with no card and no expiry
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This is the majority of HALISIA and it is not a trial.
          </p>
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {(free?.includes ?? []).map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
        </div>
      </section>

      <div id="plans" className="mt-14">
        <PlanTable />
      </div>

      <div id="services" className="mt-14">
        <h2 className="mx-auto max-w-6xl px-4 font-display text-2xl font-semibold">
          One at a time · no plan needed
        </h2>
        <p className="mx-auto mt-2 max-w-6xl px-4 text-sm text-muted-foreground">
          Every report can be bought on its own. The cheapest is{" "}
          {priceKes(lowestOneOffKes())}, which is less than the government
          search fee it sits alongside and is not a substitute for it.
        </p>
        <ServicePricing all only="one_off" />
      </div>

      <section
        className="glass mx-4 rounded-2xl border border-primary/20 p-5"
        aria-label="Scout pricing"
      >
        <h2 className="text-xl font-semibold">
          Send a Scout · ground evidence
        </h2>
        <p className="mt-2 text-sm">
          Field observation with photos and video. Ownership and surveyed
          boundaries remain unverified.
        </p>
        <p className="mt-3 text-lg font-semibold">
          Basic {priceKes(base.totalKes)} · Full checklist{" "}
          {priceKes(full.totalKes)}
        </p>
        <p className="text-xs text-muted-foreground">
          {catalog.data
            ? "Current database catalogue"
            : "Suggested pilot prices — awaiting catalogue confirmation"}{" "}
          · travel and access extra
        </p>
        {catalog.error && (
          <p role="alert" className="mt-2 text-sm">
            Current Scout prices could not load.{" "}
            <button
              className="underline"
              onClick={() => void catalog.refetch()}
            >
              Retry
            </button>
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt>Base visit · 8 photos + 1 short video</dt>
          <dd className="text-right">{priceKes(base.baseKes)}</dd>
          {tasks.map((t) => (
            <div key={t.code} className="contents">
              <dt>{t.label}</dt>
              <dd className="text-right">
                {priceKes(
                  catalog.data?.find((c) => c.code === t.code)?.amount_kes ??
                    t.kes,
                )}
              </dd>
            </div>
          ))}
          <dt>HALISIA fee on scout work</dt>
          <dd className="text-right">{base.feePct}%</dd>
          <dt>Difficult access</dt>
          <dd className="text-right">
            {priceKes(
              catalog.data?.find((c) => c.code === "access_difficult")
                ?.amount_kes ?? 500,
            )}
          </dd>
          <dt>Remote access</dt>
          <dd className="text-right">
            {priceKes(
              catalog.data?.find((c) => c.code === "access_remote")
                ?.amount_kes ?? 1500,
            )}
          </dd>
          <dt>Travel</dt>
          <dd className="text-right">At cost, confirmed in quote</dd>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Check and Unsure both request work and are charged once. The server
          confirms the final quote. A Scout visit is quoted and settled in
          shillings whatever country you are paying from, so there is no second
          USD price here; a card issuer applies its own rate. Payment
          integration and live activation are pending; quotes can be requested
          now. Paid dispatch also requires an approved scout and configured
          payment instructions.
        </p>
        <Link
          to="/scout"
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-primary-foreground"
        >
          Build a Scout quote
        </Link>
      </section>

      <section className="mx-4 mt-10" aria-label="What a price here is not">
        <div className="rounded-2xl border border-border p-5">
          <h2 className="font-display text-xl font-semibold">
            What these prices are not
          </h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <li>
              · They are HALISIA's own prices. Government search and transfer
              charges, advocates' fees under the Advocates Remuneration Order,
              registered valuers' fees and licensed surveyors' fees are set by
              others and are payable separately.
            </li>
            <li>
              · Paying HALISIA does not confirm title, ownership or a surveyed
              boundary, and no plan or package changes that. Reports describe
              available evidence, name every source and state what is missing.
            </li>
            <li>
              · A paid report is not legal, valuation or engineering advice, and
              it does not replace a search at the registry, an advocate, a
              valuer or a licensed surveyor.
            </li>
            <li>
              · No price here is an offer of insurance, indemnity or
              compensation, and HALISIA does not underwrite a transaction.
            </li>
            <li>
              · Prices are the suggested pilot tariff. Final tax-inclusive
              payable totals must be confirmed before payment activation.
            </li>
          </ul>
        </div>
      </section>

      <p className="mx-4 mt-5 text-sm text-muted-foreground">
        Financing enquiries are free. Any lender interest, insurance premium,
        property price or professional fee is quoted by the provider; HALISIA
        does not invent those amounts. Referral commissions require an agreed
        provider contract before activation.
      </p>
      <p className="mx-4 mt-3 text-xs text-muted-foreground">
        {PLANS.length} plans and {SCOUT_TASKS.length} Scout checks are listed on
        this page. Every figure shown is read from one table in the application
        source, so a price here and a price on any other page cannot disagree.
      </p>
    </main>
  );
}

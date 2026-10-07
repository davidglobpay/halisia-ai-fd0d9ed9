import { createFileRoute, Link } from "@tanstack/react-router";
import { ServicePricing } from "@/components/halisia/service-pricing";
import { SCOUT_TASKS, previewQuote } from "@/lib/scout-pricing";
import { priceKes } from "@/lib/service-pricing";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HALISIA" },
      {
        name: "description",
        content:
          "HALISIA pilot pricing, free beta tools and payment activation status.",
      },
    ],
  }),
  component: PricingPage,
});
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
  return (
    <main className="relative mx-auto max-w-6xl pt-24 pb-20">
      <header className="px-4">
        <h1 className="font-display text-3xl font-semibold">
          Clear prices. Start free.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Explore locations, read available evidence, browse properties and
          preview concepts with current free beta tools. Paid service prices are
          visible ahead of payment integration and live activation.
        </p>
      </header>
      <ServicePricing all />
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
          confirms the final quote. Payment integration and live activation are
          pending; quotes can be requested now. Paid dispatch also requires an
          approved scout and configured payment instructions.
        </p>
        <Link
          to="/scout"
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-primary-foreground"
        >
          Build a Scout quote
        </Link>
      </section>
      <p className="mx-4 mt-5 text-sm text-muted-foreground">
        Financing enquiries are free. Any lender interest, insurance premium,
        property price or professional fee is quoted by the provider; HALISIA
        does not invent those amounts. Referral commissions require an agreed
        provider contract before activation.
      </p>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  CircleAlert,
  Clock,
  FileSearch,
  Gavel,
  Landmark,
  ScrollText,
  Stamp,
} from "lucide-react";

/**
 * What it actually costs and how long it actually takes to transfer land in
 * Kenya.
 *
 * Two numbers exist for every step. The State Department for Lands Service
 * Charter commits to one — three days to register a transfer. Practitioners
 * observe another — two to twelve weeks. Every law firm's guide publishes the
 * charter figure. This page publishes both and says which is which, because a
 * buyer who budgets three days and waits ten weeks has been misled by a
 * document that was technically accurate.
 *
 * Fees are the gazetted amounts in the Service Charter (April 2025). They
 * change. Nothing here is legal advice and nothing here is a quotation.
 */

export const Route = createFileRoute("/land-transfer")({
  head: () => ({
    meta: [
      { title: "What a land transfer really costs — HALISIA.AI" },
      {
        name: "description",
        content:
          "Official fees, stamp duty and the timeline practitioners actually observe for transferring land in Kenya — alongside the timeline the Service Charter commits to.",
      },
      { property: "og:title", content: "What a land transfer really costs — HALISIA.AI" },
      {
        property: "og:description",
        content:
          "Every fee in a Kenyan land transfer, the charter timeline, and the timeline people actually wait.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandTransferPage,
});

/* ---------------- fee model ---------------- */

const FEES = {
  search: 1_000,
  registration: 1_000,
  titleDeed: 2_500,
  lcbOrdinary: 3_000,
  lcbSpecial: 10_000,
} as const;

const STAMP_DUTY_URBAN = 0.04;
const STAMP_DUTY_RURAL = 0.02;

const ksh = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });
const fmt = (n: number) => `KES ${ksh.format(Math.round(n))}`;

type Zone = "urban" | "rural";

/* ---------------- the chain ---------------- */

type Stage = {
  icon: typeof FileSearch;
  title: string;
  who: string;
  charter: string;
  observed: string;
  body: string;
  agriculturalOnly?: boolean;
};

const STAGES: Stage[] = [
  {
    icon: FileSearch,
    title: "Official search",
    who: "Land Registrar",
    charter: "1 day",
    observed: "Same day on Ardhisasa where the registry is live",
    body: "Confirms who is registered and what is noted against the parcel. On Ardhisasa the registered owner must approve the request by SMS before results are released, so a seller who is not registered — or who simply does not respond — blocks the search entirely.",
  },
  {
    icon: ScrollText,
    title: "Sale agreement and KRA clearance",
    who: "Advocates for both parties",
    charter: "—",
    observed: "1–3 weeks",
    body: "Drafting, negotiation and the tax clearances each side needs before anything can be lodged.",
  },
  {
    icon: Landmark,
    title: "Valuation for stamp duty",
    who: "Government Valuer",
    charter: "8 days · no fee",
    observed: "2–6 weeks",
    body: "The valuer's assessment, not the price on the agreement, is what stamp duty is calculated on. Valuations now run through Ardhisasa nationwide.",
  },
  {
    icon: Gavel,
    title: "Land Control Board consent",
    who: "The county Land Control Board",
    charter: "30 days",
    observed: "2–12+ weeks",
    body: "Required for agricultural land. Boards meet infrequently and this is the single largest bottleneck in the chain — the gap between the charter's thirty days and what people wait is wider here than anywhere else.",
    agriculturalOnly: true,
  },
  {
    icon: Stamp,
    title: "Stamp duty payment",
    who: "You, through iTax",
    charter: "Due within 30 days of assessment",
    observed: "—",
    body: "Unpaid stamp duty makes the transaction null, void and inadmissible in court. A penalty of 5% accrues quarterly. This is the step most likely to quietly destroy a deal years later.",
  },
  {
    icon: Banknote,
    title: "Registration and new title",
    who: "Land Registrar",
    charter: "3 days",
    observed: "2–12 weeks",
    body: "Lodgement, registration of the instrument and issue of the title in the buyer's name. All payments go through ArdhiPay; cash is not accepted.",
  },
];

/* ---------------- page ---------------- */

function LandTransferPage() {
  const [valueInput, setValueInput] = useState("5000000");
  const [zone, setZone] = useState<Zone>("urban");
  const [agricultural, setAgricultural] = useState(false);

  const value = useMemo(() => {
    const n = Number(valueInput.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [valueInput]);

  const stampRate = zone === "urban" ? STAMP_DUTY_URBAN : STAMP_DUTY_RURAL;
  const stampDuty = value * stampRate;
  const lcb = agricultural ? FEES.lcbOrdinary : 0;
  const registryFees = FEES.search + FEES.registration + FEES.titleDeed + lcb;
  const total = registryFees + stampDuty;

  const stages = STAGES.filter((s) => !s.agriculturalOnly || agricultural);

  return (
    <div className="min-h-screen pt-24 pb-24">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">
          Before you wire anything
        </div>
        <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
          What a land transfer{" "}
          <span className="text-gradient">actually costs, and actually takes</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground leading-relaxed">
          Every fee below is the gazetted amount in the State Department for Lands Service Charter
          of April 2025. Every timeline is given twice — what the charter commits to, and what
          practitioners observe. Most guides publish only the first.
        </p>

        {/* Calculator */}
        <section
          aria-label="Transfer cost estimate"
          className="glass-strong mt-10 rounded-3xl p-5 sm:p-6"
        >
          <div className="text-[10px] uppercase tracking-widest text-accent">Your numbers</div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label
                htmlFor="lt-value"
                className="block text-[11px] uppercase tracking-widest text-muted-foreground"
              >
                Assessed value
              </label>
              <input
                id="lt-value"
                inputMode="numeric"
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/10 px-3 py-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-describedby="lt-value-hint"
              />
              <p id="lt-value-hint" className="mt-1 text-[10px] text-muted-foreground">
                The government valuer's figure, not your purchase price.
              </p>
            </div>

            <fieldset className="sm:col-span-1">
              <legend className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Stamp duty band
              </legend>
              <div className="mt-1.5 flex gap-2">
                {(["urban", "rural"] as Zone[]).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZone(z)}
                    aria-pressed={zone === z}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs capitalize transition ${
                      zone === z
                        ? "border-accent/60 bg-accent/15 text-foreground font-medium"
                        : "border-white/12 text-muted-foreground hover:bg-white/5"
                    }`}
                  >
                    {z} · {z === "urban" ? "4%" : "2%"}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="sm:col-span-1">
              <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
                Agricultural land
              </span>
              <button
                type="button"
                onClick={() => setAgricultural((v) => !v)}
                aria-pressed={agricultural}
                className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-xs transition ${
                  agricultural
                    ? "border-accent/60 bg-accent/15 text-foreground font-medium"
                    : "border-white/12 text-muted-foreground hover:bg-white/5"
                }`}
              >
                {agricultural ? "Yes — board consent needed" : "No"}
              </button>
            </div>
          </div>

          {/* Breakdown */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Official fees for this transfer</caption>
              <tbody>
                <Row label="Official search" value={fmt(FEES.search)} />
                <Row label="Valuation for stamp duty" value="No fee" />
                {agricultural && (
                  <Row
                    label="Land Control Board consent (ordinary)"
                    value={fmt(FEES.lcbOrdinary)}
                    note={`A special meeting is ${fmt(FEES.lcbSpecial)}`}
                  />
                )}
                <Row label="Registration of transfer" value={fmt(FEES.registration)} />
                <Row label="New title deed" value={fmt(FEES.titleDeed)} />
                <Row
                  label={`Stamp duty at ${zone === "urban" ? "4%" : "2%"}`}
                  value={value > 0 ? fmt(stampDuty) : "—"}
                  note="Paid through iTax within 30 days of assessment"
                />
              </tbody>
              <tfoot>
                <tr className="border-t border-white/15">
                  <th scope="row" className="py-3 text-left font-semibold">
                    Official cost
                  </th>
                  <td className="py-3 text-right text-lg font-semibold tabular-nums text-accent">
                    {value > 0 ? fmt(total) : fmt(registryFees)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
            Advocate's fees, the surveyor, and anything a broker charges are separate and are not
            gazetted. Stamp duty dominates the total at almost any value — on the figure above it is{" "}
            {value > 0 ? `${Math.round((stampDuty / total) * 100)}%` : "most"} of it.
          </p>
        </section>

        {/* The two clocks */}
        <section aria-label="Transfer timeline" className="mt-12">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h2 className="text-2xl font-semibold tracking-tight">The chain, step by step</h2>
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-accent" /> Two clocks per step
            </div>
          </div>

          <ol className="mt-6 space-y-3">
            {stages.map((s, i) => (
              <li key={s.title} className="glass rounded-3xl p-4 sm:p-5 relative overflow-hidden">
                <div className="absolute top-3 right-5 text-4xl font-semibold text-white/5 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-2xl bg-white/5 border border-white/10 grid place-items-center">
                    <s.icon className="h-4 w-4 text-accent" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold leading-tight">{s.title}</h3>
                    <div className="mt-0.5 text-[11px] uppercase tracking-widest text-muted-foreground">
                      {s.who}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full border border-white/12 px-2.5 py-1 text-muted-foreground">
                        Charter: {s.charter}
                      </span>
                      <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-foreground">
                        Observed: {s.observed}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="glass-strong mt-4 rounded-3xl p-5">
            <div className="text-[10px] uppercase tracking-widest text-accent">
              End to end, in practice
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-2xl font-semibold tabular-nums">4–8 weeks</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Simple urban residential, nothing contested, no board consent.
                </p>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">2–6+ months</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Agricultural land, or anywhere a consent has to be obtained.
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
              Stages overlap in practice, so these totals are shorter than the sum of the ranges
              above. They are what practitioners report, not a commitment by anyone.
            </p>
          </div>
        </section>

        {/* Things that stop a transfer dead */}
        <section aria-label="Common blockers" className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">What stops a transfer dead</h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Blocker title="The title was never converted">
              Since 16 May 2022 no transaction can proceed on land still registered under the
              repealed regimes unless the title has been converted to the Land Registration Act
              2012 system. Conversion lists are gazetted with 90-day objection windows.
              Unconverted titles are frozen and sit outside Ardhisasa entirely.
            </Blocker>

            <Blocker title="The seller will not approve the search">
              An Ardhisasa search releases results only after the registered owner approves the
              request. If the owner is not registered, has not claimed the parcel, or simply does
              not respond, there is no search to run.
            </Blocker>

            <Blocker title="The board has not met">
              Land Control Board consent is the longest single wait in the chain for agricultural
              land, and nothing downstream of it can start.
            </Blocker>

            <Blocker title="A clean search is not a clean title">
              A search reports what the register says. It does not open the physical file behind
              the registration, and it does not look at court judgments or gazette notices. Titles
              registered on forged instruments return clean searches.
            </Blocker>
          </div>
        </section>

        {/* Honesty block */}
        <section className="mt-12 rounded-3xl border border-dashed border-white/15 p-5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" /> What this page is not
          </div>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            This is not legal advice and HALISIA is not a law firm. Fees are the gazetted amounts
            published in the Service Charter of April 2025 and they change — confirm the current
            rate before you pay anything. Observed timelines are what practitioners report, not a
            promise. Use an advocate for the transaction itself.
          </p>
        </section>

        {/* Onward */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/title-deed"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium px-5 py-2.5 text-sm shadow-[0_10px_40px_-10px_rgba(20,123,53,0.55)]"
          >
            Check a title reference <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link to="/explore" className="glass rounded-full px-5 py-2.5 text-sm">
            Read a location first
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------- small pieces ---------------- */

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <tr className="border-b border-white/8">
      <th scope="row" className="py-2.5 text-left font-normal text-muted-foreground">
        {label}
        {note && <span className="block text-[10px] text-muted-foreground/70">{note}</span>}
      </th>
      <td className="py-2.5 text-right tabular-nums">{value}</td>
    </tr>
  );
}

function Blocker({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glass rounded-3xl p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

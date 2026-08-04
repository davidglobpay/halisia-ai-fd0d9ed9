import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, X as XIcon } from "lucide-react";
import { KENYA_COUNTY_FACTS, KENYA_COAT_OF_ARMS } from "@/lib/kenya-county-facts";
import { COUNTY_LOGOS } from "@/lib/county-logos";
import { dataConfidencePct } from "@/lib/county-profile";
import { getCountyPolitics } from "@/lib/county-politics";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Counties — HALISIA.AI" },
      {
        name: "description",
        content:
          "Side-by-side comparison of your saved Kenyan counties: emblem, data confidence, key statistics, leadership and voter turnout.",
      },
      { property: "og:title", content: "Compare Counties — HALISIA.AI" },
      {
        property: "og:description",
        content: "Side-by-side county comparison from your persistent selection.",
      },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const [codes, setCodes] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      const url = new URLSearchParams(window.location.search).get("compare");
      const parse = (raw: string | null) =>
        (raw ?? "")
          .split(",")
          .map((n) => parseInt(n, 10))
          .filter((n) => Number.isFinite(n) && KENYA_COUNTY_FACTS[n])
          .slice(0, 4);
      const initial = parse(url);
      if (initial.length) {
        setCodes(initial);
        return;
      }
      const stored = window.localStorage.getItem("halisia.compare.v1");
      setCodes(parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  function remove(code: number) {
    setCodes((prev) => {
      const next = prev.filter((c) => c !== code);
      try {
        if (next.length) window.localStorage.setItem("halisia.compare.v1", next.join(","));
        else window.localStorage.removeItem("halisia.compare.v1");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function clearAll() {
    setCodes([]);
    try {
      window.localStorage.removeItem("halisia.compare.v1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 pt-24 pb-10">
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to counties
        </Link>

        <header className="mt-4 flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">County Comparison</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Persistent selection · {codes.length} of 4 counties
            </p>
          </div>
          {codes.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Clear all
            </button>
          )}
        </header>

        {hydrated && codes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {codes.map((code) => (
              <CompareCard key={code} code={code} onRemove={() => remove(code)} />
            ))}
          </div>
        )}

        {codes.length >= 2 && <SummaryTable codes={codes} />}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
      <div className="text-lg font-medium">No counties selected yet</div>
      <p className="mt-2 text-sm text-muted-foreground">
        Open the counties grid and use the “Compare” pill on each tile. Selections persist here
        automatically.
      </p>
      <Link
        to="/explore"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm text-black hover:bg-accent/90"
      >
        Browse counties
      </Link>
    </div>
  );
}

function CompareCard({ code, onRemove }: { code: number; onRemove: () => void }) {
  const facts = KENYA_COUNTY_FACTS[code];
  if (!facts) return null;
  const politics = getCountyPolitics(code);
  const confidence = dataConfidencePct(code);
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/5 p-4">
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${facts.name} from comparison`}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-muted-foreground hover:text-foreground"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
      <div className="flex flex-col items-center text-center">
        <span className="text-[10px] uppercase tracking-widest text-accent">
          County {String(facts.code).padStart(3, "0")}
        </span>
        <img
          src={COUNTY_LOGOS[facts.code] ?? KENYA_COAT_OF_ARMS}
          alt={`${facts.name} County emblem`}
          referrerPolicy="no-referrer"
          className="mt-2 h-20 w-20 rounded-full bg-white object-contain p-1.5 ring-1 ring-white/20 shadow-md"
        />
        <div className="mt-2 text-sm font-bold tracking-wide uppercase">{facts.name}</div>
        <div className="text-[11px] text-muted-foreground">{facts.region}</div>
      </div>

      <dl className="mt-4 space-y-2 text-xs">
        <Row label="Confidence" value={`${confidence}%`} />
        <Row label="Population (2019)" value={facts.population2019.toLocaleString()} />
        <Row label="Area" value={`${facts.areaKm2.toLocaleString()} km²`} />
        <Row label="Constituencies" value={String(facts.constituencies)} />
        <Row label="Governor" value={facts.governor} />
        {politics && (
          <>
            <Row label="Coalition" value={politics.coalition} />
            <Row
              label="2022 turnout"
              value={
                politics.history.find((h) => h.year === 2022)?.turnoutPct != null
                  ? `${politics.history.find((h) => h.year === 2022)!.turnoutPct}%`
                  : "—"
              }
            />
            <Row label="Opinion index" value={`${politics.publicOpinion.overall}/100`} />
          </>
        )}
      </dl>

      <Link
        to="/county/$code"
        params={{ code: String(facts.code) }}
        search={{ compare: "" }}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-accent/40"
      >
        Open profile
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function SummaryTable({ codes }: { codes: number[] }) {
  const rows = codes.map((c) => KENYA_COUNTY_FACTS[c]).filter(Boolean);
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="border-b border-white/10 px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">
        Summary table
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">County</th>
              <th className="px-3 py-2 text-right">Population</th>
              <th className="px-3 py-2 text-right">Area (km²)</th>
              <th className="px-3 py-2 text-right">Confidence</th>
              <th className="px-3 py-2 text-right">Opinion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const pol = getCountyPolitics(f.code);
              return (
                <tr key={f.code} className="border-t border-white/5">
                  <td className="px-3 py-2 text-left">{f.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {f.population2019.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {f.areaKm2.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {dataConfidencePct(f.code)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pol ? `${pol.publicOpinion.overall}/100` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

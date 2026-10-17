import { SignInPrompt } from "@/components/halisia/sign-in-prompt";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, ArrowLeftRight, Loader2, Search, X, Minus, ArrowRight } from "lucide-react";
import { z } from "zod";
import { geocodeAddress } from "@/lib/geocode.functions";
import { getLocationIntel, type LocationIntel } from "@/lib/location-intel.functions";
import { generateNarrative, type NarrativeOutput } from "@/lib/ai-narrative.functions";
import {
  runIntelligenceEngine,
  PERSONAS,
  labelForPersona,
  type DecisionOutput,
  type ModuleOutput,
} from "@/lib/intelligence-engine";
import { useUserPersona } from "@/hooks/use-user-persona";

const searchSchema = z.object({
  a: z.string().optional(),
  b: z.string().optional(),
  aLabel: z.string().optional(),
  bLabel: z.string().optional(),
});

export const Route = createFileRoute("/compare-locations")({
  head: () => ({
    meta: [
      { title: "Compare Locations — HALISIA.AI" },
      {
        name: "description",
        content:
          "Compare the measured readings for two Kenyan locations side by side, and see which of them HALISIA can read at all.",
      },
      { property: "og:title", content: "Compare Locations — HALISIA.AI" },
      {
        property: "og:description",
        content: "Side-by-side location readings, with per-module deltas and what is not assessed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: searchSchema,
  component: CompareLocationsPage,
});

function parseCoord(raw?: string): { lat: number; lng: number } | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

type Resolved = { lat: number; lng: number; address: string };

function useResolved(raw: string | undefined, labelHint?: string) {
  return useQuery<Resolved | null>({
    queryKey: ["cmp-resolve", raw ?? ""],
    enabled: !!raw,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!raw) return null;
      const coord = parseCoord(raw);
      if (coord)
        return {
          ...coord,
          address: labelHint || `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`,
        };
      const res = await geocodeAddress({ data: { query: raw } });
      if (!res.ok) throw new Error(`Couldn't find “${raw}”`);
      return { lat: res.lat, lng: res.lng, address: res.address };
    },
  });
}

function useDecision(
  loc: Resolved | null | undefined,
  persona: ReturnType<typeof useUserPersona>[0],
) {
  const intelQ = useQuery<LocationIntel>({
    queryKey: ["cmp-intel", loc?.lat.toFixed(4), loc?.lng.toFixed(4)],
    enabled: !!loc,
    staleTime: 5 * 60 * 1000,
    queryFn: () => getLocationIntel({ data: { lat: loc!.lat, lng: loc!.lng } }),
  });
  const counts = intelQ.data
    ? {
        schools: intelQ.data.categories.schools.length,
        hospitals: intelQ.data.categories.hospitals.length,
        groceries: intelQ.data.categories.groceries.length,
        transit: intelQ.data.categories.transit.length,
        restaurants: intelQ.data.categories.restaurants.length,
        banks: intelQ.data.categories.banks.length,
      }
    : null;
  const narrativeQ = useQuery<NarrativeOutput>({
    queryKey: ["cmp-narr", loc?.lat.toFixed(4), loc?.lng.toFixed(4), counts],
    enabled: !!loc && !!counts,
    staleTime: 10 * 60 * 1000,
    queryFn: () =>
      generateNarrative({
        data: {
          address: loc!.address,
          lat: loc!.lat,
          lng: loc!.lng,
          elevationM: intelQ.data?.elevation?.meters ?? null,
          airQuality: intelQ.data?.airQuality
            ? {
                aqi: intelQ.data.airQuality.universalAqi,
                category: intelQ.data.airQuality.category,
                dominant: intelQ.data.airQuality.dominant,
              }
            : null,
          counts: counts!,
        },
      }),
  });
  const decision: DecisionOutput | null = useMemo(
    () =>
      loc && intelQ.data ? runIntelligenceEngine(intelQ.data, narrativeQ.data, persona) : null,
    [loc, intelQ.data, narrativeQ.data, persona],
  );
  return { decision, loading: intelQ.isLoading || narrativeQ.isLoading };
}

function CompareLocationsPage() {
  const params = Route.useSearch();
  const navigate = useNavigate();
  const [persona, setPersona] = useUserPersona();
  const [inputA, setInputA] = useState(params.a ?? "");
  const [inputB, setInputB] = useState(params.b ?? "");

  useEffect(() => {
    setInputA(params.a ?? "");
    setInputB(params.b ?? "");
  }, [params.a, params.b]);

  const applyParams = (a?: string, b?: string) => {
    navigate({
      to: "/compare-locations",
      search: { a: a || undefined, b: b || undefined },
      replace: true,
    });
  };

  const aQ = useResolved(params.a, params.aLabel);
  const bQ = useResolved(params.b, params.bLabel);
  const aDec = useDecision(aQ.data, persona);
  const bDec = useDecision(bQ.data, persona);

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    applyParams(inputA.trim(), inputB.trim());
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 pt-24 pb-16">
        <SignInPrompt feature="Location comparisons" className="mb-4" />
        <Link
          to="/explore"
          search={{ q: undefined }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Explore
        </Link>

        <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight inline-flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6 text-accent" />
              Compare two locations
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reads each location and compares the modules HALISIA can measure. Modules with no data
              behind them are shown as not assessed for both, never as a score.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Persona"
            className="flex flex-wrap items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1"
          >
            {PERSONAS.map((p) => {
              const active = persona === p.id;
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPersona(p.id)}
                  title={p.hint}
                  className={`px-2.5 h-7 rounded-full text-[11px] font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </header>

        <form
          onSubmit={submitForm}
          className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end rounded-2xl border border-white/10 bg-white/5 p-3"
          data-testid="cmp-form"
        >
          <Field
            label="Location A"
            value={inputA}
            onChange={setInputA}
            placeholder="e.g. Kilimani, Nairobi or -1.29,36.82"
            testid="cmp-input-a"
          />
          <Field
            label="Location B"
            value={inputB}
            onChange={setInputB}
            placeholder="e.g. Kileleshwa or Nakuru"
            testid="cmp-input-b"
          />
          <button
            type="submit"
            data-testid="cmp-run"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-2 text-sm font-medium shadow"
          >
            <Search className="h-4 w-4" /> Compare
          </button>
        </form>

        {(!params.a || !params.b) && (
          <p className="mt-4 text-sm text-muted-foreground">
            Enter two locations to see their readings side by side.
          </p>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <LocationColumn label="A" query={aQ} decision={aDec.decision} loading={aDec.loading} />
          <LocationColumn label="B" query={bQ} decision={bDec.decision} loading={bDec.loading} />
        </div>

        {aDec.decision && bDec.decision && (
          <DeltaTable a={aDec.decision} b={bDec.decision} persona={labelForPersona(persona)} />
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  testid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  testid: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
        <input
          data-testid={testid}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm focus-visible:outline-none"
        />
        {value && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => onChange("")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </label>
  );
}

function tone(score: number) {
  if (score >= 75) return { ring: "#22c55e", text: "text-emerald-glow" };
  if (score >= 60) return { ring: "#62e9ff", text: "text-cyan-glow" };
  if (score >= 45) return { ring: "#d4a017", text: "text-amber-glow" };
  return { ring: "#ef4444", text: "text-destructive" };
}

function LocationColumn({
  label,
  query,
  decision,
  loading,
}: {
  label: string;
  query: ReturnType<typeof useResolved>;
  decision: DecisionOutput | null;
  loading: boolean;
}) {
  const busy = query.isLoading || loading;
  if (query.isError) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
        <div className="text-xs uppercase tracking-widest text-destructive">Location {label}</div>
        <div className="mt-1 text-sm">
          {(query.error as Error).message || "Couldn't resolve this location."}
        </div>
      </div>
    );
  }
  if (!query.data && !busy) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-muted-foreground">
        Location {label} not set.
      </div>
    );
  }
  const loc = query.data;
  const hasReading = decision?.reading != null;
  const t = hasReading ? tone(decision!.reading!) : null;
  return (
    <section
      aria-label={`Location ${label} intelligence`}
      data-testid={`cmp-col-${label.toLowerCase()}`}
      className="glass-strong rounded-3xl p-4"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-accent">Location {label}</span>
        {busy && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
      </div>
      <div className="mt-1 text-sm font-medium truncate" title={loc?.address}>
        {loc?.address ?? "Resolving…"}
      </div>
      {loc && (
        <div className="text-[11px] text-muted-foreground">
          {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
        </div>
      )}

      {decision ? (
        <>
          <div className="mt-4 flex items-center gap-3">
            <div
              className="h-20 w-20 rounded-full grid place-items-center shrink-0"
              style={{
                background:
                  hasReading && t
                    ? `conic-gradient(${t.ring} ${decision.reading! * 3.6}deg, rgba(255,255,255,0.08) 0deg)`
                    : "rgba(255,255,255,0.06)",
              }}
            >
              <div className="h-16 w-16 rounded-full grid place-items-center bg-background/90">
                <div className="text-center">
                  <div
                    className={`text-xl font-bold tabular-nums ${t ? t.text : "text-muted-foreground"}`}
                  >
                    {hasReading ? decision.reading : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground -mt-0.5">
                    {decision.grade ? `Grade ${decision.grade}` : "No reading"}
                  </div>
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <div
                className={`text-sm font-semibold ${t ? t.text : "text-muted-foreground"} leading-snug`}
              >
                {decision.readingLabel}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {decision.measuredCount} measured · {decision.projectedCount} projected ·{" "}
                {decision.notAssessedCount} not assessed
                {decision.confidencePct != null && ` · confidence ${decision.confidencePct}%`}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Read {new Date(decision.freshness).toLocaleString()}
              </div>
            </div>
          </div>
          <ul className="mt-3 grid gap-1 text-[12px]">
            {decision.modules.map((m) => (
              <li
                key={m.id}
                className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 ${
                  m.score != null
                    ? "border-white/5 bg-white/[0.02]"
                    : "border-dashed border-white/10 bg-transparent text-muted-foreground"
                }`}
              >
                <span className="truncate">{m.label}</span>
                <span className="tabular-nums font-medium">
                  {m.score != null
                    ? m.score
                    : m.status === "projected"
                      ? "Projected"
                      : "Not assessed"}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading this location…
        </div>
      )}
    </section>
  );
}

function DeltaTable({ a, b, persona }: { a: DecisionOutput; b: DecisionOutput; persona: string }) {
  const bMap = new Map(b.modules.map((m) => [m.id, m]));
  type Row = { a: ModuleOutput; b: ModuleOutput; delta: number };

  // Only a module measured at BOTH locations can be differenced. Subtracting
  // a missing reading from a present one would manufacture a delta.
  const rows: Row[] = a.modules
    .map((am) => {
      const bm = bMap.get(am.id);
      if (!bm || am.score == null || bm.score == null) return null;
      return { a: am, b: bm, delta: am.score - bm.score };
    })
    .filter((r): r is Row => !!r)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  const notComparable = a.modules.filter((am) => {
    const bm = bMap.get(am.id);
    return am.score == null || bm?.score == null;
  });

  const bothHaveReading = a.reading != null && b.reading != null;
  const readingDelta = bothHaveReading ? a.reading! - b.reading! : null;
  const ahead =
    readingDelta == null ? null : readingDelta > 0 ? "A" : readingDelta < 0 ? "B" : "Level";

  return (
    <section
      data-testid="cmp-delta"
      aria-label="Difference between locations"
      className="mt-6 glass-strong rounded-3xl p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">What differs between the readings</h2>
        <div className="text-[11px] text-muted-foreground">
          Weighted for {persona} ·{" "}
          {ahead == null ? (
            <span className="font-semibold text-foreground">no comparable reading</span>
          ) : (
            <span className="font-semibold text-foreground">
              {ahead === "Level"
                ? "Level"
                : `${ahead} reads higher (${readingDelta! > 0 ? "+" : ""}${readingDelta} pts)`}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">Module</th>
              <th className="px-2 py-2 text-right">A</th>
              <th className="px-2 py-2 text-right">B</th>
              <th className="px-2 py-2 text-right">Δ</th>
              <th className="px-2 py-2 text-left">Driver</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cls =
                r.delta > 0
                  ? "text-emerald-glow"
                  : r.delta < 0
                    ? "text-destructive"
                    : "text-muted-foreground";
              const Icon = r.delta > 0 ? ArrowRight : r.delta < 0 ? ArrowLeft : Minus;
              const driver =
                r.delta === 0
                  ? "Same reading at both locations"
                  : r.delta > 0
                    ? r.a.reasons[0]
                    : r.b.reasons[0];
              return (
                <tr key={r.a.id} className="border-t border-white/5 align-top">
                  <td className="px-2 py-2 text-left font-medium">{r.a.label}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.a.score}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.b.score}</td>
                  <td className={`px-2 py-2 text-right tabular-nums font-semibold ${cls}`}>
                    <span className="inline-flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {r.delta > 0 ? "+" : ""}
                      {r.delta}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-left text-[12px] text-muted-foreground">
                    {driver}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {notComparable.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Not comparable — HALISIA holds no data for {notComparable.length} of {a.modules.length}{" "}
            modules at one or both locations
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {notComparable.map((m) => (
              <span
                key={m.id}
                className="rounded-full border border-dashed border-white/15 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {m.label}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            These are not scored at either location, so no difference can be computed. Each
            location's report lists what to check instead.
          </p>
        </div>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">
        Δ = A − B across the {rows.length} module{rows.length === 1 ? "" : "s"} measured at both
        locations. A higher reading is not a recommendation to buy. Read A:{" "}
        {new Date(a.freshness).toLocaleString()} · Read B: {new Date(b.freshness).toLocaleString()}.
      </p>
    </section>
  );
}

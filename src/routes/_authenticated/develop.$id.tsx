import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Building2, Gauge, Loader2, Sparkles } from "lucide-react";
import { getProperty, updateProperty } from "@/lib/properties";
import { generateDevelopmentConcept } from "@/lib/development-studio.functions";
import { CONCEPT_DISCLAIMER, type ConceptOutput } from "@/lib/development-studio";
import { assessReadiness, READINESS_DISCLAIMER } from "@/lib/investment-readiness";
import { listMyFinancing } from "@/lib/financing";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/develop/$id")({
  head: () => ({
    meta: [
      { title: "Development studio & investment readiness · HALISIA AI" },
      {
        name: "description",
        content:
          "Explore concept-stage development options for your land and see an indicative investment-readiness assessment across location, market, concept, documentation and financial evidence.",
      },
      { property: "og:title", content: "Development studio & investment readiness · HALISIA AI" },
      {
        property: "og:description",
        content: "Concept options, phasing, cost bands and an indicative readiness score for your land.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DevelopStudio,
});

function DevelopStudio() {
  const { id } = Route.useParams();
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("");

  const propQ = useQuery({
    queryKey: ["develop-property", id],
    queryFn: async () => {
      const p = await getProperty(id);
      if (!p) throw new Error("Listing not found");
      return p;
    },
  });
  const finQ = useQuery({
    queryKey: ["my-financing"],
    queryFn: listMyFinancing,
  });

  const stored = (propQ.data?.development_concept as unknown as ConceptOutput | null) ?? null;
  const [concept, setConcept] = useState<ConceptOutput | null>(null);
  const active = concept ?? stored;

  const gen = useMutation({
    mutationFn: async () => {
      const p = propQ.data!;
      const out = await generateDevelopmentConcept({
        data: {
          title: p.title,
          county: p.county,
          address: p.address,
          kind: p.kind,
          size_value: p.size_value != null ? Number(p.size_value) : null,
          size_unit: p.size_unit,
          price: p.price != null ? Number(p.price) : null,
          currency: p.currency,
          utilities: p.utilities ?? [],
          amenities: p.amenities ?? [],
          goal: goal || null,
          budget: budget ? Number(budget) : null,
        },
      });
      await updateProperty(id, { development_concept: out as unknown as Json }).catch((e) =>
        console.warn("concept save failed", e),
      );
      return out;
    },
    onSuccess: (out) => setConcept(out),
  });

  const readiness = useMemo(() => {
    if (!propQ.data) return null;
    const hasApp = (finQ.data ?? []).some((a) => a.property_id === id);
    return assessReadiness(propQ.data, {
      hasConcept: !!active,
      hasFinancingApplication: hasApp,
    });
  }, [propQ.data, finQ.data, active, id]);

  if (propQ.isLoading)
    return (
      <main className="min-h-dvh grid place-items-center pt-24">
        <Loader2 className="h-5 w-5 animate-spin text-accent" aria-label="Loading" />
      </main>
    );
  if (propQ.error)
    return (
      <main className="min-h-dvh px-4 pt-24 max-w-2xl mx-auto">
        <p className="text-sm text-red-300">{(propQ.error as Error).message}</p>
      </main>
    );

  const p = propQ.data!;

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-5xl mx-auto" data-testid="develop-studio">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to dashboard
      </Link>
      <header className="mt-3 mb-5">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Development studio</div>
        <h1 className="text-3xl font-display font-semibold mt-1">{p.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Concept-stage development options and an indicative investment-readiness assessment for{" "}
          {p.address ?? p.county ?? "this site"}.
        </p>
      </header>

      {/* Concept generator */}
      <section className="glass rounded-2xl border border-white/10 p-5 mb-6">
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-accent">
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Land development & project concept AI
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Your goal</span>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className="input">
              <option value="">Not stated</option>
              <option value="rental income">Rental income</option>
              <option value="resale">Resale profit</option>
              <option value="own use">Own use</option>
              <option value="mixed">Mixed / undecided</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Indicative budget (KES)</span>
            <input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} className="input" />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              data-testid="generate-concept"
              onClick={() => gen.mutate()}
              disabled={gen.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium disabled:opacity-60"
            >
              {gen.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
              {active ? "Regenerate concepts" : "Explore development potential"}
            </button>
          </div>
        </div>

        {active && (
          <div className="mt-4 grid gap-4">
            <p className="text-sm text-foreground/90">{active.summary}</p>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Site read</div>
              <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
                {active.siteRead.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <ul className="grid gap-3 md:grid-cols-3" data-testid="concept-options">
              {active.options.map((o) => (
                <li key={o.name} className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <div className="text-sm font-medium">{o.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-accent">{o.useType}</div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{o.rationale}</p>
                  <dl className="mt-2 grid gap-1 text-[11px]">
                    <Row k="Massing" v={o.massing} />
                    <Row k="Unit mix" v={o.unitMix} />
                    <Row k="Estimated units" v={String(o.estimatedUnits)} />
                    <Row k="Capex band" v={o.capexBandKes} />
                    <Row k="Revenue band" v={o.revenueBandKes} />
                    <Row k="Payback" v={`${o.paybackYears} yrs`} />
                  </dl>
                  {o.phasing.length > 0 && (
                    <>
                      <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Phasing</div>
                      <ol className="list-decimal pl-4 text-[11px] text-muted-foreground">
                        {o.phasing.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    </>
                  )}
                  {o.risks.length > 0 && (
                    <>
                      <div className="mt-2 text-[10px] uppercase tracking-widest text-amber-200">Risks to confirm</div>
                      <ul className="list-disc pl-4 text-[11px] text-muted-foreground">
                        {o.risks.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="mt-2 text-[10px] text-muted-foreground">Confidence {o.confidencePct}%</div>
                </li>
              ))}
            </ul>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Next steps</div>
              <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
                {active.nextSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <p className="text-[10px] text-muted-foreground/80">{CONCEPT_DISCLAIMER}</p>
          </div>
        )}
      </section>

      {/* Investment readiness */}
      {readiness && (
        <section className="glass rounded-2xl border border-white/10 p-5" data-testid="readiness">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-accent">
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" /> Investment & construction finance readiness
            </div>
            <div className="text-right">
              <div className="font-numeric text-2xl">{readiness.total}%</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{readiness.band}</div>
            </div>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {readiness.factors.map((f) => (
              <li key={f.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{f.label}</span>
                  <span className="font-numeric text-accent">{f.score}%</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={f.score} aria-valuemin={0} aria-valuemax={100} aria-label={f.label}>
                  <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${f.score}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{f.evidence}</p>
                <p className="text-[11px] text-accent/90">Improve: {f.improve}</p>
                <div className="text-[10px] text-muted-foreground/70">Weight {f.weight}%</div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/financing" className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] text-accent">
              Start / update financing application
            </Link>
            <Link to="/pros" className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px]">
              Request a professional review
            </Link>
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground/80">{READINESS_DISCLAIMER}</p>
        </section>
      )}
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right text-foreground/90">{v}</dd>
    </div>
  );
}

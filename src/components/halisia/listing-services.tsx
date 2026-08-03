import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Briefcase, Landmark, ShieldAlert, Loader2, Sparkles, Info, Plus } from "lucide-react";
import type { PropertyRow } from "@/lib/properties";
import { useAuth } from "@/hooks/use-auth";
import {
  BID_CATEGORIES,
  createBidRequest,
  listBidRequestsForProperty,
  listProposals,
  type BidCategory,
} from "@/lib/bids";
import {
  getInsuranceBrief,
  upsertInsuranceBrief,
  type InsuranceAiOutput,
  type InsuranceRisk,
} from "@/lib/insurance";
import { generateInsuranceBrief } from "@/lib/insurance-ai.functions";

export function ListingServices({ property }: { property: PropertyRow }) {
  return (
    <section className="mt-6 grid gap-4">
      <BidRequestsPanel property={property} />
      <FinancingCta property={property} />
      <InsuranceBriefPanel property={property} />
    </section>
  );
}

/* --------------------------------- Bids --------------------------------- */

function BidRequestsPanel({ property }: { property: PropertyRow }) {
  const { user } = useAuth();
  const isOwner = !!user && user.id === property.owner_id;
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["bids", "property", property.id],
    queryFn: () => listBidRequestsForProperty(property.id),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "construction" as BidCategory,
    scope: "",
    budget_min: "",
    budget_max: "",
    timeline: "",
  });
  const create = useMutation({
    mutationFn: () =>
      createBidRequest({
        property_id: property.id,
        county: property.county ?? null,
        title: form.title,
        category: form.category,
        scope: form.scope,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        timeline: form.timeline || null,
        currency: "KES",
      }),
    onSuccess: () => {
      setOpen(false);
      setForm({
        title: "",
        category: "construction",
        scope: "",
        budget_min: "",
        budget_max: "",
        timeline: "",
      });
      qc.invalidateQueries({ queryKey: ["bids", "property", property.id] });
    },
  });

  return (
    <div data-testid="bid-panel" className="glass rounded-2xl border border-white/10 p-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-accent inline-flex items-center gap-1">
            <Briefcase className="h-3 w-3" /> Professional matching
          </div>
          <h2 className="text-lg font-display font-semibold mt-1">
            Request bids from verified pros
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Post a scope of work and receive proposals from architects, engineers, surveyors and
            builders.
          </p>
        </div>
        {isOwner && (
          <button
            type="button"
            data-testid="new-bid-toggle"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> New bid request
          </button>
        )}
      </header>

      {!isOwner && (
        <p className="mt-3 text-xs text-muted-foreground">
          Only the listing owner can request bids on this property.
        </p>
      )}

      {isOwner && open && (
        <form
          className="mt-4 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.title || !form.scope) return;
            create.mutate();
          }}
        >
          <input
            className="input"
            placeholder="Title (e.g. Boundary wall & gate)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as BidCategory })}
            >
              {BID_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Timeline (e.g. 3 months)"
              value={form.timeline}
              onChange={(e) => setForm({ ...form, timeline: e.target.value })}
            />
            <input
              className="input"
              placeholder="Budget min (KES)"
              type="number"
              min={0}
              value={form.budget_min}
              onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
            />
            <input
              className="input"
              placeholder="Budget max (KES)"
              type="number"
              min={0}
              value={form.budget_max}
              onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
            />
          </div>
          <textarea
            className="input"
            rows={4}
            placeholder="Scope of work — what needs to be done, key constraints, materials, standards…"
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value })}
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {create.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Publish bid request
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {q.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading requests…</p>
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No bid requests yet for this property.</p>
        ) : (
          (q.data ?? []).map((r) => (
            <RequestRow key={r.id} id={r.id} title={r.title} status={r.status} scope={r.scope} />
          ))
        )}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Providers browse open requests at{" "}
        <Link to="/_authenticated/pros" className="text-accent hover:underline">
          the Pro network
        </Link>
        .
      </p>
    </div>
  );
}

function RequestRow({
  id,
  title,
  status,
  scope,
}: {
  id: string;
  title: string;
  status: string;
  scope: string;
}) {
  const [open, setOpen] = useState(false);
  const p = useQuery({
    queryKey: ["bid-proposals", id],
    queryFn: () => listProposals(id),
    enabled: open,
  });
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{title}</div>
          <div className="text-[11px] text-muted-foreground line-clamp-1">{scope}</div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest shrink-0">
          {status}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {p.isLoading ? (
            <p className="text-[11px] text-muted-foreground">Loading proposals…</p>
          ) : (p.data ?? []).length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No proposals yet.</p>
          ) : (
            (p.data ?? []).map((pr) => (
              <div key={pr.id} className="text-[11px] rounded-lg bg-white/[0.04] px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{pr.company_name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {pr.currency} {pr.amount?.toLocaleString?.() ?? "—"} · {pr.timeline_days ?? "—"}
                    d
                  </span>
                </div>
                {pr.message && <p className="text-muted-foreground mt-0.5">{pr.message}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Financing ------------------------------- */

function FinancingCta({ property }: { property: PropertyRow }) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/20 p-2">
          <Landmark className="h-4 w-4 text-emerald-glow" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-accent">Explore financing</div>
          <h2 className="text-base font-display font-semibold mt-0.5">
            Track a mortgage or construction loan for this property
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Halisia generates a lender-ready summary (DTI/LTV estimates, documents, suggested Kenyan
            lenders) and lets you manage statuses end to end.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/_authenticated/financing"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1.5 text-xs font-medium"
            >
              Start a financing application
            </Link>
            {property.price != null && (
              <span className="text-[11px] text-muted-foreground self-center">
                Prefill hint: listing price {property.currency}{" "}
                {Number(property.price).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Insurance ------------------------------- */

function InsuranceBriefPanel({ property }: { property: PropertyRow }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["insurance", property.id],
    queryFn: () => getInsuranceBrief(property.id),
  });
  const mut = useMutation({
    mutationFn: async () => {
      const ai = await generateInsuranceBrief({
        data: {
          title: property.title,
          kind: property.kind,
          county: property.county,
          address: property.address,
          latitude: property.latitude,
          longitude: property.longitude,
          size_value: property.size_value,
          size_unit: property.size_unit,
          amenities: property.amenities ?? [],
          utilities: property.utilities ?? [],
          access_type: null,
        },
      });
      return upsertInsuranceBrief(property.id, ai);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance", property.id] }),
  });
  const ai = (q.data?.ai_output as unknown as InsuranceAiOutput | null) ?? null;

  return (
    <div data-testid="insurance-panel" className="glass rounded-2xl border border-white/10 p-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-accent inline-flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> Insurance & risk brief
          </div>
          <h2 className="text-lg font-display font-semibold mt-1">
            AI-generated risk summary for insurers
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Key perils, coverage recommendations and the questions to ask a Kenyan insurer.
          </p>
        </div>
        {user && (
          <button
            type="button"
            data-testid="generate-insurance"
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1.5 text-xs disabled:opacity-60"
          >
            {mut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {ai ? "Regenerate" : "Generate brief"}
          </button>
        )}
      </header>

      {!ai ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {user
            ? "No brief yet — generate one to see key risks and coverage."
            : "Sign in to generate an insurance brief."}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Key risks
            </h3>
            <ul className="space-y-2">
              {ai.keyRisks.map((r: InsuranceRisk) => (
                <li
                  key={r.name}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.name}</span>
                    <SeverityPill s={r.severity} />
                  </div>
                  <p className="text-muted-foreground mt-0.5">{r.description}</p>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Confidence {r.confidencePct}%
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                Recommended coverage
              </h3>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {ai.recommendedCoverage.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                Questions to ask insurers
              </h3>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {ai.questionsForInsurer.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {ai && (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-[11px] text-amber-glow">
          <div className="flex items-center gap-1.5 font-medium mb-1">
            <Info className="h-3 w-3" /> Disclaimers
          </div>
          <ul className="space-y-0.5">
            {ai.disclaimers.map((d) => (
              <li key={d}>• {d}</li>
            ))}
          </ul>
          <div className="mt-1 text-muted-foreground">
            Overall confidence {ai.overallConfidencePct}% · Generated{" "}
            {new Date(ai.generatedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

function SeverityPill({ s }: { s: InsuranceRisk["severity"] }) {
  const cls =
    s === "high"
      ? "border-red-400/30 bg-red-500/10 text-red-300"
      : s === "moderate"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-glow"
        : "border-emerald-400/30 bg-emerald-500/10 text-emerald-glow";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${cls}`}
    >
      {s}
    </span>
  );
}

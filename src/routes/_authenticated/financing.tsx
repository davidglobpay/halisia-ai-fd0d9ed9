import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Landmark, Loader2, Plus, ArrowLeft, Sparkles, Trash2, FileText } from "lucide-react";
import {
  listMyFinancing,
  createFinancing,
  updateFinancing,
  deleteFinancing,
  formatMoney,
  FINANCING_PURPOSES,
  FINANCING_STATUSES,
  type FinancingRow,
  type FinancingStatus,
} from "@/lib/financing";
import { generateLenderSummary, type LenderSummaryOutput } from "@/lib/financing-ai.functions";
import type { Json } from "@/integrations/supabase/types";
import { DocumentVault } from "@/components/halisia/document-vault";

export const Route = createFileRoute("/_authenticated/financing")({
  head: () => ({
    meta: [
      { title: "Financing tracker · HALISIA AI" },
      {
        name: "description",
        content:
          "Track mortgage and construction financing applications with lender-ready AI summaries.",
      },
    ],
  }),
  component: FinancingPage,
});

function FinancingPage() {
  const q = useQuery({ queryKey: ["financing", "mine"], queryFn: listMyFinancing });
  const [showNew, setShowNew] = useState(false);
  const nav = useNavigate();

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-5xl mx-auto">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Halisia AI</div>
          <h1 className="text-3xl font-display font-semibold mt-1 flex items-center gap-2">
            <Landmark className="h-6 w-6 text-accent" /> Financing tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage borrower details, lender-ready AI briefs and application statuses in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> New application
        </button>
      </header>

      {showNew && <NewApplicationForm onDone={() => setShowNew(false)} />}

      {q.isLoading ? (
        <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
          No applications yet — start one to generate a lender-ready summary.
        </div>
      ) : (
        <ul className="grid gap-3">
          {(q.data ?? []).map((f) => (
            <FinancingCard
              key={f.id}
              f={f}
              onOpenListing={(id) => nav({ to: "/marketplace/$id", params: { id } })}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function NewApplicationForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    borrower_name: "",
    borrower_email: "",
    borrower_phone: "",
    monthly_income: "",
    employment_status: "",
    requested_amount: "",
    currency: "KES",
    purpose: "purchase" as (typeof FINANCING_PURPOSES)[number]["value"],
    tenure_months: "",
    property_value: "",
    property_address: "",
    notes: "",
  });
  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        borrower_name: form.borrower_name,
        borrower_email: form.borrower_email || null,
        borrower_phone: form.borrower_phone || null,
        monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
        employment_status: form.employment_status || null,
        requested_amount: Number(form.requested_amount),
        currency: form.currency,
        purpose: form.purpose,
        tenure_months: form.tenure_months ? Number(form.tenure_months) : null,
        property_value: form.property_value ? Number(form.property_value) : null,
        property_address: form.property_address || null,
        notes: form.notes || null,
      };
      const summary = await generateLenderSummary({ data: payload });
      return createFinancing({
        ...payload,
        status: "draft",
        ai_summary: summary as unknown as Json,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financing", "mine"] });
      onDone();
    },
  });
  const patch = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="glass rounded-2xl border border-white/10 p-5 mb-6 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.borrower_name || !form.requested_amount) return;
        mut.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Borrower name">
          <input
            className="input"
            required
            value={form.borrower_name}
            onChange={(e) => patch("borrower_name", e.target.value)}
          />
        </Field>
        <Field label="Employment / status">
          <input
            className="input"
            placeholder="e.g. Salaried, self-employed"
            value={form.employment_status}
            onChange={(e) => patch("employment_status", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={form.borrower_email}
            onChange={(e) => patch("borrower_email", e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className="input"
            value={form.borrower_phone}
            onChange={(e) => patch("borrower_phone", e.target.value)}
          />
        </Field>
        <Field label="Monthly income (KES)">
          <input
            className="input"
            type="number"
            min={0}
            value={form.monthly_income}
            onChange={(e) => patch("monthly_income", e.target.value)}
          />
        </Field>
        <Field label="Requested amount (KES)">
          <input
            className="input"
            type="number"
            min={0}
            required
            value={form.requested_amount}
            onChange={(e) => patch("requested_amount", e.target.value)}
          />
        </Field>
        <Field label="Purpose">
          <select
            className="input"
            value={form.purpose}
            onChange={(e) =>
              patch("purpose", e.target.value as (typeof FINANCING_PURPOSES)[number]["value"])
            }
          >
            {FINANCING_PURPOSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tenure (months)">
          <input
            className="input"
            type="number"
            min={1}
            value={form.tenure_months}
            onChange={(e) => patch("tenure_months", e.target.value)}
          />
        </Field>
        <Field label="Property value (KES)">
          <input
            className="input"
            type="number"
            min={0}
            value={form.property_value}
            onChange={(e) => patch("property_value", e.target.value)}
          />
        </Field>
        <Field label="Property address">
          <input
            className="input"
            value={form.property_address}
            onChange={(e) => patch("property_address", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Notes for lender (optional)">
        <textarea
          className="input"
          rows={3}
          value={form.notes}
          onChange={(e) => patch("notes", e.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={mut.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-2 text-xs font-medium disabled:opacity-60"
        >
          {mut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Save & generate AI brief
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      {mut.isError && (
        <p className="text-xs text-red-400">
          Couldn't save — {(mut.error as Error)?.message ?? "please retry."}
        </p>
      )}
    </form>
  );
}

function FinancingCard({
  f,
  onOpenListing,
}: {
  f: FinancingRow;
  onOpenListing: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ai = f.ai_summary as unknown as LenderSummaryOutput | null;
  const statusMut = useMutation({
    mutationFn: (status: FinancingStatus) => updateFinancing(f.id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financing", "mine"] }),
  });
  const delMut = useMutation({
    mutationFn: () => deleteFinancing(f.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financing", "mine"] }),
  });
  return (
    <li className="glass rounded-2xl border border-white/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-accent">{f.purpose}</div>
          <h3 className="text-sm font-semibold mt-1">
            {formatMoney(f.requested_amount, f.currency)} · {f.borrower_name}
          </h3>
          {f.property_address && (
            <div className="text-[11px] text-muted-foreground mt-0.5">{f.property_address}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            className="input h-8 py-1 text-xs"
            value={f.status}
            onChange={(e) => statusMut.mutate(e.target.value as FinancingStatus)}
          >
            {FINANCING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this application?")) delMut.mutate();
            }}
            className="text-muted-foreground hover:text-red-400"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-xs text-accent hover:underline inline-flex items-center gap-1"
      >
        <FileText className="h-3 w-3" /> {open ? "Hide" : "View"} lender-ready summary
      </button>
      <div className="mt-3">
        <DocumentVault financingId={f.id} propertyId={f.property_id ?? null} />
      </div>
      {open && ai && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Headline
            </div>
            <div className="text-sm font-medium">{ai.headline}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryBlock label="Loan snapshot" text={ai.loanSnapshot} />
            <SummaryBlock label="Borrower profile" text={ai.borrowerProfile} />
            <SummaryBlock label="Property overview" text={ai.propertyOverview} />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Ratios
              </div>
              <div>DTI est: {ai.dtiEstimatePct ?? "—"}%</div>
              <div>LTV est: {ai.ltvEstimatePct ?? "—"}%</div>
            </div>
          </div>
          {ai.riskFlags.length > 0 && (
            <ListBlock label="Risk flags" items={ai.riskFlags} tone="warn" />
          )}
          {ai.strengths.length > 0 && <ListBlock label="Strengths" items={ai.strengths} />}
          <ListBlock label="Documents to prepare" items={ai.recommendedDocuments} />
          <ListBlock label="Suggested lenders" items={ai.suggestedLenders} />
          <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-2 text-[11px] text-amber-glow">
            {ai.disclaimers.map((d) => (
              <div key={d}>• {d}</div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Generated {new Date(ai.generatedAt).toLocaleString()} · confidence {ai.confidencePct}%
          </div>
          {f.property_id && (
            <button
              type="button"
              onClick={() => onOpenListing(f.property_id!)}
              className="text-[11px] text-accent hover:underline"
            >
              View linked listing →
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function SummaryBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}
function ListBlock({ label, items, tone }: { label: string; items: string[]; tone?: "warn" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      <ul
        className={`space-y-0.5 ${tone === "warn" ? "text-amber-glow" : "text-muted-foreground"}`}
      >
        {items.map((i) => (
          <li key={i}>• {i}</li>
        ))}
      </ul>
    </div>
  );
}

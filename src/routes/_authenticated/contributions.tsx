import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, HeartHandshake, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  CONTRIBUTION_KINDS,
  createContribution,
  listMyContributions,
  summariseReputation,
} from "@/lib/contributions";

export const Route = createFileRoute("/_authenticated/contributions")({
  head: () => ({
    meta: [
      { title: "Contributor dashboard · HALISIA AI" },
      {
        name: "description",
        content:
          "Submit local knowledge, track review status, and see your contribution quality, reputation and community impact.",
      },
      { property: "og:title", content: "Contributor dashboard · HALISIA AI" },
      {
        property: "og:description",
        content: "Track your contributions, reputation tier and community impact on Halisia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContributionsPage,
});

function ContributionsPage() {
  const qc = useQueryClient();
  const rows = useQuery({ queryKey: ["my-contributions"], queryFn: listMyContributions });
  const [form, setForm] = useState({ kind: "correction", title: "", county: "", body: "" });

  const submit = useMutation({
    mutationFn: () =>
      createContribution({
        kind: form.kind,
        title: form.title,
        county: form.county || null,
        body: form.body || null,
      }),
    onSuccess: () => {
      setForm({ kind: "correction", title: "", county: "", body: "" });
      void qc.invalidateQueries({ queryKey: ["my-contributions"] });
      toast.success("Contribution submitted for review");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = rows.data ?? [];
  const rep = summariseReputation(list);

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-4xl mx-auto">
      <Link
        to="/dashboard"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to dashboard
      </Link>
      <Link to="/scout" className="mb-3 ml-4 inline-flex text-xs text-accent">
        Send a Scout requests & jobs →
      </Link>
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Halisia AI</div>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-display font-semibold">
          <HeartHandshake className="h-6 w-6 text-accent" aria-hidden="true" /> Contributor
          dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Local knowledge makes every score sharper. Track what you have submitted and how it lands.
        </p>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-4" aria-label="Reputation">
        <Stat label="Reputation tier" value={rep.tier} />
        <Stat label="Reward points" value={rep.points} />
        <Stat label="Accepted" value={rep.accepted} />
        <Stat
          label="Acceptance rate"
          value={rep.acceptanceRate != null ? `${rep.acceptanceRate}%` : "—"}
        />
      </section>

      <div className="glass mb-8 rounded-2xl border border-accent/20 p-4 text-sm">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-accent">
          <Sparkles className="h-3 w-3" aria-hidden="true" /> Community impact
        </div>
        <p className="mt-1.5 text-muted-foreground">{rep.impact}</p>
        {rep.qualityAvg != null && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Average contribution quality score: {rep.qualityAvg}/10
          </p>
        )}
      </div>

      <section className="mb-10" aria-label="Submit a contribution">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
          Add a contribution
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
          className="glass grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-2"
        >
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Type
            </span>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm"
            >
              {CONTRIBUTION_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              County
            </span>
            <input
              value={form.county}
              onChange={(e) => setForm({ ...form, county: e.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Title
            </span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Details
            </span>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={4}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submit.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {submit.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              Submit for review
            </button>
          </div>
        </form>
      </section>

      <section aria-label="My contributions">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
          My contributions &amp; review status
        </h2>
        {list.length === 0 ? (
          <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
            Nothing submitted yet.
          </div>
        ) : (
          <ul className="grid gap-2">
            {list.map((c) => (
              <li key={c.id} className="glass rounded-2xl border border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {CONTRIBUTION_KINDS.find((k) => k.value === c.kind)?.label ?? c.kind}
                      {c.county ? ` · ${c.county}` : ""} ·{" "}
                      {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                      c.status === "accepted"
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                        : c.status === "rejected"
                          ? "border-red-400/40 bg-red-400/10 text-red-200"
                          : "border-amber-400/40 bg-amber-400/10 text-amber-200"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                {c.body && <p className="mt-1.5 text-[12px] text-muted-foreground">{c.body}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  {c.quality_score != null && <span>Quality {c.quality_score}/10</span>}
                  {c.reward_points > 0 && (
                    <span className="text-gold">+{c.reward_points} points</span>
                  )}
                  {c.reviewer_note && <span>Reviewer: {c.reviewer_note}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-display font-semibold">{value}</div>
    </div>
  );
}

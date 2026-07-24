import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Briefcase, Loader2, Send, ArrowLeft } from "lucide-react";
import {
  listOpenBidRequests,
  listMyProposals,
  submitProposal,
  BID_CATEGORIES,
  type BidRequestRow,
} from "@/lib/bids";

export const Route = createFileRoute("/_authenticated/pros")({
  head: () => ({
    meta: [
      { title: "Pro network · HALISIA AI" },
      {
        name: "description",
        content:
          "Open bid requests from Kenyan landowners for construction, architecture, surveying and engineering services.",
      },
    ],
  }),
  component: ProsPage,
});

function ProsPage() {
  const open = useQuery({ queryKey: ["bids", "open"], queryFn: listOpenBidRequests });
  const mine = useQuery({ queryKey: ["bids", "my-proposals"], queryFn: listMyProposals });
  const [filter, setFilter] = useState<string>("all");
  const rows = (open.data ?? []).filter((r) => filter === "all" || r.category === filter);

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-6xl mx-auto">
      <Link
        to="/_authenticated/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Halisia AI</div>
        <h1 className="text-3xl font-display font-semibold mt-1 flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-accent" /> Pro network
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse open bid requests from landowners and submit proposals.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-4">
        {[{ value: "all", label: "All" }, ...BID_CATEGORIES].map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setFilter(c.value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === c.value
                ? "border-accent bg-accent/10 text-accent"
                : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {open.isLoading ? (
        <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
          Loading open requests…
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
          No open bid requests in this category right now.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <BidCard key={r.id} r={r} />
          ))}
        </ul>
      )}

      <section className="mt-10">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground mb-3">
          My proposals
        </h2>
        {(mine.data ?? []).length === 0 ? (
          <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
            You haven't submitted any proposals yet.
          </div>
        ) : (
          <ul className="grid gap-3">
            {(mine.data ?? []).map((p) => (
              <li
                key={p.id}
                className="glass rounded-2xl border border-white/10 p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm truncate">{p.company_name}</div>
                  {p.message && (
                    <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                      {p.message}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {p.currency} {p.amount?.toLocaleString?.() ?? "—"} · {p.timeline_days ?? "—"} days ·{" "}
                    {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest">
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function BidCard({ r }: { r: BidRequestRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [timeline, setTimeline] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      submitProposal({
        bid_request_id: r.id,
        amount: amount ? Number(amount) : null,
        currency: r.currency,
        timeline_days: timeline ? Number(timeline) : null,
        company_name: companyName,
        message,
      }),
    onSuccess: () => {
      setOpen(false);
      setAmount("");
      setTimeline("");
      setCompanyName("");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["bids", "my-proposals"] });
    },
  });
  return (
    <li className="glass rounded-2xl border border-white/10 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-accent">{r.category}</div>
          <h3 className="text-sm font-semibold mt-1 truncate">{r.title}</h3>
          {r.county && (
            <div className="text-[11px] text-muted-foreground mt-0.5">{r.county}</div>
          )}
        </div>
        {r.budget_max != null && (
          <div className="text-xs text-muted-foreground tabular-nums shrink-0">
            {r.currency} {r.budget_min ? `${r.budget_min}–` : ""}
            {r.budget_max}
          </div>
        )}
      </div>
      {r.scope && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{r.scope}</p>
      )}
      {r.timeline && (
        <p className="mt-1 text-[11px] text-muted-foreground">Timeline: {r.timeline}</p>
      )}
      <div className="mt-3">
        {open ? (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!companyName.trim() || !message.trim()) return;
              mut.mutate();
            }}
          >
            <input
              className="input"
              placeholder="Company / provider name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                placeholder={`Amount (${r.currency})`}
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <input
                className="input"
                placeholder="Timeline (days)"
                type="number"
                min={0}
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
              />
            </div>
            <textarea
              className="input"
              placeholder="Short proposal summary…"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={mut.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-60"
              >
                {mut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Submit proposal
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
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs text-accent hover:underline"
          >
            Submit a proposal →
          </button>
        )}
      </div>
    </li>
  );
}
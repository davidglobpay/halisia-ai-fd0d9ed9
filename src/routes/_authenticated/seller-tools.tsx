import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bookmark, Download, Eye, FileText, Flame, Lightbulb, Loader2, MessageSquare, TrendingDown, TrendingUp } from "lucide-react";
import { listMyProperties, listMyLeadsAsSeller, formatPrice } from "@/lib/properties";
import { buildInsight, fetchSaveCount, type ListingInsight } from "@/lib/seller-tools";
import { downloadSellerCsv, downloadSellerPdf } from "@/lib/seller-export";

export const Route = createFileRoute("/_authenticated/seller-tools")({
  head: () => ({
    meta: [
      { title: "Seller tools · HALISIA AI" },
      {
        name: "description",
        content:
          "Lead quality, inquiry trends, views, saves, contact requests and AI-suggested follow-ups and listing improvements.",
      },
      { property: "og:title", content: "Seller tools · HALISIA AI" },
      {
        property: "og:description",
        content: "Track listing performance and market interest without any auto-contacting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SellerTools,
});

function SellerTools() {
  const insights = useQuery<ListingInsight[]>({
    queryKey: ["seller-tools"],
    queryFn: async () => {
      const [props, leads] = await Promise.all([listMyProperties(), listMyLeadsAsSeller()]);
      const saves = await Promise.all(props.map((p) => fetchSaveCount(p.id)));
      return props.map((p, i) => buildInsight(p, leads, saves[i] ?? 0));
    },
  });

  const rows = insights.data ?? [];
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const runExport = async (kind: "csv" | "pdf") => {
    if (rows.length === 0) return;
    setExporting(kind);
    setExportMsg(null);
    try {
      const name = kind === "csv" ? downloadSellerCsv(rows) : downloadSellerPdf(rows);
      setExportMsg(`Downloaded ${name}`);
    } catch (e) {
      setExportMsg((e as Error).message || "Export failed");
    } finally {
      setExporting(null);
    }
  };
  const totals = rows.reduce(
    (acc, r) => ({
      views: acc.views + r.views,
      saves: acc.saves + r.saves,
      leads: acc.leads + r.leads.length,
      contacts: acc.contacts + r.contactRequests,
    }),
    { views: 0, saves: 0, leads: 0, contacts: 0 },
  );

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-6xl mx-auto">
      <header className="mb-5">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Seller Centre</div>
        <h1 className="text-3xl font-display font-semibold mt-1">Seller tools</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Views, saves, contact requests, lead quality and inquiry trends per listing — plus
          suggested follow-ups. HALISIA never contacts your buyers on your behalf.
        </p>
      </header>

      <section className="mb-4 flex flex-wrap items-center gap-2" aria-label="Export analytics">
        <button
          type="button"
          data-testid="export-csv"
          onClick={() => void runExport("csv")}
          disabled={rows.length === 0 || exporting !== null}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {exporting === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
          Export CSV
        </button>
        <button
          type="button"
          data-testid="export-pdf"
          onClick={() => void runExport("pdf")}
          disabled={rows.length === 0 || exporting !== null}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent disabled:opacity-50"
        >
          {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}
          Export PDF report
        </button>
        <span aria-live="polite" className="text-[11px] text-muted-foreground">
          {exportMsg}
        </span>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 mb-6">
        <Stat icon={<Eye className="h-4 w-4" />} label="Total views" value={totals.views} />
        <Stat icon={<Bookmark className="h-4 w-4" />} label="Saves" value={totals.saves} />
        <Stat icon={<MessageSquare className="h-4 w-4" />} label="Enquiries" value={totals.leads} />
        <Stat icon={<Flame className="h-4 w-4" />} label="Contact requests" value={totals.contacts} />
      </section>

      {insights.isLoading ? (
        <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Crunching your listing performance…
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
          No listings yet.{" "}
          <Link to="/sell/new" className="text-accent hover:underline">Create your first listing</Link>.
        </div>
      ) : (
        <ul className="grid gap-4">
          {rows.map((r) => (
            <li key={r.property.id} className="glass rounded-2xl border border-white/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/marketplace/$id"
                    params={{ id: r.property.id }}
                    className="text-sm font-medium hover:text-accent"
                  >
                    {r.property.title}
                  </Link>
                  <div className="text-[11px] text-muted-foreground">
                    {r.property.county ?? "Kenya"} · {r.property.kind} · {r.property.status} ·{" "}
                    {r.property.completeness_pct}% complete
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{formatPrice(r.property)}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                      r.quality === "hot"
                        ? "border-red-400/40 bg-red-400/10 text-red-200"
                        : r.quality === "warm"
                          ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
                          : "border-white/10 bg-white/5 text-muted-foreground"
                    }`}
                    title={r.qualityReason}
                  >
                    {r.quality} lead quality
                  </span>
                </div>
              </div>

              <p className="mt-1 text-[11px] text-muted-foreground">{r.qualityReason}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Mini label="Views" value={r.views} />
                <Mini label="Saves" value={r.saves} />
                <Mini label="Enquiries" value={r.leads.length} />
                <Mini label="Contact requests" value={r.contactRequests} />
                <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    7-day trend
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-sm font-numeric">
                    {r.trendPct >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-red-300" aria-hidden="true" />
                    )}
                    {r.trendPct > 0 ? "+" : ""}
                    {r.trendPct}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {r.leadsLast7} this week vs {r.leadsPrev7} prior
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Suggested follow-ups
                  </div>
                  <ul className="mt-1.5 list-disc pl-4 text-[11px] text-muted-foreground">
                    {r.followUps.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" aria-hidden="true" /> Suggested improvements
                  </div>
                  <ul className="mt-1.5 list-disc pl-4 text-[11px] text-muted-foreground">
                    {r.improvements.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="mt-2 text-[10px] text-muted-foreground/70">
                Save rate {r.saveRate}% · Enquiry rate {r.enquiryRate}% of views. You decide when and
                how to reply — nothing is sent automatically.
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="mt-2 text-3xl font-display font-semibold">{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-numeric">{value}</div>
    </div>
  );
}
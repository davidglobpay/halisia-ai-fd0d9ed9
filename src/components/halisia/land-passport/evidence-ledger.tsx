import { CHAPTERS, type LedgerEntry, type LedgerStatus } from "@/lib/passport-evidence";

const STATUS: Record<LedgerStatus, { label: string; cls: string }> = {
  ok: { label: "Answered", cls: "text-primary" },
  no_data: { label: "No data", cls: "text-muted-foreground" },
  failed: { label: "Failed", cls: "text-destructive" },
  loading: { label: "Loading", cls: "text-muted-foreground" },
  not_connected: { label: "Not connected", cls: "text-muted-foreground" },
};

const title = (id: string) => CHAPTERS.find((c) => c.id === id)?.title ?? id;

/** Every source queried for this passport and what happened. */
export function EvidenceLedger({ entries }: { entries: LedgerEntry[] }) {
  return (
    <details className="rounded-2xl border border-foreground/10 bg-card/80" data-testid="evidence-ledger">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 text-sm">
        <span className="font-display">Evidence ledger</span>
        <span className="text-[11px] text-muted-foreground">
          {entries.filter((e) => e.status === "ok").length}/{entries.length} sources answered
        </span>
      </summary>
      <div className="overflow-x-auto border-t border-foreground/10">
        <table className="w-full min-w-[520px] text-left text-[11px]">
          <thead className="text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-normal">Source</th>
              <th className="px-2 py-2 font-normal">Status</th>
              <th className="px-2 py-2 font-normal">Feeds</th>
              <th className="px-4 py-2 font-normal">Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-foreground/10" data-ledger-status={e.status}>
                <td className="px-4 py-2">{e.provider}</td>
                <td className={`px-2 py-2 font-medium ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</td>
                <td className="px-2 py-2 text-muted-foreground">{e.chapters.map(title).join(", ")}</td>
                <td className="px-4 py-2 font-mono text-muted-foreground">{e.detail || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-[11px] text-muted-foreground">
          "Failed" means the source did not answer on this visit — it is never shown as zero results.
        </p>
      </div>
    </details>
  );
}

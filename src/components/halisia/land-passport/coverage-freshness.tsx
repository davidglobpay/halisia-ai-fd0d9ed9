import type { EvidenceItem } from "@/lib/passport-evidence";
import { BUCKET_META, buildCoverage, bucketOf, type Bucket } from "@/lib/passport-coverage";

const BUCKETS: Bucket[] = ["sourced", "estimate", "ai", "unavailable"];
const TONE: Record<Bucket, string> = {
  sourced: "bg-primary/70",
  estimate: "bg-accent/60",
  ai: "bg-foreground/40",
  unavailable: "bg-foreground/10",
};

function stamp(v: string | null) {
  if (!v) return "—";
  return /^\d{4}-\d{2}-\d{2}T/.test(v) ? `${v.slice(0, 10)} ${v.slice(11, 16)} UTC` : v;
}

/** Per-chapter split of sourced facts, estimates, AI and gaps, plus freshness. */
export function CoverageFreshness({ items }: { items: EvidenceItem[] }) {
  const { rows, totals } = buildCoverage(items);
  return (
    <section
      className="rounded-2xl border border-foreground/10 bg-card p-4"
      data-testid="passport-coverage-freshness"
      aria-labelledby="coverage-h"
    >
      <h2 id="coverage-h" className="font-display text-base">
        Coverage & freshness
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Nothing on this page is legally or survey verified. "Sourced facts" come from a named
        provider; they still need professional checks before any transaction.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BUCKETS.map((b) => (
          <li
            key={b}
            className="rounded-xl border border-foreground/10 p-2"
            title={BUCKET_META[b].hint}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${TONE[b]}`} aria-hidden />
              {BUCKET_META[b].label}
            </div>
            <div className="font-mono text-lg">{totals[b]}</div>
          </li>
        ))}
      </ul>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-2 font-medium">Specification</th>
              <th className="py-1.5 pr-2 font-medium">Split</th>
              {BUCKETS.map((b) => (
                <th key={b} className="py-1.5 pr-2 text-right font-medium">
                  {BUCKET_META[b].label.split(" ")[0]}
                </th>
              ))}
              <th className="py-1.5 pr-2 font-medium">Last retrieved</th>
              <th className="py-1.5 font-medium">Stays current</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-foreground/5 align-top">
                <td className="py-2 pr-2 font-medium">{r.title}</td>
                <td className="py-2 pr-2">
                  <div
                    className="flex h-2 w-24 overflow-hidden rounded-full bg-foreground/5"
                    aria-hidden
                  >
                    {BUCKETS.map((b) =>
                      r.counts[b] ? (
                        <span
                          key={b}
                          className={TONE[b]}
                          style={{ width: `${(r.counts[b] / Math.max(r.total, 1)) * 100}%` }}
                        />
                      ) : null,
                    )}
                  </div>
                </td>
                {BUCKETS.map((b) => (
                  <td key={b} className="py-2 pr-2 text-right font-mono">
                    {r.counts[b]}
                  </td>
                ))}
                <td className="py-2 pr-2 font-mono">{stamp(r.latest)}</td>
                <td className="py-2 text-muted-foreground">{r.policy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold">Show every specification</summary>
        <ul className="mt-2 grid gap-1 text-xs">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex flex-wrap justify-between gap-2 border-t border-foreground/5 py-1"
            >
              <span>{it.label}</span>
              <span className="text-muted-foreground">
                {BUCKET_META[bucketOf(it.cls)].label} ·{" "}
                {stamp(it.value == null ? null : it.retrieved)}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

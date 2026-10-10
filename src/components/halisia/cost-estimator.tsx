import { useMemo, useState } from "react";
import { Calculator, Download } from "lucide-react";
import { toast } from "sonner";
import {
  COST_ASSUMPTIONS,
  estimateCosts,
  kes,
  kesShort,
  type UseClass,
} from "@/lib/construction-cost";

export function CostEstimator(props: {
  grossM2: number;
  storeys: number;
  use: UseClass;
  slopeAdjust?: number;
  title: string;
  context?: string;
}) {
  const [busy, setBusy] = useState(false);
  const rows = useMemo(
    () =>
      estimateCosts({
        grossM2: props.grossM2,
        storeys: props.storeys,
        use: props.use,
        slopeAdjust: props.slopeAdjust,
      }),
    [props.grossM2, props.storeys, props.use, props.slopeAdjust],
  );

  async function exportPdf() {
    setBusy(true);
    try {
      const { downloadCostPdf } = await import("@/lib/pdf-cost-estimate");
      const name = await downloadCostPdf({ ...props, rows });
      toast.success(`Downloaded ${name}`);
    } catch (e) {
      toast.error(`Could not build the estimate PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!(props.grossM2 > 0)) return null;

  return (
    <section
      data-testid="cost-estimator"
      aria-labelledby="cost-heading"
      className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="cost-heading" className="flex items-center gap-1.5 text-sm font-medium">
          <Calculator className="h-4 w-4 text-accent" aria-hidden="true" />
          Indicative construction budget · {Math.round(props.grossM2)} m²
        </h3>
        <button
          type="button"
          data-testid="cost-pdf"
          onClick={exportPdf}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs font-medium hover:bg-white/10 disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {busy ? "Preparing…" : "Download estimate PDF"}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Estimate · planning range, not a quote or engineering design. Confidence: low–moderate.
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        {rows.map((r) => (
          <article
            key={r.system}
            data-testid={`cost-${r.system}`}
            className="rounded-lg border border-white/10 bg-black/10 p-3 text-xs"
          >
            <h4 className="font-medium leading-snug">{r.label}</h4>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {kes(r.rateLow)}–{kes(r.rateHigh).replace("KES ", "")} / m²
            </p>
            <p className="mt-1 font-mono text-sm">
              {kesShort(r.totalLow)} – {kesShort(r.totalHigh)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              + 10% contingency {kesShort(r.contingencyLow)}–{kesShort(r.contingencyHigh)}
            </p>
            <ul className="mt-2 space-y-0.5">
              {r.pros.map((p) => (
                <li key={p}>+ {p}</li>
              ))}
              {r.cons.map((c) => (
                <li key={c} className="text-muted-foreground">
                  − {c}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <details className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer">Assumptions</summary>
        <ul className="mt-1 space-y-0.5">
          {COST_ASSUMPTIONS.map((a) => (
            <li key={a}>— {a}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

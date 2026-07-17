import { X, ExternalLink, ShieldCheck, Download } from "lucide-react";
import type { ScoreExplain } from "@/lib/wave4-intel.functions";

/**
 * Provenance modal for a Wave 4 score category. Lays out the exact formula,
 * every contributing factor with its raw value, weight and confidence, and
 * links to the underlying open datasets.
 */
export type ProvenanceSource = {
  label: string;
  url: string;
  used: boolean;
};

export function ProvenanceModal({
  open,
  onClose,
  title,
  explain,
  sources,
  contextNote,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  explain: ScoreExplain;
  sources: ProvenanceSource[];
  contextNote?: string;
}) {
  if (!open) return null;
  const confidenceCopy: Record<ScoreExplain["confidence"], string> = {
    high: "High — dense open-data coverage supports this reading.",
    medium: "Medium — a workable sample was returned but some inputs are sparse.",
    low: "Low — limited public data at this coordinate; treat as directional only.",
  };
  const confTone: Record<ScoreExplain["confidence"], string> = {
    high: "text-emerald-glow",
    medium: "text-amber-glow",
    low: "text-muted-foreground",
  };

  const slug =
    title
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .replace(/^-+|-+$/g, "") || "provenance";

  const buildPayload = () => ({
    title,
    score: explain.score,
    formula: explain.formula,
    confidence: explain.confidence,
    confidenceWording: confidenceCopy[explain.confidence],
    note: explain.note,
    factors: explain.factors.map((f) => ({
      label: f.label,
      value: f.value,
      weight: f.weight,
    })),
    sources: sources.map((s) => ({
      label: s.label,
      url: s.url,
      status: s.used ? "live" : "planned",
    })),
    exportedAt: new Date().toISOString(),
  });

  const download = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `halisia-provenance-${slug}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportJson = () => {
    download(new Blob([JSON.stringify(buildPayload(), null, 2)], { type: "application/json" }), "json");
  };

  const exportCsv = () => {
    const p = buildPayload();
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: string[] = [];
    rows.push("section,key,value,weight,confidence");
    rows.push(`score,${esc(p.title)},${esc(p.score)},,${esc(p.confidence)}`);
    rows.push(`formula,${esc(p.title)},${esc(p.formula)},,`);
    rows.push(`confidence,${esc(p.title)},${esc(p.confidenceWording)},,${esc(p.confidence)}`);
    for (const f of p.factors) {
      rows.push(`factor,${esc(f.label)},${esc(f.value)},${esc(f.weight)},`);
    }
    for (const s of p.sources) {
      rows.push(`source,${esc(s.label)},${esc(s.url)},,${esc(s.status)}`);
    }
    download(new Blob([rows.join("\n")], { type: "text/csv" }), "csv");
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} provenance`}
      onClick={onClose}
      data-testid="provenance-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg glass-strong rounded-2xl border border-white/10 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-accent">
              Dataset provenance
            </div>
            <div className="text-sm font-semibold">{title}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={exportJson}
              className="inline-flex items-center gap-1 rounded-full glass px-2 py-1 text-[10px] hover:bg-white/10"
              data-testid="provenance-export-json"
              title="Download provenance as JSON"
            >
              <Download className="h-3 w-3 text-accent" /> JSON
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1 rounded-full glass px-2 py-1 text-[10px] hover:bg-white/10"
              data-testid="provenance-export-csv"
              title="Download provenance as CSV"
            >
              <Download className="h-3 w-3 text-accent" /> CSV
            </button>
            <button
              onClick={onClose}
              className="rounded-full hover:bg-white/10 p-1.5"
              aria-label="Close provenance"
              data-testid="provenance-close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Score</div>
            <div className="mt-1 flex items-end gap-2">
              <div className="text-3xl font-semibold">{explain.score}</div>
              <div className="text-xs text-muted-foreground pb-1">/ 100</div>
            </div>
            <div className="mt-2 font-mono text-[11px] text-cyan-glow break-words">
              {explain.formula}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
              Factor-level computation
            </div>
            <ul className="space-y-1.5">
              {explain.factors.map((f) => (
                <li
                  key={f.label}
                  className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/90">{f.label}</span>
                    <span className="tabular-nums">
                      {typeof f.value === "number" ? Math.round(f.value * 10) / 10 : f.value}
                      <span className="text-[10px] text-muted-foreground ml-1.5">
                        weight {f.weight}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`h-4 w-4 ${confTone[explain.confidence]}`} />
              <div className="text-xs font-medium">
                Confidence:{" "}
                <span className={confTone[explain.confidence]}>
                  {explain.confidence.toUpperCase()}
                </span>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
              {confidenceCopy[explain.confidence]} {explain.note}
            </p>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
              Source datasets
            </div>
            <ul className="space-y-1.5">
              {sources.map((s) => (
                <li
                  key={s.url}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      s.used ? "bg-emerald-glow" : "bg-white/25"
                    }`}
                  />
                  <span className="flex-1 truncate">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {s.used ? "Live" : "Planned"}
                  </span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-glow hover:underline inline-flex items-center gap-1"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {contextNote && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">{contextNote}</p>
          )}
        </div>
      </div>
    </div>
  );
}

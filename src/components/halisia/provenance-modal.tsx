import { X, ExternalLink, ShieldCheck, Download } from "lucide-react";
import type { ScoreExplain } from "@/lib/wave4-intel.functions";

/**
 * Provenance for one group of Wave 4 counts.
 *
 * It used to open on the group's score out of 100 with the arithmetic that
 * produced it printed underneath in monospace. Showing the formula was meant
 * as candour, but it answered the wrong question: a reader could see that a
 * transit stop was multiplied by six and still had no way to find out why six,
 * because there was no why. The score is gone and so is the arithmetic.
 *
 * What is laid out instead is what was counted, over what area, from which
 * source, with every raw figure and its unit, how well mapped the area is, and
 * links to the datasets so the whole thing can be checked at source.
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
  // Coverage describes the dataset here, not the place. Thin mapping is not
  // evidence that there is little nearby; it is evidence that little has been
  // mapped, and from a screen those two cannot be told apart.
  const confidenceCopy: Record<ScoreExplain["confidence"], string> = {
    high: "High — this area is densely mapped, so the counts are likely close to complete.",
    medium: "Medium — a workable sample came back, but some categories are sparsely mapped.",
    low: "Low — little is mapped at this coordinate. That may mean little is there, or that nobody has mapped it. Go and look.",
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
    // `score` is exported as null rather than dropped, so an export taken
    // before this change and one taken after line up field for field and the
    // difference is visible rather than silent.
    score: null,
    method: explain.method,
    coverage: explain.confidence,
    confidence: explain.confidence,
    confidenceWording: confidenceCopy[explain.confidence],
    note: explain.note,
    factors: explain.factors.map((f) => ({
      label: f.label,
      value: f.value,
      unit: f.unit,
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
    download(
      new Blob([JSON.stringify(buildPayload(), null, 2)], { type: "application/json" }),
      "json",
    );
  };

  const exportCsv = () => {
    const p = buildPayload();
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: string[] = [];
    rows.push("section,key,value,unit,confidence");
    rows.push(`method,${esc(p.title)},${esc(p.method)},,`);
    rows.push(`coverage,${esc(p.title)},${esc(p.confidenceWording)},,${esc(p.confidence)}`);
    for (const f of p.factors) {
      rows.push(`factor,${esc(f.label)},${esc(f.value)},${esc(f.unit)},`);
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
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              How this was obtained
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/90">
              {explain.method}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              No score is published for this group. Nothing below is weighted, combined or ranked.
            </p>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
              What was counted
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
                      {f.value == null ? "—" : Math.round(f.value * 10) / 10}
                      <span className="text-[10px] text-muted-foreground ml-1.5">{f.unit}</span>
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
                Mapping coverage:{" "}
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

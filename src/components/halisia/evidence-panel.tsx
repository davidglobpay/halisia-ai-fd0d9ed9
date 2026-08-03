import { BookOpen, ExternalLink, ShieldCheck } from "lucide-react";
import type { Confidence, EvidenceBundle } from "@/lib/evidence";

const TONE: Record<Confidence, string> = {
  high: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  medium: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  low: "border-red-400/40 bg-red-400/10 text-red-200",
};

export function ConfidencePill({ level }: { level: Confidence }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${TONE[level]}`}
    >
      {level} confidence
    </span>
  );
}

/**
 * Evidence & citations for an AI output: which signals were used, how strong
 * each one is, and where the underlying dataset can be inspected.
 */
export function EvidencePanel({
  title = "Evidence & citations",
  bundle,
  testId = "evidence-panel",
}: {
  title?: string;
  bundle: EvidenceBundle;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
      aria-label={title}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" /> {title}
        </div>
        <div className="flex items-center gap-2">
          <ConfidencePill level={bundle.overall} />
          <span className="font-numeric text-xs text-accent">{bundle.overallPct}%</span>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{bundle.wording}</p>

      <ul className="mt-3 grid gap-1.5">
        {bundle.signals.map((s) => (
          <li
            key={s.key}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
            data-testid="evidence-signal"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium">{s.label}</span>
              <ConfidencePill level={s.confidence} />
            </div>
            <div className="mt-1 text-[11px] text-foreground/85">{s.value}</div>
            <div className="text-[10px] text-muted-foreground">Used for: {s.used}</div>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <BookOpen className="h-3 w-3" aria-hidden="true" /> Underlying sources
        </div>
        <ul className="mt-1.5 grid gap-1.5">
          {bundle.citations.map((c) => (
            <li key={c.key} className="text-[11px]">
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                {c.label} <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <span className="text-muted-foreground"> — {c.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

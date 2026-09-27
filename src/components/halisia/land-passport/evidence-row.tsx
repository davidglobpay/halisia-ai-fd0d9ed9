import { CLASS_LABEL, CONFIDENCE_LABEL, type EvidenceItem } from "@/lib/passport-evidence";

/** One fact with its value, source, method, uses and confidence. */
export function EvidenceRow({ item }: { item: EvidenceItem }) {
  const gap = item.value == null;
  return (
    <li
      className="border-b border-foreground/10 py-2.5 last:border-0"
      data-testid="evidence-row"
      data-evidence-id={item.id}
      data-gap={gap ? "1" : "0"}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs text-muted-foreground">{item.label}</span>
        <span className="flex gap-1.5 text-[10px] uppercase tracking-wider">
          <span className="rounded-full border border-foreground/15 px-2 py-0.5 text-muted-foreground">
            {CLASS_LABEL[item.cls]}
          </span>
          <span className="rounded-full border border-foreground/15 px-2 py-0.5 text-muted-foreground">
            {CONFIDENCE_LABEL[item.confidence]}
          </span>
        </span>
      </div>
      <div
        className={`mt-0.5 text-sm break-words ${gap ? "text-muted-foreground italic" : "text-foreground"}`}
      >
        {gap ? "Not available" : item.value}
      </div>
      <details className="mt-1 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer select-none min-h-[28px] inline-flex items-center">
          Evidence & use
        </summary>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt>Source</dt>
          <dd className="break-words">{item.source}</dd>
          <dt>Method</dt>
          <dd className="break-words">{item.method}</dd>
          <dt>Used for</dt>
          <dd>{item.usedFor.length ? item.usedFor.join(", ") : "Not used in any score"}</dd>
          <dt>Retrieved</dt>
          <dd className="font-mono">{item.retrieved ?? "Reference data"}</dd>
        </dl>
      </details>
      {item.note && <p className="mt-1 text-[11px] text-muted-foreground">{item.note}</p>}
    </li>
  );
}

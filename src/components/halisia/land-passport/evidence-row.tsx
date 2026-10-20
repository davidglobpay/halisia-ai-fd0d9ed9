import type { ReactNode } from "react";
import { landUseContext } from "@/lib/passport-land-use";
import { CircleHelp, ArrowRight, Info, ShieldQuestion } from "lucide-react";
import { OutputVisual, OutputIcon } from "@/components/halisia/output-tools";
import { CLASS_LABEL, CONFIDENCE_LABEL, type EvidenceItem } from "@/lib/passport-evidence";
import { ListenButton } from "@/components/halisia/listen-button";
import { MapEvidencePreview } from "@/components/halisia/map-evidence-preview";
import { evidenceTarget, type MapEvidence, type EvidencePosition } from "@/lib/map-evidence";

/** One fact with its value, source, method, uses and confidence. */
export function EvidenceRow({
  item,
  mapItem,
  selectedMapId,
  onMapFocus,
  visual,
}: {
  item: EvidenceItem;
  visual?: ReactNode;
  mapItem?: MapEvidence;
  selectedMapId?: string | null;
  onMapFocus?: (id: string, position: EvidencePosition) => void;
}) {
  const gap = item.value == null;
  const target = mapItem ? evidenceTarget(mapItem) : null;
  return (
    <li
      className="my-3 rounded-2xl border border-foreground/10 bg-card/80 p-4 shadow-sm"
      data-testid="evidence-row"
      data-evidence-id={item.id}
      data-gap={gap ? "1" : "0"}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <OutputIcon subject={item.label} />
          {item.label}
        </span>
        <span className="flex gap-1.5 text-[10px] uppercase tracking-wider">
          <span className="rounded-full border border-foreground/15 px-2 py-0.5 text-muted-foreground">
            {CLASS_LABEL[item.cls]}
          </span>
          <span className="rounded-full border border-foreground/15 px-2 py-0.5 text-muted-foreground">
            {CONFIDENCE_LABEL[item.confidence]}
          </span>
          <ListenButton
            text={`${item.label}: ${gap ? "not available" : item.value}. Source: ${item.source}. Confidence: ${CONFIDENCE_LABEL[item.confidence]}.`}
          />
        </span>
      </div>
      <div
        className={`mt-0.5 text-sm break-words ${gap ? "text-muted-foreground italic" : "text-foreground"}`}
      >
        {gap ? "Evidence needed" : item.value}
      </div>
      {gap && (
        <div
          className="mt-3 rounded-xl border border-dashed border-foreground/20 bg-muted/40 p-3"
          data-testid="evidence-gap-guidance"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <CircleHelp size={18} aria-hidden="true" />
            Not checked yet
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Missing information does not mean there is no risk or no feature on the ground.
          </p>
          <div className="mt-2 flex items-start gap-2 text-xs">
            <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
            <span>
              {item.chapter === "trust" || item.id === "boundary"
                ? "Ask the relevant registry or a licensed professional for current records and a site check."
                : "Check the source details below. Retry the lookup or add a dated site observation for review."}
            </span>
          </div>
        </div>
      )}
      {!gap && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Info size={14} aria-hidden="true" />
          {item.cls === "user"
            ? "Submitted information · independent check needed"
            : item.cls === "ai" || item.cls === "modelled"
              ? "Estimate / interpretation · not a site inspection"
              : "Source-backed context · check scope and date"}
        </div>
      )}
      {visual}
      {!gap && item.chapter !== "climate" && mapItem && target && onMapFocus ? (
        <>
          <MapEvidencePreview
            item={mapItem}
            target={target}
            selected={selectedMapId === item.id}
            onFocus={() => onMapFocus(item.id, target)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {target.accuracyM == null
              ? "Accuracy unavailable"
              : `Reported uncertainty: ${target.accuracyM} m`}
            {" · "}
            {mapItem.capturedAt || "Capture date unavailable"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{mapItem.limitations}</p>
        </>
      ) : (
        <OutputVisual subject={item.label} value={item.value == null ? null : String(item.value)} />
      )}
      {!gap && (
        <details className="mt-3 rounded-xl bg-primary/5 p-3 text-xs">
          <summary className="min-h-11 cursor-pointer font-semibold">
            Land-use considerations
          </summary>
          <p className="mt-1">{landUseContext(item)}</p>
          <p className="mt-1 text-muted-foreground">
            Decision guidance · not a measured finding or suitability verdict
          </p>
        </details>
      )}
      <details className="mt-1 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer select-none min-h-[44px] inline-flex items-center">
          <ShieldQuestion size={15} className="mr-1.5" aria-hidden="true" /> Evidence & use
        </summary>
        {item.note && <p className="mb-2 text-xs">{item.note}</p>}
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
    </li>
  );
}

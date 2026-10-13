import {
  EVIDENCE_CLASS_LABELS,
  evidenceTarget,
  type MapEvidence,
  type EvidencePosition,
} from "../../lib/map-evidence";
import { KitButton } from "@/components/halisia/ds/button";
import { MapPin } from "lucide-react";

/** The parent focuses its existing map; this component performs no API requests. */
export function MapEvidenceCards({
  items,
  selectedId,
  onFocus,
}: {
  items: readonly MapEvidence[];
  selectedId: string | null;
  onFocus: (id: string, position: EvidencePosition) => void;
}) {
  return (
    <section aria-label="Evidence linked to the map">
      <p className="text-sm text-muted-foreground">
        Where imagery is available, its capture date must be checked separately.
        Imagery supports observations at its capture date. It does not confirm
        ownership, legal access or surveyed boundaries.
      </p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const target = evidenceTarget(item);
          return (
            <li
              key={item.id}
              className="min-w-0 break-words rounded-xl border border-foreground/15 bg-card p-3"
              data-evidence-id={item.id}
            >
              <h3 className="font-semibold">{item.label}</h3>
              <p>{item.finding}</p>
              <dl className="mt-2 space-y-1 text-xs [&_dt]:font-semibold [&_dd]:text-muted-foreground">
                <dt>Evidence class</dt>
                <dd>{EVIDENCE_CLASS_LABELS[item.evidenceClass]}</dd>
                <dt>Source</dt>
                <dd>{item.source || "Source unavailable"}</dd>
                <dt>Captured</dt>
                <dd>{item.capturedAt || "Capture date unavailable"}</dd>
                {item.retrievedAt && <><dt>Retrieved (not captured)</dt><dd>{item.retrievedAt}</dd></>}
                {item.method && <><dt>Method</dt><dd>{item.method}</dd></>}
                {item.confidence && <><dt>Finding confidence (not positional accuracy)</dt><dd>{item.confidence}</dd></>}
                <dt>Location accuracy</dt>
                <dd>
                  {target?.accuracyM != null
                    ? `Reported uncertainty: ${target.accuracyM} m`
                    : "Accuracy unavailable"}
                </dd>
                <dt>Supports</dt>
                <dd>{item.supports || "Not stated"}</dd>
                <dt>Limits</dt>
                <dd>{item.limitations || "Not stated"}</dd>
              </dl>
              <KitButton
                type="button"
                className="mt-3 min-h-12 w-full"
                disabled={!target}
                aria-pressed={selectedId === item.id}
                onClick={() => {
                  if (target) onFocus(item.id, target);
                }}
              >
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                {target ? "Show on map" : "Map evidence unavailable"}
              </KitButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import {
  EVIDENCE_CLASS_LABELS,
  evidenceTarget,
  type MapEvidence,
  type EvidencePosition,
} from "../../lib/map-evidence";

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
        Imagery supports observations at its capture date. It does not confirm
        ownership, legal access or surveyed boundaries.
      </p>
      <ul className="mt-3 space-y-3">
        {items.map((item) => {
          const target = evidenceTarget(item);
          return (
            <li
              key={item.id}
              className="rounded-xl border border-foreground/15 p-3"
            >
              <h3 className="font-semibold">{item.label}</h3>
              <p>{item.finding}</p>
              <dl className="mt-2 text-xs">
                <dt>Evidence class</dt>
                <dd>{EVIDENCE_CLASS_LABELS[item.evidenceClass]}</dd>
                <dt>Source</dt>
                <dd>{item.source || "Source unavailable"}</dd>
                <dt>Captured</dt>
                <dd>{item.capturedAt || "Capture date unavailable"}</dd>
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
              <button
                type="button"
                className="mt-2 min-h-11 rounded-lg border px-3"
                disabled={!target}
                aria-pressed={selectedId === item.id}
                onClick={() => {
                  if (target) onFocus(item.id, target);
                }}
              >
                {target ? "Show on map" : "Map evidence unavailable"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

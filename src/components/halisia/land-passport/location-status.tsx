import { AlertTriangle, Crosshair } from "lucide-react";
import {
  STATUS_META,
  locationConfidence,
  uncertaintyRadiusM,
  type Discrepancy,
  type LocationStatus,
} from "@/lib/location-validation";

/** Shows what kind of pin this is, why, from where, and how sure we are. */
export function LocationStatusCard({
  status,
  geocodeType,
  source,
  reason,
  discrepancies = [],
  issues = [],
}: {
  status: LocationStatus;
  geocodeType?: string | null;
  source: string;
  reason?: string;
  discrepancies?: Discrepancy[];
  issues?: string[];
}) {
  const meta = STATUS_META[status];
  const conf = locationConfidence(status, geocodeType);
  const radius = uncertaintyRadiusM(status, geocodeType);
  return (
    <div className="space-y-2" data-testid="location-status">
      <div className="rounded-2xl border border-white/10 bg-card/70 px-4 py-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Location confidence
          </span>
          <Crosshair className="h-3.5 w-3.5 text-accent" aria-hidden />
        </div>
        <div className="mt-1 font-mono text-lg text-foreground" data-testid="location-confidence">
          {conf}% — {meta.label}
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-black/10 overflow-hidden" aria-hidden>
          <div
            className={`h-full ${conf >= 80 ? "bg-primary" : conf >= 50 ? "bg-accent" : "bg-amber-glow"}`}
            style={{ width: `${conf}%` }}
          />
        </div>
        <p className="mt-2 text-muted-foreground">
          Source: {source}
          {geocodeType ? ` · precision class ${geocodeType}` : ""}
          {radius ? ` · may be off by ~${radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}` : ""}
        </p>
        {reason && <p className="mt-1 text-muted-foreground">{reason}</p>}
        {!meta.exact && (
          <p className="mt-1 text-[11px] text-foreground/80">
            This is not a surveyed parcel position or boundary. Indicative confidence, not a measured
            error.
          </p>
        )}
        {issues.map((i) => (
          <p key={i} className="mt-1 text-[11px] text-amber-glow">
            {i}
          </p>
        ))}
      </div>
      {discrepancies.map((d, i) => (
        <div
          key={i}
          role="alert"
          data-testid="location-discrepancy"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs"
        >
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> Location discrepancy detected
          </div>
          <ul className="mt-1 space-y-0.5 text-foreground/85">
            <li>Source A: {d.sourceA}</li>
            <li>Source B: {d.sourceB}</li>
            <li>{d.distanceKm != null ? `Difference: ${d.distanceKm} km` : d.detail}</li>
            <li>Confidence: low until resolved</li>
            <li>Next step: {d.action}</li>
          </ul>
        </div>
      ))}
    </div>
  );
}

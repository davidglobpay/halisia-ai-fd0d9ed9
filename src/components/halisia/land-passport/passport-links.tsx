import { Link } from "@tanstack/react-router";
import { IdCard, Landmark } from "lucide-react";
import { countyForPoint, validateCoordinate, type LocationStatus } from "@/lib/location-validation";

export type PassportTarget = {
  lat: number;
  lng: number;
  ref?: string;
  label?: string;
  source?: string;
  status?: LocationStatus;
  gt?: string;
  county?: string;
};

/** "View Land Passport" + "County Intelligence" — the same pair everywhere. */
export function PassportLinks({
  target,
  compact = false,
  className = "",
}: {
  target: PassportTarget;
  compact?: boolean;
  className?: string;
}) {
  const check = validateCoordinate(target.lat, target.lng);
  if (!check.ok || check.lat == null || check.lng == null) {
    return (
      <p className={`text-[11px] text-muted-foreground ${className}`} data-testid="passport-unavailable">
        Land Passport unavailable: {check.issues[0]}
      </p>
    );
  }
  const county = countyForPoint(check.lat, check.lng);
  const pill = compact ? "px-3 py-1.5 text-[11px]" : "px-4 py-2.5 text-xs";
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <Link
        to="/passport"
        search={{
          lat: check.lat,
          lng: check.lng,
          ref: target.ref ?? "",
          label: target.label ?? "",
          source: target.source ?? "",
          status: target.status ?? "approximate",
          gt: target.gt ?? "",
          county: target.county ?? "",
        }}
        data-testid="view-land-passport"
        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-primary font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90 transition ${pill}`}
      >
        <IdCard className="h-3.5 w-3.5" /> View Land Passport
      </Link>
      {county ? (
        <Link
          to="/county/$code"
          params={{ code: String(county.code) }}
          data-testid="county-intelligence"
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-foreground/20 font-semibold uppercase tracking-wider text-foreground hover:bg-foreground/5 transition ${pill}`}
        >
          <Landmark className="h-3.5 w-3.5 text-accent" /> County Intelligence · {county.name}
        </Link>
      ) : (
        <span className={`inline-flex items-center text-muted-foreground ${pill}`}>
          No county match for this point
        </span>
      )}
    </div>
  );
}

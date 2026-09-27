import { Link } from "@tanstack/react-router";
import { IdCard, Landmark } from "lucide-react";
import { countyByName, countyForPoint, validateCoordinate, type LocationStatus } from "@/lib/location-validation";

export type PassportTarget = {
  lat: number | null | undefined;
  lng: number | null | undefined;
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
  const pill = compact ? "px-3 py-1.5 text-[11px]" : "px-4 py-2.5 text-xs";
  const hasPoint = target.lat != null && target.lng != null;
  const check = hasPoint
    ? validateCoordinate(Number(target.lat), Number(target.lng))
    : { ok: false, lat: null, lng: null, issues: ["No coordinates were provided."] };
  if (!check.ok || check.lat == null || check.lng == null) {
    // Limited passport: identity + county only, with the location gap explained.
    const named = countyByName(target.county);
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <Link
          to="/passport"
          search={{
            ref: target.ref ?? "",
            label: target.label ?? "",
            source: target.source ?? "",
            county: target.county ?? "",
            noloc: check.issues[0] ?? "No usable coordinates.",
          }}
          data-testid="view-land-passport"
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-primary/40 font-semibold uppercase tracking-wider text-primary hover:bg-primary/5 transition ${pill}`}
        >
          <IdCard className="h-3.5 w-3.5" /> Land Passport (limited)
        </Link>
        {named && (
          <Link
            to="/county/$code"
            params={{ code: String(named.code) }}
            data-testid="county-intelligence"
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-foreground/20 font-semibold uppercase tracking-wider text-foreground hover:bg-foreground/5 transition ${pill}`}
          >
            <Landmark className="h-3.5 w-3.5 text-accent" /> County Intelligence · {named.name}
          </Link>
        )}
        <span className="basis-full text-[11px] text-muted-foreground" data-testid="passport-location-limit">
          No map position: {check.issues[0]} Location-based sections will be unavailable.
        </span>
      </div>
    );
  }
  const county = countyForPoint(check.lat, check.lng);
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

import { OutputTools, OutputVisual, OutputIcon } from "@/components/halisia/output-tools";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Clock,
  ExternalLink,
  Footprints,
  Loader2,
  Navigation,
  Phone,
  Car,
  Globe,
  Star,
  Circle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { getPlaceDetails, type PlaceDetails } from "@/lib/location-intel.functions";

type Place = {
  id: string;
  name: string;
  address?: string;
  distanceKm?: number;
  rating?: number;
  userRatingCount?: number;
  photoUrls?: string[];
  location?: { lat: number; lng: number };
  openNow?: boolean | null;
  weekdayText?: string[];
  phone?: string;
  website?: string;
  mapsUri?: string;
  priceLevel?: string;
  businessStatus?: string;
  driveMin?: number | null;
  walkMin?: number | null;
  driveKm?: number | null;
};

function fmtDist(km?: number | null) {
  if (km == null) return "—";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
function fmtMin(min?: number | null) {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function priceDots(level?: string) {
  if (!level) return "";
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return map[level] ?? "";
}

function StatusPill({
  status,
  businessStatus,
}: {
  status?: boolean | null;
  businessStatus?: string;
}) {
  if (businessStatus && businessStatus !== "OPERATIONAL") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
        <Circle className="h-2 w-2 fill-current" />
        {businessStatus === "CLOSED_TEMPORARILY" ? "Temp. closed" : "Closed"}
      </span>
    );
  }
  if (status == null) return null;
  return status ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-glow/15 text-emerald-glow border border-emerald-glow/30">
      <Circle className="h-2 w-2 fill-current" /> Open now
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-glow/15 text-amber-glow border border-amber-glow/30">
      <Circle className="h-2 w-2 fill-current" /> Closed
    </span>
  );
}

export function PlaceCard({ place, isBest }: { place: Place; isBest?: boolean }) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const details = useQuery<PlaceDetails>({
    queryKey: ["place-details", place.id],
    queryFn: () => getPlaceDetails({ data: { id: place.id } }),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  const navUrl =
    place.mapsUri ??
    (place.location
      ? `https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}`
      : undefined);

  const photo = place.photoUrls?.[0];
  const detailsFailed = !!details.error;
  const photos = details.data?.photoUrls?.length ? details.data.photoUrls : (place.photoUrls ?? []);
  const weekday = details.data?.weekdayText ?? place.weekdayText;

  return (
    <li
      data-output-card
      className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
    >
      <button
        data-output-content
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-stretch gap-3 text-left p-2 hover:bg-white/[0.04] transition"
      >
        {photo && failedPhoto !== photo ? (
          <img
            src={photo}
            alt={`Photo of ${place.name} from the place provider`}
            loading="lazy"
            className="h-16 w-16 flex-shrink-0 rounded-lg object-cover border border-white/10"
            onError={() => setFailedPhoto(photo ?? null)}
          />
        ) : (
          <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-white/5 border border-white/10 grid place-items-center">
            <OutputIcon subject={place.name} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium truncate">{place.name}</span>
            {isBest && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-glow/15 text-amber-glow border border-amber-glow/30 uppercase tracking-wider">
                Top rated
              </span>
            )}
            <StatusPill status={place.openNow} businessStatus={place.businessStatus} />
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            {place.rating != null && (
              <span className="inline-flex items-center gap-0.5 text-amber-glow">
                <Star className="h-3 w-3 fill-current" />
                {place.rating.toFixed(1)}
                {place.userRatingCount ? (
                  <span className="text-muted-foreground">({place.userRatingCount})</span>
                ) : null}
              </span>
            )}
            {priceDots(place.priceLevel) && <span>{priceDots(place.priceLevel)}</span>}
            <span className="inline-flex items-center gap-0.5">
              <Navigation className="h-3 w-3" />
              {fmtDist(place.driveKm ?? place.distanceKm)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-1.5 py-0.5">
              <Car className="h-3 w-3 text-accent" /> {fmtMin(place.driveMin)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-1.5 py-0.5">
              <Footprints className="h-3 w-3 text-cyan-glow" /> {fmtMin(place.walkMin)}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 self-center transition-transform text-muted-foreground ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div className="px-3 pb-2">
        <OutputTools label={place.name} />
        <p className="mt-1 text-[10px] text-muted-foreground">
          {photo && failedPhoto !== photo
            ? "Place-provider photo · nearby venue, not the parcel"
            : "Photo unavailable for this named place"}
        </p>
      </div>
      {open && (
        <div className="border-t border-white/10 p-3 space-y-2 text-xs">
          {place.address && <div className="text-muted-foreground">{place.address}</div>}
          <div className="flex flex-wrap gap-2">
            {navUrl && (
              <a
                href={navUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-accent text-primary-foreground px-2.5 py-1 text-[11px] font-medium hover:opacity-90"
              >
                <Navigation className="h-3 w-3" /> Navigate
              </a>
            )}
            {(details.data?.phone ?? place.phone) && (
              <a
                href={`tel:${details.data?.phone ?? place.phone}`}
                className="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] hover:bg-white/10"
              >
                <Phone className="h-3 w-3" /> {details.data?.phone ?? place.phone}
              </a>
            )}
            {(details.data?.website ?? place.website) && (
              <a
                href={details.data?.website ?? place.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] hover:bg-white/10"
              >
                <Globe className="h-3 w-3" /> Website <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {details.isLoading && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-muted-foreground"
            >
              <Loader2 className="h-3 w-3 animate-spin" /> Loading opening hours & reviews…
            </div>
          )}

          {detailsFailed && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border border-amber-glow/30 bg-amber-glow/10 px-2 py-1.5 text-[11px] text-amber-glow"
              data-testid="place-fallback"
            >
              <AlertCircle className="h-3.5 w-3.5 flex-none" />
              <span className="flex-1">Live data unavailable — showing cached snapshot.</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  details.refetch();
                }}
                className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] hover:bg-white/20"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}

          {weekday && weekday.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3" /> Opening hours
              </div>
              <ul className="grid grid-cols-1 gap-0.5 text-[11px] text-foreground/90">
                {weekday.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {photos.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {photos.slice(0, 6).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`${place.name} — provider photograph ${i + 1}`}
                  loading="lazy"
                  className="h-16 w-24 flex-shrink-0 object-cover rounded-md border border-white/10"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ))}
            </div>
          )}

          {details.data?.reviews && details.data.reviews.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Recent reviews
              </div>
              <ul className="space-y-1.5">
                {details.data.reviews.slice(0, 3).map((r, i) => (
                  <li key={i} className="rounded-lg bg-white/[0.03] border border-white/5 p-2">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {r.rating != null && (
                        <span className="inline-flex items-center gap-0.5 text-amber-glow">
                          <Star className="h-3 w-3 fill-current" />
                          {r.rating}
                        </span>
                      )}
                      <span>{r.author}</span>
                      {r.relativeTime && <span className="ml-auto">{r.relativeTime}</span>}
                    </div>
                    {r.text && (
                      <p className="mt-1 text-[11px] leading-snug text-foreground/85 line-clamp-4">
                        {r.text}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

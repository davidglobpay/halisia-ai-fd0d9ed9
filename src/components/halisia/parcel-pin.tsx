import { useCallback, useMemo, useState } from "react";
import { Loader2, MapPin, Navigation, Search, Undo2 } from "lucide-react";
import { MapView } from "@/components/halisia/map-view";
import { findLandmarks, type Landmark } from "@/lib/landmarks.functions";
import { ReadAloud } from "@/components/halisia/read-aloud";

/**
 * Place the pin on the plot, the way a ride-hail app places a pickup.
 *
 * The geocoder returns the centroid of a named place. A parcel has no name, so
 * that centroid can be hundreds of metres out in a town and kilometres out in
 * a rural ward. Nothing in the data closes that gap — but the person holding
 * the deed usually knows the ground. This hands them the satellite view and
 * two ways to get to it: search a landmark they recognise, then drag the pin
 * onto the plot by eye.
 *
 * What comes out is a point a human chose. It is not a survey, not a boundary,
 * and not evidence of ownership, and the panel says so where the person is
 * looking rather than in a footnote.
 */

export type PinnedPoint = {
  lat: number;
  lng: number;
  /** Metres from the originally geocoded point. */
  movedM: number;
  /** How this point came to be, for the record and for the PDF. */
  method: "geocoded" | "landmark" | "placed";
};

function haversine(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = ((bLat - aLat) * Math.PI) / 180;
  const dl = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Metres, in the unit a person would say out loud. */
function distanceLabel(m: number): string {
  if (m < 1) return "0 m";
  if (m < 950) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 9500 ? 1 : 0)} km`;
}

export function ParcelPin({
  origin,
  originLabel,
  originRadiusM = null,
  onChange,
  className = "",
}: {
  /** The geocoded point this started from. */
  origin: { lat: number; lng: number };
  /** What the geocoder matched, shown so the gap is visible. */
  originLabel?: string;
  /** Google's own uncertainty for that match, drawn as a ring. */
  originRadiusM?: number | null;
  onChange?: (p: PinnedPoint) => void;
  className?: string;
}) {
  const [pin, setPin] = useState<{ lat: number; lng: number }>(origin);
  const [method, setMethod] = useState<PinnedPoint["method"]>("geocoded");
  const [center, setCenter] = useState<{ lat: number; lng: number }>(origin);
  const [zoom, setZoom] = useState(16);

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Landmark[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const movedM = useMemo(
    () => haversine(origin.lat, origin.lng, pin.lat, pin.lng),
    [origin.lat, origin.lng, pin.lat, pin.lng],
  );

  const commit = useCallback(
    (next: { lat: number; lng: number }, how: PinnedPoint["method"]) => {
      setPin(next);
      setMethod(how);
      onChange?.({
        lat: next.lat,
        lng: next.lng,
        movedM: haversine(origin.lat, origin.lng, next.lat, next.lng),
        method: how,
      });
    },
    [onChange, origin.lat, origin.lng],
  );

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setNote(null);
    setResults(null);
    try {
      const res = await findLandmarks({
        data: { query: q, lat: pin.lat, lng: pin.lng },
      });
      if (!res.ok) {
        setNote(res.reason);
      } else if (!res.results.length) {
        setNote(res.reason ?? "No match near this point.");
      } else {
        setResults(res.results);
      }
    } catch {
      setNote(
        "Landmark search is unavailable right now. You can still drag the pin.",
      );
    } finally {
      setBusy(false);
    }
  }, [query, pin.lat, pin.lng]);

  const spoken =
    `Place the pin on your plot. The search matched ${originLabel ?? "a named place"}, ` +
    `which is the centre of that place, not your parcel. ` +
    (movedM >= 1
      ? `You have moved the pin ${distanceLabel(movedM)} from that match. `
      : `You have not moved the pin yet. `) +
    `Search for a landmark you recognise nearby, then drag the pin onto your land on the satellite view. ` +
    `The point you place is your own mark. It is not a survey, it does not set a boundary, ` +
    `and it says nothing about who owns the land.`;

  return (
    <div
      className={`rounded-2xl glass border border-white/10 p-4 ${className}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Step 1 · Place the pin
          </div>
          <h3 className="mt-0.5 text-base font-semibold leading-tight">
            Put the pin on your plot
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {originLabel ? (
              <>
                The search matched{" "}
                <span className="text-foreground">{originLabel}</span> — the
                centre of that place, not your parcel.{" "}
              </>
            ) : null}
            Find a landmark you know, then drag the pin onto your land.
          </p>
        </div>
        <ReadAloud text={spoken} label="Listen" />
      </div>

      {/* Landmark assist */}
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="parcel-pin-landmark">
          Nearest landmark
        </label>
        <input
          id="parcel-pin-landmark"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runSearch();
            }
          }}
          placeholder="Nearest landmark — a school, church, shopping centre, river…"
          className="min-w-0 flex-1 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-accent/60"
        />
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={busy || !query.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Find it
        </button>
      </div>

      {note && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {note}
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-2 space-y-1" data-testid="landmark-results">
          {results.map((r) => (
            <li key={`${r.name}-${r.lat}-${r.lng}`}>
              <button
                type="button"
                onClick={() => {
                  setCenter({ lat: r.lat, lng: r.lng });
                  setZoom(17);
                  commit({ lat: r.lat, lng: r.lng }, "landmark");
                  setResults(null);
                  setNote(
                    `Moved to ${r.name}. Now drag the pin from the landmark onto your plot.`,
                  );
                }}
                className="flex w-full items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
              >
                <Navigation
                  className="mt-0.5 h-3.5 w-3.5 flex-none text-accent"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {r.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {distanceLabel(r.distanceM)} {r.bearing}
                    {r.address ? ` · ${r.address}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* The map */}
      <div className="relative mt-3 h-[340px] overflow-hidden rounded-xl border border-white/10">
        <MapView
          center={center}
          zoom={zoom}
          marker={{ lat: pin.lat, lng: pin.lng, label: "Your plot" }}
          markerDraggable
          onMarkerDrag={(p) => commit(p, "placed")}
          onMapClick={(p) => commit(p, "placed")}
          accuracyRadiusM={method === "geocoded" ? originRadiusM : null}
          mapType="hybrid"
          theme="light"
          className="absolute inset-0"
        />
      </div>

      {/* Readout */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
        </span>
        <span className="text-muted-foreground">
          {method === "geocoded"
            ? "Not moved from the search match yet"
            : `Moved ${distanceLabel(movedM)} from the search match`}
        </span>
        {method !== "geocoded" && (
          <button
            type="button"
            onClick={() => {
              setCenter(origin);
              setZoom(16);
              commit(origin, "geocoded");
              setNote(null);
            }}
            className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            <Undo2 className="h-3 w-3" aria-hidden="true" />
            Reset
          </button>
        )}
      </div>

      <p className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-muted-foreground">
        The pin is a mark you placed. HALISIA does not survey it, does not treat
        it as a boundary, and reads nothing about ownership from it. A licensed
        surveyor sets boundaries and beacons.
      </p>
    </div>
  );
}

import { useState } from "react";
import { Crosshair, Loader2, Search } from "lucide-react";
import { Surface, KitButton } from "@/components/halisia/ds";
import { distanceM } from "@/lib/spatial-data";
import type { SpatialParcel } from "@/lib/spatial";
import { geocodeAddress } from "@/lib/geocode.functions";

/**
 * Location search for the Spatial studio.
 *
 * Accepts a current or superseded parcel/LR/title-deed identifier, a county or
 * place name, or a `lat, lng` pair, plus a "my location" shortcut. Search never
 * invents geometry: it resolves a target point and then selects the *nearest
 * parcel record*, always reporting how far that parcel is from the query.
 */

export type SpatialSearchResult = {
  parcelId: string;
  note: string;
};

const LATLNG = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

function nearest(parcels: SpatialParcel[], point: { lat: number; lng: number }) {
  let best: { p: SpatialParcel; d: number } | null = null;
  for (const p of parcels) {
    const d = distanceM(p.centroid, point);
    if (!best || d < best.d) best = { p, d };
  }
  return best;
}

function fmtDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function SpatialSearch({
  parcels,
  onResolved,
  onLocate,
  locating,
  locationError,
  note,
}: {
  parcels: SpatialParcel[];
  onResolved: (result: SpatialSearchResult) => void;
  onLocate: () => void;
  locating?: boolean;
  locationError?: string | null;
  /** Externally resolved note (e.g. the "my location" result). */
  note?: string | null;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    const query = q.trim();
    if (!query || !parcels.length) return;
    setBusy(true);
    setMessage(null);
    try {
      // 1) Direct identifier / name match against parcel records (current + legacy).
      const needle = query.toLowerCase();
      const direct = parcels.find((p) =>
        [p.parcelCode, p.titleDeedNo, p.legacyParcelCode, p.legacyTitleDeedNo, p.county, p.id]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
      if (direct) {
        const note = `Matched parcel record ${direct.parcelCode || direct.titleDeedNo}.`;
        setMessage(note);
        onResolved({ parcelId: direct.id, note });
        return;
      }

      // 2) Coordinate pair.
      const coords = LATLNG.exec(query);
      let point: { lat: number; lng: number } | null = null;
      let label = query;
      if (coords) {
        point = { lat: Number(coords[1]), lng: Number(coords[2]) };
        label = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
      } else {
        // 3) Geocode the free-text place name (Kenya-biased).
        const res = await geocodeAddress({ data: { query } });
        if (!res.ok) {
          setMessage(
            `No parcel record or place matched “${query}”. Try an LR / title-deed number, a place name, or "lat, lng".`,
          );
          return;
        }
        point = { lat: res.lat, lng: res.lng };
        label = res.address;
      }

      const best = nearest(parcels, point);
      if (!best) {
        setMessage("No parcel records are loaded yet.");
        return;
      }
      const note = `${label} → nearest parcel record ${
        best.p.parcelCode || best.p.titleDeedNo
      }, ${fmtDistance(best.d)} away. The studio renders that parcel record, not the search point.`;
      setMessage(note);
      onResolved({ parcelId: best.p.id, note });
    } catch (err) {
      setMessage(
        err instanceof Error ? `Search failed: ${err.message}` : "Search failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Surface elevation={1} className="mt-6 p-4" data-testid="spatial-search">
      <label
        htmlFor="spatial-search-input"
        className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
      >
        Find a location
      </label>
      <form
        className="mt-2 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="spatial-search-input"
            data-testid="spatial-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Place name, LR / title deed number, or lat, lng"
            className="focus-ring w-full rounded-xl border border-white/15 bg-white/5 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <KitButton type="submit" disabled={busy || !parcels.length} data-testid="spatial-search-go">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Search"}
        </KitButton>
        <KitButton
          type="button"
          variant="secondary"
          onClick={onLocate}
          disabled={locating}
          data-testid="spatial-search-locate"
        >
          <Crosshair className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {locating ? "Locating…" : "My location"}
        </KitButton>
      </form>
      <p
        className="mt-2 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
        data-testid="spatial-search-status"
      >
        {note ??
          message ??
          locationError ??
          "Search resolves to the nearest parcel record, including superseded identifiers."}
      </p>
    </Surface>
  );
}

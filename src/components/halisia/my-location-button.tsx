import { Loader2, LocateFixed } from "lucide-react";
import { useEffect, useState } from "react";
import { useMyLocation, accuracyNote } from "@/hooks/use-my-location";

/**
 * Floating "My Location" button for maps. Requests browser geolocation
 * and hands the coordinates to the parent map/route.
 *
 * The button reports how good the fix was. A browser returns a coordinate
 * whether it came from a satellite or from the network you happen to be
 * attached to, so a silent pin invites a user to trust a reading that may be
 * a kilometre out. An amber dot and a note say which one they got.
 */
export function MyLocationButton({
  onLocate,
  className = "",
  label = "My location",
}: {
  onLocate: (loc: { lat: number; lng: number; accuracy?: number }) => void;
  className?: string;
  label?: string;
}) {
  const [hydrated, setHydrated] = useState(false);
  const { request, loading, error } = useMyLocation();
  const [note, setNote] = useState<string | null>(null);
  const [coarse, setCoarse] = useState(false);
  useEffect(() => setHydrated(true), []);

  const go = async () => {
    setNote(null);
    setCoarse(false);
    const v = await request();
    if (!v) return;
    setNote(accuracyNote(v));
    setCoarse(v.grade === "coarse");
    onLocate(v);
  };

  const title = !hydrated
    ? "Loading location controls…"
    : (error ?? note ?? "Center map on my current location");

  return (
    <div className={`z-[401] flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        onClick={go}
        disabled={!hydrated || loading}
        aria-label="Center map on my current location"
        title={title}
        data-testid="map-my-location"
        className="inline-flex items-center gap-1.5 rounded-full glass-strong border border-white/15 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg hover:bg-white/10 transition disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
        ) : (
          <LocateFixed className="h-3.5 w-3.5 text-accent" />
        )}
        {label}
        {coarse && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-amber-glow"
            title="Low-accuracy reading"
          />
        )}
      </button>

      {(note || error) && (
        <p
          role="status"
          data-testid="map-my-location-note"
          className="max-w-[15rem] rounded-xl glass border border-white/10 px-2 py-1 text-right text-[10px] leading-snug text-muted-foreground"
        >
          {error ?? note}
        </p>
      )}
    </div>
  );
}

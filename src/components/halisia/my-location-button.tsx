import { Loader2, LocateFixed } from "lucide-react";
import { useMyLocation } from "@/hooks/use-my-location";

/**
 * Floating "My Location" button for maps. Requests browser geolocation
 * and hands the coordinates to the parent map/route.
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
  const { request, loading, error } = useMyLocation();
  const go = async () => {
    const v = await request();
    if (v) onLocate(v);
  };
  return (
    <button
      type="button"
      onClick={go}
      disabled={loading}
      aria-label="Center map on my current location"
      title={error ?? "Center map on my current location"}
      data-testid="map-my-location"
      className={`z-[401] inline-flex items-center gap-1.5 rounded-full glass-strong border border-white/15 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg hover:bg-white/10 transition disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
      ) : (
        <LocateFixed className="h-3.5 w-3.5 text-accent" />
      )}
      {label}
    </button>
  );
}

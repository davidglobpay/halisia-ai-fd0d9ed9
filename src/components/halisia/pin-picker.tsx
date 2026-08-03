import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import { MapFrame } from "./map-frame";
import { useMyLocation } from "@/hooks/use-my-location";

const Inner = lazy(() => import("./pin-picker.internal"));

function Fallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" /> Loading map…
    </div>
  );
}

/** Map pin picker: click or drag to set coordinates, or snap to GPS. */
export function PinPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const geo = useMyLocation();

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            const loc = await geo.request();
            if (loc) onPick(loc.lat, loc.lng);
          }}
          disabled={geo.loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent disabled:opacity-60"
        >
          {geo.loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Use my GPS location
        </button>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          {lat != null && lng != null
            ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : "Tap the map to drop a pin"}
        </span>
      </div>
      {geo.error && (
        <p role="status" className="text-[11px] text-red-300">
          {geo.error} — you can still drop the pin manually.
        </p>
      )}
      <MapFrame showBack={false} mobileAspect="aspect-[4/3]" desktopAspect="md:aspect-[16/9]">
        <ClientOnly fallback={<Fallback />}>
          <Suspense fallback={<Fallback />}>
            <Inner lat={lat} lng={lng} onPick={onPick} />
          </Suspense>
        </ClientOnly>
      </MapFrame>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, X } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import type { MapLocation } from "@/components/halisia/map-view";

type StreetViewState = "loading" | "ready" | "unavailable" | "error";

export function StreetViewPanel({
  location,
  onClose,
}: {
  location: MapLocation;
  onClose: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [state, setState] = useState<StreetViewState>("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !el.current) return;
        const service = new g.maps.StreetViewService();
        service.getPanorama(
          {
            location: { lat: location.lat, lng: location.lng },
            radius: 100,
            source: g.maps.StreetViewSource.OUTDOOR,
          },
          (data, status) => {
            if (cancelled || !el.current) return;
            const pano = data?.location?.pano;
            if (status !== g.maps.StreetViewStatus.OK || !pano) {
              setState("unavailable");
              return;
            }
            panoramaRef.current = new g.maps.StreetViewPanorama(el.current, {
              pano,
              addressControl: true,
              linksControl: true,
              motionTracking: false,
              motionTrackingControl: true,
              panControl: true,
              zoomControl: true,
              fullscreenControl: true,
              enableCloseButton: false,
            });
            setState("ready");
          },
        );
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
      if (panoramaRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(panoramaRef.current);
      }
      panoramaRef.current = null;
    };
  }, [location.lat, location.lng]);

  const externalUrl =
    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${location.lat},${location.lng}`;

  return (
    <section
      className="absolute inset-0 z-[1300] bg-[#071226]"
      aria-label="Street View"
      data-testid="street-view-panel"
    >
      <div ref={el} className="absolute inset-0" />
      <div className="absolute left-3 top-3 z-10 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[11px] text-white backdrop-blur">
        Google Street View · coverage varies
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-black/85"
        aria-label="Close Street View"
        data-testid="close-street-view"
      >
        <X className="h-4 w-4" />
      </button>

      {state === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-[#071226] text-sm text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking nearby Street View coverage…
          </div>
        </div>
      )}

      {(state === "unavailable" || state === "error") && (
        <div className="absolute inset-0 grid place-items-center bg-[#071226] p-6 text-center text-white">
          <div className="max-w-sm">
            <AlertTriangle className="mx-auto h-6 w-6 text-amber-400" />
            <h3 className="mt-3 text-base font-semibold">
              {state === "unavailable"
                ? "No outdoor Street View panorama was found nearby"
                : "Street View could not be loaded"}
            </h3>
            <p className="mt-2 text-sm text-white/70">
              Coverage and imagery dates are controlled by Google. Try opening the location in
              Google Maps or return to the map.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#071226]"
              >
                <ExternalLink className="h-4 w-4" /> Open in Google Maps
              </a>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-full border border-white/20 px-4 py-2 text-xs"
              >
                Return to map
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

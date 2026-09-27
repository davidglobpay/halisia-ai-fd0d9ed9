/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Loader2, EyeOff } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

type State = "loading" | "ready" | "none" | "error";

/** Google Street View at a point, or an honest "unavailable" message. */
export function StreetViewPanel({ lat, lng, className = "" }: { lat: number; lng: number; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    let pano: google.maps.StreetViewPanorama | null = null;
    setState("loading");
    loadGoogleMaps()
      .then((g) => {
        if (cancelled) return;
        if (window.__halisiaMapsAuthFailed) {
          setState("error");
          setMsg("Google Maps is not authorised on this web address, so Street View cannot load.");
          return;
        }
        new g.maps.StreetViewService().getPanorama(
          { location: { lat, lng }, radius: 150, source: g.maps.StreetViewSource.OUTDOOR },
          (data, status) => {
            if (cancelled || !el.current) return;
            if (status !== g.maps.StreetViewStatus.OK || !data?.location?.latLng) {
              setState("none");
              return;
            }
            pano = new g.maps.StreetViewPanorama(el.current, {
              position: data.location.latLng,
              pov: { heading: 0, pitch: 0 },
              addressControl: false,
              fullscreenControl: false,
              motionTracking: false,
            });
            setState("ready");
          },
        );
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
        setMsg("Google Maps could not load (missing key, network or billing). Street View is off.");
      });
    return () => {
      cancelled = true;
      if (pano) {
        window.google?.maps?.event?.clearInstanceListeners(pano);
        pano.setVisible(false);
      }
    };
  }, [lat, lng]);

  return (
    <div className={`relative overflow-hidden bg-muted ${className}`} data-testid="street-view">
      <div ref={el} className="absolute inset-0" />
      {state !== "ready" && (
        <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-muted-foreground">
          {state === "loading" ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-accent" /> Looking for Street View…
            </span>
          ) : (
            <span className="inline-flex max-w-xs flex-col items-center gap-2" role="status">
              <EyeOff className="h-5 w-5" />
              {state === "none" ? "Street View unavailable at this location" : msg}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

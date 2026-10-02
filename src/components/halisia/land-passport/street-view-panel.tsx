/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Loader2, EyeOff } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

type State = "loading" | "ready" | "none" | "error";

/**
 * Google Street View at a point, or an honest "unavailable" message.
 *
 * Three things were stopping this from ever showing a panorama.
 *
 * 1. The root div hardcoded `relative` and then appended the caller's class
 *    list, which is `absolute inset-0` at both call sites. Tailwind emits
 *    `.relative` after `.absolute`, so the element computed to `position:
 *    relative`, `inset-0` did nothing, and since both children are absolutely
 *    positioned the container had no content and collapsed to zero height. A
 *    zero-height panorama renders blank. `map-view.tsx` already guards against
 *    this collision; this component now does the same.
 *
 * 2. The loader never imported the `streetView` library, so
 *    `g.maps.StreetViewSource` was undefined and reading `.OUTDOOR` threw a
 *    TypeError inside the promise chain. The catch reported that as a missing
 *    API key, which sent anyone debugging it to the wrong place entirely.
 *
 * 3. `StreetViewSource.OUTDOOR` within 150 m excludes user photospheres, which
 *    are a large share of Google's Kenyan coverage outside the trunk roads.
 *    The search now falls back to the default source at a wider radius, and
 *    says which radius it tried when it finds nothing.
 */

/** Official outdoor imagery first, then anything within a wider ring. */
const PASSES: Array<{ radius: number; outdoor: boolean }> = [
  { radius: 150, outdoor: true },
  { radius: 600, outdoor: false },
];

export function StreetViewPanel({
  lat,
  lng,
  className = "",
}: {
  lat: number;
  lng: number;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");

  // Callers pass their own positioning. Adding `relative` on top of an
  // `absolute` class silently wins in the cascade and collapses the box.
  const hasPositionClass = /\b(absolute|relative|fixed|sticky)\b/.test(className);

  useEffect(() => {
    let cancelled = false;
    let pano: google.maps.StreetViewPanorama | null = null;
    setState("loading");
    setMsg("");

    const onAuthFail = () => {
      if (cancelled) return;
      if (pano) pano.setVisible(false);
      setState("error");
      setMsg(
        "Street View unavailable: Google Maps has not authorised this web address yet. Map and satellite views still work.",
      );
    };
    window.addEventListener("halisia:maps-auth-failed", onAuthFail);

    loadGoogleMaps()
      .then(async (g) => {
        if (cancelled) return;
        if (window.__halisiaMapsAuthFailed) {
          onAuthFail();
          return;
        }

        // Belt and braces: the loader imports this, but an older cached
        // bootstrap might not have, and a missing namespace should read as
        // "unavailable", never as a billing problem.
        if (typeof g.maps.importLibrary === "function" && !g.maps.StreetViewService) {
          await g.maps.importLibrary("streetView").catch(() => undefined);
        }
        if (!g.maps.StreetViewService) {
          setState("error");
          setMsg("Street View could not start on this device. Map and satellite views still work.");
          return;
        }

        const service = new g.maps.StreetViewService();

        const attempt = (i: number): void => {
          if (cancelled || !el.current) return;
          if (i >= PASSES.length) {
            setState("none");
            setMsg(
              `No Street View imagery within ${PASSES[PASSES.length - 1].radius} m of this point.`,
            );
            return;
          }
          const pass = PASSES[i];
          const request: google.maps.StreetViewLocationRequest = {
            location: { lat, lng },
            radius: pass.radius,
          };
          // StreetViewSource may be absent on an older bootstrap; omitting the
          // key is the same as asking for the default source.
          if (pass.outdoor && (g.maps as { StreetViewSource?: { OUTDOOR?: unknown } }).StreetViewSource?.OUTDOOR) {
            request.source = g.maps.StreetViewSource.OUTDOOR;
          }

          service.getPanorama(request, (data, status) => {
            if (cancelled || !el.current) return;
            if (status !== g.maps.StreetViewStatus.OK || !data?.location?.latLng) {
              attempt(i + 1);
              return;
            }
            pano = new g.maps.StreetViewPanorama(el.current, {
              position: data.location.latLng,
              pov: { heading: 0, pitch: 0 },
              zoom: 1,
              visible: true,
              addressControl: false,
              fullscreenControl: false,
              motionTracking: false,
              motionTrackingControl: false,
              linksControl: true,
              panControl: true,
              zoomControl: true,
            });
            setState("ready");
          });
        };

        attempt(0);
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
        setMsg("Google Maps could not load (missing key, network or billing). Street View is off.");
      });

    return () => {
      cancelled = true;
      window.removeEventListener("halisia:maps-auth-failed", onAuthFail);
      if (pano) {
        window.google?.maps?.event?.clearInstanceListeners(pano);
        pano.setVisible(false);
      }
    };
  }, [lat, lng]);

  return (
    <div
      className={`${hasPositionClass ? "" : "relative"} overflow-hidden bg-muted ${className}`}
      data-testid="street-view"
    >
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
              {state === "none"
                ? (msg ?? "Street View unavailable at this location")
                : msg}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

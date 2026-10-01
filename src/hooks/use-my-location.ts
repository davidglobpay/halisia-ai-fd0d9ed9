import { useCallback, useEffect, useRef, useState } from "react";
import { distanceMeters } from "@/lib/spatial";

/**
 * How trustworthy a position fix is.
 *
 * A browser returns a coordinate whether it came from a satellite or from a
 * guess based on the network you are attached to, and the shape of the object
 * is identical either way. Presenting both the same way is how a pin ends up
 * a kilometre from where the user is standing while the app looks confident.
 */
export type LocationGrade = "precise" | "approximate" | "coarse";

export type MyLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
  grade?: LocationGrade;
};

/** Satellite-grade. Good enough to stand on a boundary and read it. */
const PRECISE_M = 30;
/** Wi-Fi or cell-tower grade. Right neighbourhood, wrong plot. */
const APPROXIMATE_M = 150;
/**
 * Beyond this a fix is almost always derived from the IP address or a coarse
 * cell sector — town-level at best. It is not a position, and showing it as
 * one is worse than showing nothing.
 */
const UNUSABLE_M = 20_000;

declare global {
  interface Window {
    __halisiaForceGeolocationDenied?: boolean;
  }
}

/** GeolocationPositionError.code for permission denial (spec constant). */
const ERR_PERMISSION_DENIED = 1;

function geolocationAvailable(): boolean {
  return typeof window !== "undefined" && "geolocation" in navigator;
}

/**
 * Test-only backdoor used by the Playwright "permission denied" specs.
 * Gated to dev/test builds so a production page can never be tricked into
 * reporting a denied permission it does not have.
 */
function forceDenied(): boolean {
  if (!import.meta.env.DEV && !import.meta.env["MODE"]?.startsWith("test")) return false;
  return typeof window !== "undefined" && Boolean(window.__halisiaForceGeolocationDenied);
}

/**
 * Band a reported accuracy radius. A device that reports no accuracy at all
 * is treated as coarse rather than assumed good — the absence of a figure is
 * not evidence of precision.
 */
export function gradeFor(accuracy?: number): LocationGrade {
  if (accuracy == null || !Number.isFinite(accuracy)) return "coarse";
  if (accuracy <= PRECISE_M) return "precise";
  if (accuracy <= APPROXIMATE_M) return "approximate";
  return "coarse";
}

/** True when the fix is too coarse to mean anything at parcel scale. */
export function isUnusable(accuracy?: number): boolean {
  return accuracy != null && Number.isFinite(accuracy) && accuracy > UNUSABLE_M;
}

/**
 * A sentence a user can act on. Never says "your location" for a fix that is
 * not one.
 */
export function accuracyNote(v: MyLocation | null | undefined): string | null {
  if (!v) return null;
  const a = v.accuracy;
  if (a == null || !Number.isFinite(a)) {
    return "Your device did not report how accurate this reading is, so treat it as approximate.";
  }
  const shown = a >= 1000 ? `${(a / 1000).toFixed(1)} km` : `${Math.round(a)} m`;
  switch (v.grade ?? gradeFor(a)) {
    case "precise":
      return `Accurate to about ${shown} — a satellite fix.`;
    case "approximate":
      return `Accurate to about ${shown} — right area, not a parcel boundary.`;
    default:
      return `Accurate to about ${shown} — a network estimate, not your exact position.`;
  }
}

export function useMyLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<MyLocation | null>(null);
  const [watching, setWatching] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const watchId = useRef<number | null>(null);

  /** Release the active watchPosition subscription, if any. Idempotent. */
  const clearActiveWatch = useCallback(() => {
    if (watchId.current != null && geolocationAvailable()) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  /** Deterministic stop: release the watcher and flip state to not-watching. */
  const stop = useCallback(() => {
    clearActiveWatch();
    setWatching(false);
  }, [clearActiveWatch]);

  const request = useCallback(async (): Promise<MyLocation | null> => {
    if (forceDenied()) {
      setError("User denied Geolocation");
      return null;
    }
    if (!geolocationAvailable()) {
      setError("Geolocation is not supported by this device");
      return null;
    }
    setLoading(true);
    setError(null);
    return new Promise<MyLocation | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const accuracy = pos.coords.accuracy;
          // A town-sized radius is not a position. Refuse it rather than
          // drawing a confident pin in the wrong place.
          if (isUnusable(accuracy)) {
            setError(
              `Your device could only place you within about ${(accuracy / 1000).toFixed(0)} km. ` +
                "Turn on GPS or enter the coordinates yourself.",
            );
            setLoading(false);
            resolve(null);
            return;
          }
          const v: MyLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy,
            grade: gradeFor(accuracy),
          };
          setLocation(v);
          setSimulated(false);
          setLoading(false);
          resolve(v);
        },
        (err) => {
          setError(err.message || "Couldn't get your location. Check browser permissions.");
          setLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
      );
    });
  }, []);

  // Real-time tracking with a smoothed update (averaged with previous value)
  // to avoid jitter from noisy GPS accuracy fluctuations. Only ONE watcher is
  // ever active: calling watch() again releases the previous subscription
  // first, and the returned stop function / unmount always clears it.
  const watch = useCallback(
    (onUpdate?: (v: MyLocation) => void) => {
      // Restart safety — never leave two watchPosition subscriptions alive.
      clearActiveWatch();
      setWatching(false);
      if (forceDenied()) {
        setError("User denied Geolocation");
        return stop;
      }
      if (!geolocationAvailable()) {
        setError("Geolocation is not supported by this device");
        return stop;
      }
      setError(null);
      setWatching(true);
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const accuracy = pos.coords.accuracy;
          // Drop unusable fixes instead of letting them move the pin. The
          // watcher stays alive, because the next fix is often fine.
          if (isUnusable(accuracy)) {
            setError(
              "Skipped a reading your device could only place within " +
                `${(accuracy / 1000).toFixed(0)} km.`,
            );
            return;
          }
          const incoming: MyLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy,
            grade: gradeFor(accuracy),
          };
          setLocation((prev) => {
            // Calm smoothing: weighted average toward the new reading (0.35),
            // unless prior is missing or the jump is > ~50 m (real movement).
            // Distance uses the shared haversine helper so east–west movement
            // is measured correctly at any latitude.
            if (!prev) {
              onUpdate?.(incoming);
              return incoming;
            }
            const meters = distanceMeters(prev, incoming);
            if (meters > 50) {
              onUpdate?.(incoming);
              return incoming;
            }
            const smoothed: MyLocation = {
              lat: prev.lat * 0.65 + incoming.lat * 0.35,
              lng: prev.lng * 0.65 + incoming.lng * 0.35,
              accuracy: incoming.accuracy,
              grade: gradeFor(incoming.accuracy),
            };
            onUpdate?.(smoothed);
            return smoothed;
          });
          setSimulated(false);
        },
        (err) => {
          // Deterministic error state: permission denial ends the session and
          // releases the watcher; transient errors (timeout, position
          // unavailable) are surfaced but keep the subscription alive, since
          // browsers keep delivering fixes after them.
          if (err.code === ERR_PERMISSION_DENIED) {
            clearActiveWatch();
            setWatching(false);
          }
          setError(err.message || "Couldn't track your location.");
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
      );
      watchId.current = id;
      return stop;
    },
    [clearActiveWatch, stop],
  );

  // Manual / simulated location — bypasses the browser and works even when
  // geolocation permission has been denied. Stops any live watcher so a real
  // GPS fix can never overwrite the manual pin.
  //
  // The value is stored exactly as given, with no grade attached. A typed
  // coordinate has no measured radius, and inventing one would be the same
  // mistake this file exists to prevent. Callers read `simulated` to know the
  // pin was placed by hand.
  const simulate = useCallback(
    (v: MyLocation) => {
      stop();
      setLocation(v);
      setSimulated(true);
      setError(null);
    },
    [stop],
  );

  // Unmount always releases the watcher (no setState on unmount).
  useEffect(() => {
    return () => {
      if (watchId.current != null && geolocationAvailable()) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, []);

  return {
    request,
    watch,
    stop,
    simulate,
    loading,
    error,
    location,
    watching,
    simulated,
    grade: location?.grade ?? null,
    accuracyNote: accuracyNote(location),
  };
}

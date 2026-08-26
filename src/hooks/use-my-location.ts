import { useCallback, useEffect, useRef, useState } from "react";
import { distanceMeters } from "@/lib/spatial";

export type MyLocation = { lat: number; lng: number; accuracy?: number };

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
          const v: MyLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
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
          const incoming: MyLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
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

  return { request, watch, stop, simulate, loading, error, location, watching, simulated };
}

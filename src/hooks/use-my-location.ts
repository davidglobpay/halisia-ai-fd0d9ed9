import { useCallback, useEffect, useRef, useState } from "react";

export type MyLocation = { lat: number; lng: number; accuracy?: number };

export function useMyLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<MyLocation | null>(null);
  const [watching, setWatching] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const watchId = useRef<number | null>(null);

  const request = useCallback(async (): Promise<MyLocation | null> => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
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
  // to avoid jitter from noisy GPS accuracy fluctuations.
  const watch = useCallback(
    (onUpdate?: (v: MyLocation) => void) => {
      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        setError("Geolocation is not supported by this device");
        return () => {};
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
            if (!prev) {
              onUpdate?.(incoming);
              return incoming;
            }
            const meters =
              Math.hypot(incoming.lat - prev.lat, incoming.lng - prev.lng) * 111_320;
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
          setError(err.message || "Couldn't track your location.");
          setWatching(false);
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
      );
      watchId.current = id;
      return () => {
        if (watchId.current != null) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }
        setWatching(false);
      };
    },
    [],
  );

  // Manual / simulated location — bypasses the browser and works even when
  // geolocation permission has been denied.
  const simulate = useCallback((v: MyLocation) => {
    setLocation(v);
    setSimulated(true);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (watchId.current != null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  return { request, watch, simulate, loading, error, location, watching, simulated };
}
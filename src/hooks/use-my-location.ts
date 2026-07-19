import { useCallback, useState } from "react";

export type MyLocation = { lat: number; lng: number; accuracy?: number };

export function useMyLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<MyLocation | null>(null);

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

  return { request, loading, error, location };
}
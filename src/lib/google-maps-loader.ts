/// <reference types="google.maps" />

declare global {
  interface Window {
    google: typeof google;
    __halisiaGoogleMapsReady?: () => void;
  }
}

const SCRIPT_ID = "halisia-google-maps-js";
const CALLBACK_NAME = "__halisiaGoogleMapsReady";

let mapsPromise: Promise<typeof google> | null = null;

export function resetGoogleMapsLoader() {
  mapsPromise = null;
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps needs a browser"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

  if (!key) return Promise.reject(new Error("Google Maps browser key is missing"));

  mapsPromise = new Promise((resolve, reject) => {
    let settled = false;

    const finish = () => {
      if (settled || !window.google?.maps) return;
      settled = true;
      resolve(window.google);
    };

    window[CALLBACK_NAME] = finish;

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      mapsPromise = null;
      reject(new Error("Google Maps timed out while loading"));
    }, 15_000);

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => {
          window.clearTimeout(timeout);
          mapsPromise = null;
          reject(new Error("Failed to load Google Maps"));
        },
        { once: true },
      );
      return;
    }

    const params = new URLSearchParams({
      key,
      loading: "async",
      callback: CALLBACK_NAME,
    });
    if (channel) params.set("channel", channel);

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      mapsPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    script.addEventListener(
      "load",
      () => {
        window.clearTimeout(timeout);
        finish();
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return mapsPromise;
}
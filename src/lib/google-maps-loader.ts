/// <reference types="google.maps" />
import { setMapsJsStatus } from "@/lib/static-map-cache";

declare global {
  interface Window {
    google: typeof google;
    __halisiaGoogleMapsReady?: () => void;
    gm_authFailure?: () => void;
    __halisiaMapsAuthFailed?: boolean;
  }
}

const SCRIPT_ID = "halisia-google-maps-js";
const CALLBACK_NAME = "__halisiaGoogleMapsReady";

let mapsPromise: Promise<typeof google> | null = null;

function waitForMapConstructor(g: typeof google, timeoutMs = 8_000): Promise<typeof google> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (typeof g.maps.Map === "function") {
        resolve(g);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error("Google Maps loaded without the Map library"));
        return;
      }
      window.setTimeout(check, 50);
    };
    check();
  });
}

async function ensureGoogleMapsReady(): Promise<typeof google> {
  const g = window.google;
  if (!g?.maps) throw new Error("Google Maps is not available yet");

  if (typeof g.maps.importLibrary === "function") {
    await g.maps.importLibrary("maps");
    await g.maps.importLibrary("marker").catch(() => undefined);
    // Street View is a separate library under the dynamic bootstrap. Without
    // this, g.maps.StreetViewService and g.maps.StreetViewSource are
    // undefined, and the panel's attempt to read StreetViewSource.OUTDOOR
    // throws a TypeError that gets reported to the user as a missing API key.
    await g.maps.importLibrary("streetView").catch(() => undefined);
  }

  return waitForMapConstructor(g);
}

export function resetGoogleMapsLoader() {
  mapsPromise = null;
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Google Maps needs a browser"));

  // Register the global auth-failure hook Google calls when the key is
  // rejected (referrer restriction, billing, key disabled). It fires AFTER
  // the script loads successfully, so we surface it into diagnostics and
  // let map consumers listen for the `halisia:maps-auth-failed` event to
  // fall back to Leaflet.
  if (typeof window !== "undefined" && !window.gm_authFailure) {
    window.gm_authFailure = () => {
      window.__halisiaMapsAuthFailed = true;
      setMapsJsStatus(
        "error",
        "Google Maps refused this domain (RefererNotAllowedMapError or key disabled)",
      );
      try {
        window.dispatchEvent(new CustomEvent("halisia:maps-auth-failed"));
      } catch {
        /* ignore */
      }
    };
  }

  if (window.google?.maps) return ensureGoogleMapsReady();
  if (mapsPromise) return mapsPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

  if (!key) {
    setMapsJsStatus("error", "Google Maps browser key is missing");
    return Promise.reject(new Error("Google Maps browser key is missing"));
  }
  setMapsJsStatus("loading");

  mapsPromise = new Promise((resolve, reject) => {
    let settled = false;

    const finish = () => {
      if (settled || !window.google?.maps) return;
      ensureGoogleMapsReady()
        .then((g) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          resolve(g);
        })
        .catch((error: unknown) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          mapsPromise = null;
          reject(error);
        });
    };

    window[CALLBACK_NAME] = finish;

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      mapsPromise = null;
      setMapsJsStatus("error", "Google Maps timed out while loading");
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
      setMapsJsStatus("error", "Failed to load Google Maps script");
      reject(new Error("Failed to load Google Maps"));
    };
    script.addEventListener(
      "load",
      () => {
        finish();
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  mapsPromise
    .then(() => setMapsJsStatus("ready"))
    .catch((e) => setMapsJsStatus("error", String(e).slice(0, 200)));
  return mapsPromise;
}

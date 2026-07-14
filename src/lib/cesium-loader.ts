// Loads CesiumJS from a CDN so the heavy asset bundle stays out of Vite.
// Returns the global `Cesium` namespace once ready.

const CESIUM_VERSION = "1.121.0";
const CDN_BASE = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let promise: Promise<any> | null = null;

export function loadCesium(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject(new Error("Cesium needs a browser"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.Cesium) return Promise.resolve(w.Cesium);
  if (promise) return promise;

  promise = new Promise((resolve, reject) => {
    w.CESIUM_BASE_URL = CDN_BASE;

    if (!document.querySelector('link[data-cesium="1"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${CDN_BASE}Widgets/widgets.css`;
      link.dataset.cesium = "1";
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-cesium="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(w.Cesium), { once: true });
      existing.addEventListener("error", () => reject(new Error("Cesium failed to load")), {
        once: true,
      });
      return;
    }

    const s = document.createElement("script");
    s.src = `${CDN_BASE}Cesium.js`;
    s.async = true;
    s.dataset.cesium = "1";
    s.onload = () => (w.Cesium ? resolve(w.Cesium) : reject(new Error("Cesium missing")));
    s.onerror = () => {
      promise = null;
      reject(new Error("Cesium script error"));
    };
    document.head.appendChild(s);
  });
  return promise;
}
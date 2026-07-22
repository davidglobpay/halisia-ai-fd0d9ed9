/**
 * Lightweight, framework-agnostic analytics sink. Emits both a
 * `window.dataLayer` push (GTM-compatible) and a `CustomEvent` on window so
 * any listener (product analytics, tests) can observe funnel events without
 * coupling to a specific vendor.
 */
export type HalisiaAnalyticsEvent =
  | { name: "search_open"; source: "floating" | "hero" | "shortcut" }
  | { name: "search_location_selected"; kind: string; query: string; via: "geolocation" | "suggestion" | "manual" }
  | { name: "search_geolocation"; status: "requested" | "granted" | "denied" | "unavailable" | "error"; message?: string }
  | { name: "report_requested"; query: string; source: string };

interface DataLayerWindow extends Window {
  dataLayer?: Array<Record<string, unknown>>;
}

export function track(event: HalisiaAnalyticsEvent) {
  if (typeof window === "undefined") return;
  try {
    const w = window as DataLayerWindow;
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: event.name, ...event });
    window.dispatchEvent(new CustomEvent(`halisia:${event.name}`, { detail: event }));
  } catch {
    /* analytics must never break the UI */
  }
}
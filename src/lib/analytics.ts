/**
 * Lightweight, framework-agnostic analytics sink. Emits both a
 * `window.dataLayer` push (GTM-compatible) and a `CustomEvent` on window so
 * any listener (product analytics, tests) can observe funnel events without
 * coupling to a specific vendor.
 */
export type HalisiaAnalyticsEvent =
  | { name: "search_open"; source: "floating" | "hero" | "shortcut" }
  | {
      name: "search_location_selected";
      kind: string;
      query: string;
      via: "geolocation" | "suggestion" | "manual";
    }
  | {
      name: "search_geolocation";
      status: "requested" | "granted" | "denied" | "unavailable" | "error";
      message?: string;
    }
  | { name: "report_requested"; query: string; source: string }
  | { name: "search_cache_hit"; query: string; ageMs: number }
  | { name: "pipeline_stage_view"; stage: string; index: number }
  | { name: "pipeline_stage_click"; stage: string; index: number; tone: string }
  | { name: "pipeline_source_click"; stage: string; url: string }
  | { name: "pipeline_motion_toggled"; reduced: boolean }
  | { name: "analytics_consent_changed"; granted: boolean };

interface DataLayerWindow extends Window {
  dataLayer?: Array<Record<string, unknown>>;
}

const CONSENT_KEY = "halisia:analyticsConsent";
const CONSENT_EVENT = "halisia:analyticsConsentChanged";

export type ConsentState = "granted" | "denied" | "unset";

export function getAnalyticsConsent(): ConsentState {
  if (typeof window === "undefined") return "unset";
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    if (v === "granted" || v === "denied") return v;
  } catch {
    /* storage disabled */
  }
  return "unset";
}

export function setAnalyticsConsent(granted: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { granted } }));
  // The consent event itself is operational, not funnel; always emit locally.
  try {
    window.dispatchEvent(
      new CustomEvent("halisia:analytics_consent_changed", { detail: { granted } }),
    );
  } catch {
    /* ignore */
  }
}

/** Subscribe to consent changes (returns unsubscribe). */
export function onConsentChange(cb: (state: ConsentState) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb(getAnalyticsConsent());
  window.addEventListener(CONSENT_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CONSENT_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function track(event: HalisiaAnalyticsEvent) {
  if (typeof window === "undefined") return;
  // Honor opt-out: without explicit consent, do NOT push to dataLayer or
  // dispatch funnel events. Consent-change events themselves bypass this.
  if (event.name !== "analytics_consent_changed") {
    if (getAnalyticsConsent() !== "granted") return;
  }
  try {
    const w = window as DataLayerWindow;
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: event.name, ...event });
    window.dispatchEvent(new CustomEvent(`halisia:${event.name}`, { detail: event }));
  } catch {
    /* analytics must never break the UI */
  }
}

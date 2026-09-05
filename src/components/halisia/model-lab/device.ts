/**
 * Model Lab device/platform helpers. Pure functions only — safe for SSR and
 * unit tests. Isolated from production Spatial platform code.
 */
import type { ModelLabEntry } from "./registry";

export type LabPlatform = "ios" | "android" | "desktop";

export function labPlatformFromUA(userAgent: string, maxTouchPoints = 0): LabPlatform {
  const ua = (userAgent || "").toLowerCase();
  if (/iphone|ipod|ipad/.test(ua)) return "ios";
  if (/macintosh/.test(ua) && maxTouchPoints > 1) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

/** Same-origin relative URLs and absolute HTTPS URLs only. */
export function isAllowedModelUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("//")) return false;
  if (url.startsWith("/")) return true;
  return /^https:\/\//i.test(url);
}

/** Absolute HTTPS URL required by Scene Viewer. */
export function absoluteHttpsUrl(url: string, origin?: string): string | null {
  if (!url) return null;
  if (/^https:\/\//i.test(url)) return url;
  if (!url.startsWith("/")) return null;
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!base || !/^https:\/\//i.test(base)) return null;
  return `${base.replace(/\/$/, "")}${url}`;
}

/**
 * Scene Viewer intent for building candidates ONLY. Environment shells never
 * get a native AR action.
 *
 * `fallbackUrl` is where the browser lands if the intent cannot be handled.
 * It must NOT be the GLB itself — that dumps the user into a multi-megabyte
 * raw download. Callers pass the current page URL.
 */
export function sceneViewerIntent(
  model: ModelLabEntry,
  origin?: string,
  fallbackUrl?: string,
): string | null {
  if (model.kind !== "building") return null;
  const abs = absoluteHttpsUrl(model.glbUrl, origin);
  if (!abs) return null;
  const fallback =
    fallbackUrl ?? (typeof window !== "undefined" ? window.location.href : abs);
  return (
    `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(abs)}` +
    `&mode=ar_preferred&title=${encodeURIComponent(model.name)}` +
    `#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;` +
    `S.browser_fallback_url=${encodeURIComponent(fallback)};end;`
  );
}


export const QUICK_LOOK_UNAVAILABLE_MESSAGE =
  "AR Quick Look is unavailable for this model because no USDZ asset has been provided.";

export function quickLookState(model: ModelLabEntry): {
  enabled: boolean;
  href: string | null;
  message: string;
} {
  return {
    enabled: false,
    href: model.usdzUrl,
    message: QUICK_LOOK_UNAVAILABLE_MESSAGE,
  };
}

/** Truthful summary of what each platform can actually do here. */
export function arCapabilitySummary(platform: LabPlatform): string {
  switch (platform) {
    case "ios":
      return "iOS Safari does not expose WebXR immersive AR. Interactive GLB/WebGL works; AR Quick Look needs a USDZ asset, which has not been provided.";
    case "android":
      return "Android Chrome may support WebXR immersive AR via ARCore, and Scene Viewer is offered for building candidates. Both require a physical device to verify.";
    default:
      return "Desktop browsers run the interactive WebGL viewer. Immersive AR requires a supported handset; immersive VR requires a connected headset.";
  }
}

export function fullscreenSupported(doc?: Document | null): boolean {
  if (!doc) return false;
  const d = doc as Document & { webkitFullscreenEnabled?: boolean };
  return Boolean(d.fullscreenEnabled ?? d.webkitFullscreenEnabled ?? false);
}

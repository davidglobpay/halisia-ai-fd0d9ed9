/**
 * Esri raster tile URLs.
 *
 * With an ArcGIS Location Platform API key (VITE_ARCGIS_API_KEY, or
 * ARCGIS_BROWSER_API_KEY in src/config/public-browser-keys.ts; a browser key
 * restricted to HALISIA's domains with the "Static basemap tiles" privilege),
 * World Imagery and World Hillshade load from Esri's licensed, metered host
 * (ibasemaps-api.arcgis.com) — the route Esri's terms require for a commercial
 * app. Without a key, or with a value that is not an API key (for example an
 * ArcGIS Maps SDK "runtimelite,…" licence string, which only works in native
 * mobile apps), the public host is used exactly as before.
 *
 * The keyed host serves only these two services; Topo, Street and the reference
 * overlays stay on the public host.
 */

import { ARCGIS_BROWSER_API_KEY } from "@/config/public-browser-keys";

export type EsriService =
  | "World_Imagery"
  | "Elevation/World_Hillshade"
  | "World_Topo_Map"
  | "World_Street_Map"
  | "Reference/World_Hydro_Reference_Overlay"
  | "Reference/World_Boundaries_and_Places";

const PUBLIC_HOST = "https://server.arcgisonline.com/ArcGIS/rest/services";
const KEYED_HOST = "https://ibasemaps-api.arcgis.com/arcgis/rest/services";
const KEYED_SERVICES: ReadonlySet<EsriService> = new Set([
  "World_Imagery",
  "Elevation/World_Hillshade",
]);

/** True for something shaped like an ArcGIS API key, false for licence strings or junk. */
export function isArcgisApiKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 40 || v.length > 2000) return false;
  // Native SDK licence strings are comma-separated ("runtimelite,1000,…").
  if (/^(runtime|native)/i.test(v) || /[\s,]/.test(v)) return false;
  return /^[A-Za-z0-9._~-]+$/.test(v);
}

/** The configured browser key, or undefined when none (or an unusable value) is set. */
export function arcgisApiKey(): string | undefined {
  let raw: unknown;
  try {
    raw = import.meta.env?.VITE_ARCGIS_API_KEY;
  } catch {
    raw = undefined;
  }
  if (isArcgisApiKey(raw)) return raw.trim();
  return isArcgisApiKey(ARCGIS_BROWSER_API_KEY) ? ARCGIS_BROWSER_API_KEY.trim() : undefined;
}

function base(service: EsriService, key: string | undefined) {
  const keyed = !!key && KEYED_SERVICES.has(service);
  return {
    root: `${keyed ? KEYED_HOST : PUBLIC_HOST}/${service}/MapServer/tile`,
    query: keyed ? `?token=${encodeURIComponent(key!)}` : "",
  };
}

/** Template with {z}/{y}/{x} placeholders for Leaflet and Cesium. */
export function esriTileTemplate(service: EsriService, key: string | undefined = arcgisApiKey()) {
  const { root, query } = base(service, key);
  return `${root}/{z}/{y}/{x}${query}`;
}

/** A single tile URL. */
export function esriTileUrl(
  service: EsriService,
  z: number,
  y: number,
  x: number,
  key: string | undefined = arcgisApiKey(),
) {
  const { root, query } = base(service, key);
  return `${root}/${z}/${y}/${x}${query}`;
}

/** Whether satellite imagery is currently served through the licensed key. */
export function esriImageryLicensed(key: string | undefined = arcgisApiKey()) {
  return !!key;
}

/**
 * The same tile on the public host, or null when the URL is not a keyed Esri
 * tile. A keyed request fails when the key is expired, over quota, missing a
 * privilege or used from a domain it is not restricted to; the public host
 * then still serves the same imagery, so maps never go blank for that reason.
 */
export function publicTileFallback(url: string): string | null {
  if (!url.startsWith(KEYED_HOST)) return null;
  const path = url.slice(KEYED_HOST.length).replace(/\?.*$/, "");
  return `${PUBLIC_HOST}${path}`;
}

/** Load one tile as an image (CORS-clean for canvases), keyed host first, then public. */
export function loadTileImage(url: string): Promise<HTMLImageElement | null> {
  const attempt = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  return attempt(url).then((img) => {
    if (img) return img;
    const alt = publicTileFallback(url);
    return alt ? attempt(alt) : null;
  });
}

/**
 * Leaflet `tileerror` handler: retry a failed keyed Esri tile once on the
 * public host. Returns true when it retried (so callers can skip their own
 * error handling for that tile).
 */
export function retryTileOnPublicHost(event: { tile?: unknown }): boolean {
  const tile = event.tile as HTMLImageElement | undefined;
  if (!tile || typeof tile.src !== "string" || tile.dataset?.retried) return false;
  const alt = publicTileFallback(tile.src);
  if (!alt) return false;
  tile.dataset.retried = "1";
  tile.src = alt;
  return true;
}

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

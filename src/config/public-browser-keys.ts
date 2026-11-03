/**
 * Browser keys that ship inside the website's JavaScript anyway. They live
 * here, not in .env, because Lovable regenerates .env from its own settings
 * and drops anything added by hand.
 *
 * Each key must be restricted by HTTP referrer to HALISIA's domains in its
 * provider console; that restriction, not secrecy, is what protects it.
 * Never put a server secret in this file.
 */

/**
 * ArcGIS Location Platform API key ("HALISIA web maps": Static basemap tiles
 * only, referrer-restricted). Paste the key between the quotes. While it is
 * empty, satellite imagery uses Esri's public host exactly as before.
 * VITE_ARCGIS_API_KEY, when set, takes precedence.
 */
export const ARCGIS_BROWSER_API_KEY = "";

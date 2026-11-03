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
 * only, referrer-restricted to halisia.ai, *.halisia.ai and *.lovable.app;
 * created 2026-11-03, expires after one year). When it is empty or invalid,
 * satellite imagery uses Esri's public host. VITE_ARCGIS_API_KEY, when set,
 * takes precedence.
 */
export const ARCGIS_BROWSER_API_KEY =
  "AAPTafn1hKwShvaRmtgyFKnRsnw..AQZwJEPatMkUNyy-N1biFcE7UxDqHDNKzQrY0cHLNY6SjX14JsswkKjr0VD9kH2PrA4P5acnQgOuL0pV3Wa3FZider1RTmDBNRZZv8S1E-y8dBli3Y6BSWlv5YUXHvWcJtebO_g6AHKIMOtoIvd5Xj9j32b-RYA7epsm7oQZx4Fitr8AkHG3vPmKHS4I0SZbyhP6dIKXIM2-8yosCL3iHcKBm140uiZQYpcOtfeBHRXMLS7tp9fjuiPa0w..AT1_A1Ib6TGz";

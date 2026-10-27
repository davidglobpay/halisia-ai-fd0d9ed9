/**
 * Site-mode URL parsing and the "last Passport location" hand-off.
 * Pure helpers (storage access is guarded) — safe for SSR and unit tests.
 */
export const SITE_STRUCTURES = ["container_20ft", "container_40ft", "masonry_stone"] as const;
export type SiteStructure = (typeof SITE_STRUCTURES)[number];

export type SiteParams = {
  lat: number | null;
  lng: number | null;
  typology: string;
  structure: SiteStructure;
  floorAreaM2: number | null;
};

const TYPOLOGY_RE = /^(bedsitter|[1-6]br)$/;

/** Parse `type=<typology>_<structure>`; null when unsupported. */
export function parseSiteType(
  type: unknown,
): { typology: string; structure: SiteStructure } | null {
  if (typeof type !== "string") return null;
  const i = type.indexOf("_");
  if (i <= 0) return null;
  const typology = type.slice(0, i);
  const structure = type.slice(i + 1);
  if (!TYPOLOGY_RE.test(typology)) return null;
  if (!(SITE_STRUCTURES as readonly string[]).includes(structure)) return null;
  return { typology, structure: structure as SiteStructure };
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse site-mode search params. Returns null when `type` is absent or not a
 * supported schematic. Out-of-range or partial coordinates yield null lat/lng
 * (flat ground), never a guessed position.
 */
export function parseSiteParams(search: Record<string, unknown>): SiteParams | null {
  const t = parseSiteType(search.type);
  if (!t) return null;
  let lat = num(search.lat);
  let lng = num(search.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    lat = null;
    lng = null;
  }
  const area = num(search.area);
  return {
    ...t,
    lat,
    lng,
    floorAreaM2: area !== null && area >= 10 && area <= 2000 ? area : null,
  };
}

export const LAST_PASSPORT_KEY = "halisia:last-passport-location";

export function saveLastPassportLocation(lat: number, lng: number) {
  try {
    window.localStorage.setItem(LAST_PASSPORT_KEY, JSON.stringify({ lat, lng }));
  } catch {
    /* storage unavailable — hand-off is optional */
  }
}

export function readLastPassportLocation(): { lat: number; lng: number } | null {
  try {
    const raw = window.localStorage.getItem(LAST_PASSPORT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
    const lat = num(v.lat);
    const lng = num(v.lng);
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** Build the /model-lab site-mode search object. */
export function siteModeSearch(
  typology: string,
  structure: string,
  loc: { lat: number; lng: number } | null,
  floorAreaM2?: number | null,
): Record<string, string> {
  const out: Record<string, string> = { type: `${typology}_${structure}` };
  if (loc) {
    out.lat = loc.lat.toFixed(6);
    out.lng = loc.lng.toFixed(6);
  }
  if (floorAreaM2) out.area = String(Math.round(floorAreaM2));
  return out;
}

import { supabase } from "@/integrations/supabase/client";
import {
  distanceMeters,
  geometryToRing,
  isPlausibleKenyaLatLng,
  toVerificationState,
  type CoordinateIssue,
  type SpatialParcel,
  type SpatialPrototype,
} from "./spatial";

type Row = Record<string, unknown>;

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Raw vertex count of a stored GeoJSON polygon, before any validation. */
function geometryToRingRaw(geometry: unknown): number {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || !Array.isArray(g.coordinates)) return 0;
  const outer = (g.type === "Polygon" ? g.coordinates[0] : g.coordinates) as unknown;
  return Array.isArray(outer) ? outer.length : 0;
}

/**
 * Public-safe projection of the parcel record used by the Spatial UI.
 * Deliberately explicit (no `*`) so owner UUIDs and other private columns are
 * never transmitted to the browser.
 */
const PARCEL_COLUMNS = [
  "id",
  "title_deed_no",
  "parcel_code",
  "legacy_parcel_code",
  "legacy_title_deed_no",
  "county",
  "centroid_lat",
  "centroid_lng",
  "geometry",
  "area_sqm",
  "elevation_masl",
  "zoning_type",
  "max_building_height_m",
  "road_setback_m",
  "riparian_setback_m",
  "valuation_kes",
  "status",
  "survey_verified_on",
  "verification_state",
  "verification_confidence",
  "verification_method",
  "verification_evidence_ref",
  "verification_updated_at",
].join(", ");

/** All publicly readable parcels with their survey beacons, ordered by county. */
export async function fetchSpatialParcels(): Promise<SpatialParcel[]> {
  const { data, error } = await supabase
    .from("parcels")
    .select(`${PARCEL_COLUMNS}, parcel_beacons(*)`)
    .order("county", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map((r) => {
    // Beacons whose coordinates are not plausible WGS84 Kenya points (NaN from
    // a null column, or a projected CRS such as Arc 1960 / UTM 37S) are dropped
    // so NaN can never reach the scene graph.
    const beacons = ((r["parcel_beacons"] as Row[] | null) ?? [])
      .map((b) => ({
        id: String(b["id"]),
        code: String(b["beacon_code"] ?? ""),
        lat: Number(b["lat"]),
        lng: Number(b["lng"]),
        elevationM: num(b["elevation_m"]),
        ordinal: Number(b["ordinal"] ?? 0),
      }))
      .filter((b) => isPlausibleKenyaLatLng({ lat: b.lat, lng: b.lng }))
      .sort((a, b) => a.ordinal - b.ordinal);
    const centroid = { lat: Number(r["centroid_lat"]), lng: Number(r["centroid_lng"]) };
    const rawRing = geometryToRingRaw(r["geometry"]);
    let ring = geometryToRing(r["geometry"]);
    if (ring.length < 3 && beacons.length >= 3) {
      ring = beacons.map((b) => ({ lat: b.lat, lng: b.lng }));
    }
    let coordinateIssue: CoordinateIssue = "none";
    if (!isPlausibleKenyaLatLng(centroid)) {
      coordinateIssue =
        Number.isFinite(centroid.lat) && Number.isFinite(centroid.lng)
          ? "out-of-bounds"
          : "invalid";
    } else if (ring.length < 3 && rawRing > 0) {
      coordinateIssue = "out-of-bounds";
    }
    return {
      coordinateIssue,
      id: String(r["id"]),
      titleDeedNo: String(r["title_deed_no"] ?? ""),
      parcelCode: String(r["parcel_code"] ?? ""),
      county: (r["county"] as string) ?? null,
      centroid,
      ring,
      areaSqm: Number(r["area_sqm"] ?? 0),
      elevationMasl: num(r["elevation_masl"]),
      zoningType: (r["zoning_type"] as string) ?? null,
      maxHeightM: num(r["max_building_height_m"]),
      roadSetbackM: num(r["road_setback_m"]),
      riparianSetbackM: num(r["riparian_setback_m"]),
      valuationKes: num(r["valuation_kes"]),
      status: (r["status"] as string) ?? null,
      surveyVerifiedOn: (r["survey_verified_on"] as string) ?? null,
      // deed_hash is deliberately not selected for the public Spatial UI.
      deedHash: null,
      verificationState: toVerificationState(r["verification_state"]),
      verificationConfidence: Number(r["verification_confidence"] ?? 0),
      verificationMethod: (r["verification_method"] as string) ?? null,
      verificationEvidenceRef: (r["verification_evidence_ref"] as string) ?? null,
      verificationUpdatedAt: (r["verification_updated_at"] as string) ?? null,
      legacyParcelCode: (r["legacy_parcel_code"] as string) ?? null,
      legacyTitleDeedNo: (r["legacy_title_deed_no"] as string) ?? null,
      beacons,
    } satisfies SpatialParcel;
  });
}

/** Buildable massing prototypes offered in the AR/VR studio. */
export async function fetchSpatialPrototypes(): Promise<SpatialPrototype[]> {
  const { data, error } = await supabase
    .from("architectural_prototypes")
    .select("*")
    .order("estimated_cost_kes", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    id: String(r["id"]),
    title: String(r["title"] ?? "Untitled massing"),
    category: (r["category"] as string) ?? null,
    footprintSqm: num(r["footprint_sqm"]),
    heightM: num(r["height_m"]),
    floors: r["floors"] == null ? null : Number(r["floors"]),
    estimatedCostKes: num(r["estimated_cost_kes"]),
    gltfUrl: (r["gltf_url"] as string) ?? null,
    usdzUrl: (r["usdz_url"] as string) ?? null,
  }));
}

export type SpatialListing = {
  id: string;
  title: string;
  county: string | null;
  lat: number;
  lng: number;
  price: number | null;
  currency: string;
  sizeValue: number | null;
  sizeUnit: string | null;
  kind: string;
  coverImage: string | null;
};

/** Published marketplace listings that carry coordinates, for parcel matching. */
export async function fetchSpatialListings(): Promise<SpatialListing[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, title, county, latitude, longitude, price, currency, size_value, size_unit, kind, cover_image",
    )
    .eq("status", "published")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(60);
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    id: String(r["id"]),
    title: String(r["title"] ?? "Listing"),
    county: (r["county"] as string) ?? null,
    lat: Number(r["latitude"]),
    lng: Number(r["longitude"]),
    price: num(r["price"]),
    currency: String(r["currency"] ?? "KES"),
    sizeValue: num(r["size_value"]),
    sizeUnit: (r["size_unit"] as string) ?? null,
    kind: String(r["kind"] ?? "land"),
    coverImage: (r["cover_image"] as string) ?? null,
  }));
}

/** Haversine distance in metres — delegates to the single tested helper. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return distanceMeters(a, b);
}

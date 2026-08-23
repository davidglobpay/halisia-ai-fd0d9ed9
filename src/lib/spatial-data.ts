import { supabase } from "@/integrations/supabase/client";
import {
  distanceMeters,
  geometryToRing,
  type SpatialParcel,
  type SpatialPrototype,
} from "./spatial";

type Row = Record<string, unknown>;

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** All publicly readable parcels with their survey beacons, ordered by county. */
export async function fetchSpatialParcels(): Promise<SpatialParcel[]> {
  const { data, error } = await supabase
    .from("parcels")
    .select("*, parcel_beacons(*)")
    .order("county", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => {
    const beacons = ((r["parcel_beacons"] as Row[] | null) ?? [])
      .map((b) => ({
        id: String(b["id"]),
        code: String(b["beacon_code"] ?? ""),
        lat: Number(b["lat"]),
        lng: Number(b["lng"]),
        elevationM: num(b["elevation_m"]),
        ordinal: Number(b["ordinal"] ?? 0),
      }))
      .sort((a, b) => a.ordinal - b.ordinal);
    const centroid = { lat: Number(r["centroid_lat"]), lng: Number(r["centroid_lng"]) };
    let ring = geometryToRing(r["geometry"]);
    if (ring.length < 3 && beacons.length >= 3) {
      ring = beacons.map((b) => ({ lat: b.lat, lng: b.lng }));
    }
    return {
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
      deedHash: (r["deed_hash"] as string) ?? null,
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

/** Haversine distance in metres — used to bind listings to nearby parcels. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { RentalListing } from "@/lib/rentals";

export type RenterPreferences = Database["public"]["Tables"]["renter_preferences"]["Row"];
export type RenterPreferencesInsert =
  Database["public"]["Tables"]["renter_preferences"]["Insert"];

export const COMMUTE_OPTIONS = [
  { value: "walk", label: "Walkable to work/school" },
  { value: "matatu", label: "Close to matatu / bus routes" },
  { value: "drive", label: "I drive — parking matters" },
  { value: "flexible", label: "Flexible / work from home" },
];

export const RENTER_AMENITIES = [
  "Water supply",
  "Backup power",
  "Internet / fibre",
  "Gym",
  "Playground",
  "Shops nearby",
  "Hospital nearby",
  "Pet friendly",
];

/** Average door-to-door speeds observed on Kenyan urban corridors (km/h). */
const MODE_SPEED_KMH: Record<string, number> = {
  walk: 4.5,
  matatu: 16,
  drive: 24,
  flexible: 20,
};

export const COMMUTE_BANDS = [
  { key: "under15", label: "Under 15 min", max: 15, score: 1 },
  { key: "15to30", label: "15–30 min", max: 30, score: 0.85 },
  { key: "30to45", label: "30–45 min", max: 45, score: 0.6 },
  { key: "45to60", label: "45–60 min", max: 60, score: 0.35 },
  { key: "over60", label: "Over 60 min", max: Infinity, score: 0.12 },
] as const;

export type CommuteBand = (typeof COMMUTE_BANDS)[number];

export function bandFor(minutes: number): CommuteBand {
  return COMMUTE_BANDS.find((b) => minutes <= b.max) ?? COMMUTE_BANDS[COMMUTE_BANDS.length - 1]!;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type CommuteEstimate = {
  km: number;
  minutes: number;
  band: CommuteBand;
  mode: string;
  method: string;
};

/**
 * Straight-line distance inflated by a 1.35 road-network factor, then divided
 * by an average door-to-door speed for the chosen travel mode. Indicative only.
 */
export function estimateCommute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  mode: string,
): CommuteEstimate {
  const straight = haversineKm(origin.lat, origin.lng, dest.lat, dest.lng);
  const km = straight * 1.35;
  const speed = MODE_SPEED_KMH[mode] ?? MODE_SPEED_KMH["flexible"]!;
  const minutes = Math.max(2, Math.round((km / speed) * 60));
  return {
    km: Math.round(km * 10) / 10,
    minutes,
    band: bandFor(minutes),
    mode,
    method: `${straight.toFixed(1)} km straight line × 1.35 road factor ÷ ${speed} km/h typical ${mode} speed`,
  };
}

export async function getMyRenterPreferences(): Promise<RenterPreferences | null> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data, error } = await supabase
    .from("renter_preferences")
    .select("*")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveRenterPreferences(
  patch: Omit<RenterPreferencesInsert, "user_id">,
): Promise<RenterPreferences> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) throw new Error("Sign in to save your match preferences");
  const { data, error } = await supabase
    .from("renter_preferences")
    .upsert({ ...patch, user_id: userRes.user.id }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type RenterMatch = {
  listing: RentalListing;
  score: number;
  reasons: string[];
  gaps: string[];
  commute?: CommuteEstimate | null;
};

function pctFit(value: number, target: number) {
  if (target <= 0) return 0;
  const diff = Math.abs(value - target) / target;
  return Math.max(0, 1 - diff);
}

/**
 * Consent-based renter match. When personalization is off (or no preferences
 * exist) we return the newest vacancies with a neutral explanation instead of
 * anything profile-derived.
 */
export function matchRentals(
  listings: RentalListing[],
  prefs: RenterPreferences | null,
): RenterMatch[] {
  if (!prefs || !prefs.personalization_enabled) {
    return listings.map((listing) => ({
      listing,
      score: 0,
      reasons: ["Personalization is off — showing the newest vacancies, not a personal profile."],
      gaps: [],
    }));
  }

  const scored = listings.map((listing) => {
    const { property, rental } = listing;
    const reasons: string[] = [];
    const gaps: string[] = [];
    let score = 0;
    let weight = 0;
    let commute: CommuteEstimate | null = null;

    // Budget
    const rent = rental?.monthly_rent != null ? Number(rental.monthly_rent) : Number(property.price ?? 0);
    if (prefs.budget_max != null && rent > 0) {
      weight += 30;
      const max = Number(prefs.budget_max);
      const min = prefs.budget_min != null ? Number(prefs.budget_min) : 0;
      if (rent <= max && rent >= min) {
        score += 30;
        reasons.push(`Rent fits your budget (${new Intl.NumberFormat("en-KE").format(rent)}).`);
      } else if (rent <= max * 1.15) {
        score += 18;
        gaps.push("Slightly above your budget ceiling.");
      } else {
        gaps.push("Above your stated budget.");
      }
    }

    // Location
    if (prefs.counties.length > 0) {
      weight += 20;
      if (property.county && prefs.counties.includes(property.county)) {
        score += 20;
        reasons.push(`In ${property.county}, one of your preferred counties.`);
      } else {
        gaps.push("Outside your preferred counties.");
      }
    }
    if (prefs.towns.length > 0) {
      weight += 10;
      const hay = `${property.address ?? ""} ${property.title}`.toLowerCase();
      const hit = prefs.towns.find((t) => t.trim() && hay.includes(t.trim().toLowerCase()));
      if (hit) {
        score += 10;
        reasons.push(`Matches your preferred area "${hit}".`);
      }
    }

    // Bedrooms
    if (prefs.bedrooms_min != null) {
      weight += 15;
      const beds = rental?.bedrooms ?? property.bedrooms ?? null;
      if (beds != null && beds >= prefs.bedrooms_min) {
        score += 15;
        reasons.push(`${beds} bedroom${beds === 1 ? "" : "s"} meets your minimum.`);
      } else if (beds != null) {
        score += Math.round(15 * pctFit(beds, prefs.bedrooms_min));
        gaps.push("Fewer bedrooms than you asked for.");
      } else {
        gaps.push("Bedroom count not stated by the landlord.");
      }
    }

    // Commute — origin-aware band scoring, with a facilities fallback.
    const originLat = prefs.commute_origin_lat != null ? Number(prefs.commute_origin_lat) : null;
    const originLng = prefs.commute_origin_lng != null ? Number(prefs.commute_origin_lng) : null;
    const mode = prefs.commute_preference || "flexible";
    if (originLat != null && originLng != null && property.latitude != null && property.longitude != null) {
      weight += 25;
      commute = estimateCommute(
        { lat: originLat, lng: originLng },
        { lat: Number(property.latitude), lng: Number(property.longitude) },
        mode,
      );
      const cap = prefs.max_commute_minutes != null ? Number(prefs.max_commute_minutes) : null;
      const bandScore = commute.band.score;
      const capPenalty = cap != null && commute.minutes > cap ? 0.5 : 1;
      score += Math.round(25 * bandScore * capPenalty);
      const where = prefs.commute_origin_label || "your commute origin";
      reasons.push(
        `Commute band ${commute.band.label} (~${commute.minutes} min, ${commute.km} km by ${mode}) from ${where} — band weight ${Math.round(bandScore * 100)}% of the 25-point commute score${
          capPenalty < 1 ? `, halved because it exceeds your ${cap}-minute limit` : ""
        }. Estimate method: ${commute.method}.`,
      );
      if (cap != null && commute.minutes > cap)
        gaps.push(`Estimated commute (${commute.minutes} min) is longer than your ${cap}-minute limit.`);
    } else if (prefs.commute_preference) {
      weight += 10;
      const transport = (rental?.public_transport ?? "").toLowerCase();
      const parking = rental?.parking_spaces ?? 0;
      if (mode === "drive" && parking > 0) {
        score += 10;
        reasons.push(`${parking} parking space${parking === 1 ? "" : "s"} for your car (no commute origin set, so distance was not scored).`);
      } else if ((mode === "matatu" || mode === "walk") && transport.length > 0) {
        score += 10;
        reasons.push("Landlord documented public transport access nearby (set a commute origin for timed bands).");
      } else if (mode === "flexible") {
        score += 6;
      } else {
        gaps.push("Commute details for your preference are missing — add a commute origin for banded scoring.");
      }
      if (originLat == null || originLng == null)
        gaps.push("No commute origin saved, so commute time could not be estimated.");
      else gaps.push("This listing has no map pin, so commute time could not be estimated.");
    }

    // Schools
    if (prefs.schools_priority > 0) {
      weight += prefs.schools_priority * 3;
      const hasSchools = property.amenities.some((a) => /school|academy|kindergarten/i.test(a));
      if (hasSchools) {
        score += prefs.schools_priority * 3;
        reasons.push("Schools listed among nearby amenities.");
      } else {
        gaps.push("No school amenity confirmed on this listing.");
      }
    }

    // Security
    if (prefs.security_priority > 0) {
      weight += prefs.security_priority * 3;
      const sec = rental?.security_features ?? [];
      if (sec.length > 0) {
        score += Math.min(prefs.security_priority * 3, sec.length * prefs.security_priority);
        reasons.push(`Security: ${sec.slice(0, 3).join(", ")}.`);
      } else {
        gaps.push("Security features not documented.");
      }
    }

    // Accessibility
    if (prefs.accessibility_needed) {
      weight += 15;
      const acc = rental?.accessibility_features ?? [];
      if (acc.length > 0) {
        score += 15;
        reasons.push(`Accessibility: ${acc.slice(0, 3).join(", ")}.`);
      } else {
        gaps.push("No accessibility features listed — confirm with the landlord.");
      }
    }

    // Amenities
    if (prefs.amenities.length > 0) {
      weight += 15;
      const pool = [
        ...property.amenities,
        ...(rental?.utilities_included ?? []),
        ...(rental?.security_features ?? []),
      ]
        .join(" ")
        .toLowerCase();
      const hits = prefs.amenities.filter((a) => pool.includes(a.toLowerCase().split(" ")[0]!));
      if (hits.length) {
        score += Math.round((15 * hits.length) / prefs.amenities.length);
        reasons.push(`Has ${hits.slice(0, 3).join(", ")}.`);
      } else {
        gaps.push("None of your must-have amenities are confirmed.");
      }
    }

    const pct = weight > 0 ? Math.round((score / weight) * 100) : 0;
    if (reasons.length === 0) reasons.push("Matches your rental search broadly.");
    return { listing, score: pct, reasons, gaps, commute };
  });

  return scored.sort((a, b) => b.score - a.score);
}
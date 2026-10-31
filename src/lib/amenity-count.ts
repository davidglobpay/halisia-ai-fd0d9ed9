/**
 * How many places each Google Places "nearby" lookup returns at most, per
 * amenity type. A lookup that hits this cap only shows that there are at
 * least this many, so it is displayed as "6+" rather than as a count.
 */
export const PLACES_PER_CATEGORY = 6;

/** "3" below the cap, "6+" at it. Negative or non-finite input reads as 0. */
export function amenityCount(n: number, cap: number = PLACES_PER_CATEGORY): string {
  const v = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return v >= cap ? `${cap}+` : String(v);
}

/** Plain sentence explaining the cap, shown wherever capped counts appear. */
export const AMENITY_CAP_NOTE = `Each type is looked up at most ${PLACES_PER_CATEGORY} times, so "${PLACES_PER_CATEGORY}+" means at least ${PLACES_PER_CATEGORY}, not exactly ${PLACES_PER_CATEGORY}.`;

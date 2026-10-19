/** Display formatting only: mixed-case names and short acronyms stay unchanged. */
export function displayPlaceName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean !== clean.toUpperCase()) return clean;
  return clean.replace(/[A-Z]+/g, (word) =>
    word.length <= 3 ? word : word[0] + word.slice(1).toLowerCase(),
  );
}

/** Suppress points within the rounding radius of the query centroid (0.00 km).
 * This does not assert a facility is absent, only that its location is unverified. */
export function isQueryCentroid(
  point: { lat: number; lng: number },
  origin?: { lat: number; lng: number },
): boolean {
  if (!origin) return false;
  const rad = Math.PI / 180;
  const dlat = (point.lat - origin.lat) * rad;
  const dlng = (point.lng - origin.lng) * rad;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(point.lat * rad) * Math.cos(origin.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(a))) < 5;
}

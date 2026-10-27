export type GeocodeResult = {
  formatted_address: string;
  address_components?: Array<{ long_name: string; types: string[] }>;
};

export type AdminHierarchy = {
  locality: string | null;
  subCounty: string | null;
  ward: string | null;
};

/**
 * Derive the admin hierarchy from Google reverse-geocode results.
 *
 * Previously each level was taken from whichever result first carried it, so
 * the sub-county could come from a coarser, neighbouring result than the one
 * that produced the page title (e.g. title "Kajiado East" vs location line
 * "Kajiado Central" for -1.560328, 36.938554). Sub-county now comes from a
 * single source: the most specific result that names one. If results
 * disagree, no sub-county is shown rather than a possibly wrong one.
 */
export function adminFromGeocodeResults(results: GeocodeResult[]): AdminHierarchy {
  const pick = (type: string) => {
    for (const r of results) {
      const c = r.address_components?.find((x) => x.types.includes(type));
      if (c) return c.long_name;
    }
    return null;
  };
  const subCounties = new Set(
    results.flatMap((r) =>
      (r.address_components ?? [])
        .filter((x) => x.types.includes("administrative_area_level_2"))
        .map((x) => x.long_name),
    ),
  );
  return {
    locality: pick("locality") ?? pick("sublocality"),
    subCounty: subCounties.size === 1 ? [...subCounties][0] : null,
    ward: pick("administrative_area_level_3") ?? pick("sublocality_level_1"),
  };
}

export type ArchitecturalTypology =
  | "bungalow"
  | "maisonette-duplex"
  | "apartment"
  | "townhouse"
  | "commercial"
  | "hospitality";

export type CatalogueStatus = "planned" | "candidate" | "admitted";

export type ArchitecturalCatalogueEntry = {
  id: string;
  name: string;
  typology: ArchitecturalTypology;
  variant: string;
  status: CatalogueStatus;
  assetUrl: string | null;
  license: string | null;
};

const variants: Record<ArchitecturalTypology, readonly string[]> = {
  bungalow: ["2-bed compact", "3-bed family", "4-bed premium", "courtyard", "accessible"],
  "maisonette-duplex": ["compact duplex", "4-bed G+1", "4-bed G+2", "twin duplex", "rooftop terrace"],
  apartment: ["studio block", "1-bed block", "2-bed block", "mixed-unit block", "serviced apartments"],
  townhouse: ["4-unit cluster", "6-unit cluster", "8-unit cluster", "courtyard cluster", "gated cluster"],
  commercial: ["retail kiosks", "neighbourhood shops", "office block", "mixed-use block", "supermarket"],
  hospitality: ["cabin", "Airbnb cottage", "lodge", "boutique hotel", "resort villa"],
};

export const ARCHITECTURAL_CATALOGUE: readonly ArchitecturalCatalogueEntry[] = Object.freeze(
  (Object.entries(variants) as Array<[ArchitecturalTypology, readonly string[]]>).flatMap(
    ([typology, names]) =>
      names.map((variant, index) =>
        Object.freeze({
          id: `${typology}-${index + 1}`,
          name: variant.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()),
          typology,
          variant,
          status: "planned" as const,
          assetUrl: null,
          license: null,
        }),
      ),
  ),
);

export type AssetAdmission = {
  bytes: number;
  format: string;
  license: string | null;
  triangleCount: number;
  materialCount: number;
  hasAuthoredDimensions: boolean;
};

export type AssetAdmissionResult = {
  admitted: boolean;
  errors: string[];
  warnings: string[];
  performance: "light" | "medium" | "heavy";
};

export function assessArchitecturalAsset(input: AssetAdmission): AssetAdmissionResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mb = input.bytes / 1_000_000;

  if (input.format.toLowerCase() !== "glb") errors.push("Web catalogue assets must use binary glTF (.glb).");
  if (!input.license?.trim()) errors.push("A traceable reuse licence is required.");
  if (!input.hasAuthoredDimensions) errors.push("Authored real-world dimensions are required.");
  if (!Number.isFinite(input.bytes) || input.bytes <= 0) errors.push("Asset byte size is invalid.");
  if (mb > 25) errors.push("Asset exceeds the 25 MB admission ceiling.");
  else if (mb > 15) warnings.push("Asset exceeds the preferred 15 MB web target.");
  if (input.triangleCount > 500_000) warnings.push("Triangle count exceeds the preferred 500,000 limit.");
  if (input.materialCount > 10) warnings.push("More than 10 materials may reduce mobile AR compatibility.");

  return {
    admitted: errors.length === 0,
    errors,
    warnings,
    performance: mb < 6 ? "light" : mb <= 15 ? "medium" : "heavy",
  };
}

export function catalogueCoverage() {
  return (Object.keys(variants) as ArchitecturalTypology[]).map((typology) => ({
    typology,
    total: ARCHITECTURAL_CATALOGUE.filter((entry) => entry.typology === typology).length,
    admitted: ARCHITECTURAL_CATALOGUE.filter(
      (entry) => entry.typology === typology && entry.status === "admitted",
    ).length,
  }));
}

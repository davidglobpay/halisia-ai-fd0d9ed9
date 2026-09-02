/**
 * Model Lab static registry — deliberately NOT database-driven.
 *
 * These entries exist only inside the isolated Architectural Model Lab. They
 * are never inserted into `architectural_prototypes`, so they can never appear
 * in the production Spatial prototype picker.
 *
 * No USDZ asset has been provided for any entry, so Apple AR Quick Look is
 * structurally unavailable — never fabricate a `.usdz` URL here.
 */

export type PerformanceClass = "LIGHT" | "MEDIUM" | "HEAVY" | "VERY_HEAVY";
export type ModelRole = "building-candidate" | "environment-control";
export type ModelCategory = "residential" | "mixed-use" | "commercial" | "environment";

export type ModelLabEntry = {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly glbUrl: string;
  readonly usdzUrl: null;
  readonly role: ModelRole;
  readonly category: ModelCategory;
  readonly typology: string;
  readonly environmentModel: boolean;
  readonly buildingCandidate: boolean;
  readonly supportsSceneViewer: boolean;
  readonly supportsQuickLook: false;
  /** Approximate on-disk size in megabytes (metadata only, not measured). */
  readonly approximateFileSize: number;
  readonly performanceClass: PerformanceClass;
  readonly description: string;
  readonly tags: readonly string[];
};

export const MODEL_LAB_ASSET_BASE = "/_model-lab";

/** LIGHT <10MB · MEDIUM 10–25MB · HEAVY 25–50MB · VERY_HEAVY >50MB */
export function classifyPerformance(sizeMb: number): PerformanceClass {
  if (!Number.isFinite(sizeMb) || sizeMb < 0) return "VERY_HEAVY";
  if (sizeMb < 10) return "LIGHT";
  if (sizeMb <= 25) return "MEDIUM";
  if (sizeMb <= 50) return "HEAVY";
  return "VERY_HEAVY";
}

function entry(
  init: Omit<
    ModelLabEntry,
    "glbUrl" | "usdzUrl" | "supportsQuickLook" | "supportsSceneViewer" | "performanceClass"
  >,
): ModelLabEntry {
  return Object.freeze({
    ...init,
    glbUrl: `${MODEL_LAB_ASSET_BASE}/${init.file}`,
    usdzUrl: null,
    supportsQuickLook: false as const,
    // Scene Viewer is only ever offered for building candidates.
    supportsSceneViewer: init.buildingCandidate,
    performanceClass: classifyPerformance(init.approximateFileSize),
  });
}

export const MODEL_LAB_REGISTRY: readonly ModelLabEntry[] = Object.freeze([
  entry({
    id: "apartment-3",
    name: "Apartment 3",
    file: "Apartment_3.glb",
    role: "building-candidate",
    category: "residential",
    typology: "Mid-rise apartment block",
    environmentModel: false,
    buildingCandidate: true,
    approximateFileSize: 21,
    description: "Mid-rise residential block used as a WebGL/AR compatibility candidate.",
    tags: ["residential", "apartment", "compatibility"],
  }),
  entry({
    id: "apartment-1-2",
    name: "Apartment 1_2",
    file: "Apartment_1_2.glb",
    role: "building-candidate",
    category: "residential",
    typology: "Paired apartment massing",
    environmentModel: false,
    buildingCandidate: true,
    approximateFileSize: 17,
    description: "Paired apartment massing with authored PBR materials.",
    tags: ["residential", "apartment", "pbr"],
  }),
  entry({
    id: "market-day",
    name: "Market Day",
    file: "Market_Day.glb",
    role: "building-candidate",
    category: "commercial",
    typology: "Open market hall",
    environmentModel: false,
    buildingCandidate: true,
    approximateFileSize: 26,
    description: "Open market hall with dense props — a heavier draw-call stress case.",
    tags: ["commercial", "market", "stress-test"],
  }),
  entry({
    id: "apartment-6-rooftop-bar",
    name: "Apartment 6 — Rooftop Bar",
    file: "Apartment_6_Rooftop_Bar.glb",
    role: "building-candidate",
    category: "mixed-use",
    typology: "Mixed-use block with rooftop terrace",
    environmentModel: false,
    buildingCandidate: true,
    approximateFileSize: 29,
    description: "Mixed-use block with transparent and emissive rooftop elements.",
    tags: ["mixed-use", "emissive", "transparency"],
  }),
  entry({
    id: "sky-day",
    name: "Sky / day environment",
    file: "SKY_Apartment_2_sky_day_ar.glb",
    role: "environment-control",
    category: "environment",
    typology: "Daylight sky shell (GLB geometry, not an HDR map)",
    environmentModel: true,
    buildingCandidate: false,
    approximateFileSize: 8,
    description:
      "Daylight sky shell supplied as GLB scene geometry. Not an HDR environment map.",
    tags: ["environment", "sky", "day"],
  }),
  entry({
    id: "sky-night",
    name: "Sky / night environment",
    file: "SKY_Apartment_2_sky_night_ar.glb",
    role: "environment-control",
    category: "environment",
    typology: "Night sky shell (GLB geometry, not an HDR map)",
    environmentModel: true,
    buildingCandidate: false,
    approximateFileSize: 8,
    description:
      "Night sky shell supplied as GLB scene geometry. Not an HDR environment map.",
    tags: ["environment", "sky", "night"],
  }),
]);

/** The ONLY list the model picker may iterate. */
export const BUILDING_CANDIDATES: readonly ModelLabEntry[] = Object.freeze(
  MODEL_LAB_REGISTRY.filter((m) => m.buildingCandidate && !m.environmentModel),
);

export const ENVIRONMENT_CONTROLS: readonly ModelLabEntry[] = Object.freeze(
  MODEL_LAB_REGISTRY.filter((m) => m.environmentModel && !m.buildingCandidate),
);

/** Environment shells can never be selected as a building. */
export function selectBuildingById(id: string): ModelLabEntry | null {
  return BUILDING_CANDIDATES.find((m) => m.id === id) ?? null;
}

/**
 * SKY ENVIRONMENT USE: UNSUITABLE — the SKY_*.glb files are GLB scene
 * geometry, not `.hdr`/`.exr` equirectangular maps, so they cannot be bound to
 * `scene.environment`. Day/Night/Neutral therefore use safe generated lighting.
 */
export const SKY_ENVIRONMENT_USE = "UNSUITABLE" as const;

/** Konza invariants — the Model Lab performs no parcel matching whatsoever. */
export const MODEL_LAB_PARCEL_CONTEXT = Object.freeze({
  matchedParcelRecord: null,
  geometry: null,
  boundaryEvidence: "NONE",
  modelFit: "UNKNOWN",
} as const);

export const MODEL_LAB_DISCLAIMER =
  "Architectural visualization only — not cadastral placement or survey evidence.";

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
export type ModelCategory = "residential" | "mixed-use" | "commercial" | "environment";

/**
 * Decimal MB is mandatory. Binary MiB (1_048_576) misclassifies
 * Apartment_1_2.glb (25_503_336 B) as MEDIUM and contradicts the spec, which
 * requires it to be HEAVY.
 */
export const MB = 1_000_000;

/**
 * Assets are served from a pinned public repository path. ASSET IMMUTABILITY =
 * UNAVAILABLE: the pinned commit revisions return HTTP 404, so `main` is used
 * and content can change upstream without notice. Byte sizes below were
 * verified against `main` by HEAD/Range probe.
 */
export const MODEL_LAB_ASSET_BASE =
  "https://raw.githubusercontent.com/SpectraStudios/SourceCityToolkit_glb/main";

export const ASSET_IMMUTABILITY = "UNAVAILABLE" as const;

/** Scene Viewer asset compatibility is never inferred from a GLTFLoader parse. */
export type SceneViewerAssetCompatibility = "UNVERIFIED" | "NOT_APPLICABLE";

type BaseEntry = {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly glbUrl: string;
  readonly usdzUrl: null;
  readonly supportsQuickLook: false;
  readonly category: ModelCategory;
  readonly typology: string;
  /** Exact decimal byte count as measured over HTTP. */
  readonly bytes: number;
  readonly sizeMb: number;
  readonly performanceClass: PerformanceClass;
  readonly description: string;
  readonly tags: readonly string[];
};

/** A model the user may select and place. */
export type BuildingModel = BaseEntry & {
  readonly kind: "building";
  /** Whether an Android Scene Viewer intent can be constructed at all. */
  readonly sceneViewerIntentSupported: true;
  /** Whether the asset actually works in Scene Viewer — never inferred. */
  readonly sceneViewerAssetCompatibility: "UNVERIFIED";
};

/** An environment shell. Structurally cannot be selected as a building. */
export type EnvironmentModel = BaseEntry & {
  readonly kind: "environment";
  readonly sceneViewerIntentSupported: false;
  readonly sceneViewerAssetCompatibility: "NOT_APPLICABLE";
};

export type ModelLabEntry = BuildingModel | EnvironmentModel;

/** LIGHT <10 MB · MEDIUM 10–25 MB · HEAVY >25–50 MB · VERY_HEAVY >50 MB */
export function classifyPerformance(sizeMb: number): PerformanceClass {
  if (!Number.isFinite(sizeMb) || sizeMb < 0) return "VERY_HEAVY";
  if (sizeMb < 10) return "LIGHT";
  if (sizeMb <= 25) return "MEDIUM";
  if (sizeMb <= 50) return "HEAVY";
  return "VERY_HEAVY";
}

export function classifyBytes(bytes: number): PerformanceClass {
  return classifyPerformance(bytes / MB);
}

type BuildingInit = Pick<
  BaseEntry,
  "id" | "name" | "file" | "category" | "typology" | "bytes" | "description" | "tags"
>;

function base(init: BuildingInit): BaseEntry {
  return {
    ...init,
    glbUrl: `${MODEL_LAB_ASSET_BASE}/${init.file}`,
    usdzUrl: null,
    supportsQuickLook: false as const,
    sizeMb: init.bytes / MB,
    performanceClass: classifyBytes(init.bytes),
  };
}

function building(init: BuildingInit): BuildingModel {
  return Object.freeze({
    ...base(init),
    kind: "building" as const,
    sceneViewerIntentSupported: true as const,
    sceneViewerAssetCompatibility: "UNVERIFIED" as const,
  });
}

function environment(init: BuildingInit): EnvironmentModel {
  return Object.freeze({
    ...base(init),
    kind: "environment" as const,
    sceneViewerIntentSupported: false as const,
    sceneViewerAssetCompatibility: "NOT_APPLICABLE" as const,
  });
}

/** The ONLY list the model picker may iterate. */
export const BUILDING_MODELS: readonly BuildingModel[] = Object.freeze([
  building({
    id: "apartment-3",
    name: "Apartment 3",
    file: "Apartment_3.glb",
    category: "residential",
    typology: "Mid-rise apartment block",
    bytes: 23_739_464,
    description: "Mid-rise residential block used as a WebGL/AR compatibility candidate.",
    tags: ["residential", "apartment", "compatibility"],
  }),
  building({
    id: "apartment-1-2",
    name: "Apartment 1_2",
    file: "Apartment_1_2.glb",
    category: "residential",
    typology: "Paired apartment massing",
    bytes: 25_503_336,
    description: "Paired apartment massing with authored PBR materials.",
    tags: ["residential", "apartment", "pbr"],
  }),
  building({
    id: "market-day",
    name: "Market Day",
    file: "Market_Day.glb",
    category: "commercial",
    typology: "Open market hall",
    bytes: 17_786_532,
    description: "Open market hall with dense props — a heavier draw-call stress case.",
    tags: ["commercial", "market", "stress-test"],
  }),
  building({
    id: "apartment-6-rooftop-bar",
    name: "Apartment 6 — Rooftop Bar",
    file: "Apartment_6_Rooftop_Bar.glb",
    category: "mixed-use",
    typology: "Mixed-use block with rooftop terrace",
    bytes: 29_030_476,
    description: "Mixed-use block with transparent and emissive rooftop elements.",
    tags: ["mixed-use", "emissive", "transparency"],
  }),
]);

export const ENVIRONMENT_MODELS: readonly EnvironmentModel[] = Object.freeze([
  environment({
    id: "sky-day",
    name: "Sky / day environment",
    file: "SKY_Apartment_2_sky_day_ar.glb",
    category: "environment",
    typology: "Daylight sky shell (GLB geometry, not an HDR map)",
    bytes: 923_680,
    description: "Daylight sky shell supplied as GLB scene geometry. Not an HDR environment map.",
    tags: ["environment", "sky", "day"],
  }),
  environment({
    id: "sky-night",
    name: "Sky / night environment",
    file: "SKY_Apartment_2_sky_night_ar.glb",
    category: "environment",
    typology: "Night sky shell (GLB geometry, not an HDR map)",
    bytes: 1_437_464,
    description: "Night sky shell supplied as GLB scene geometry. Not an HDR environment map.",
    tags: ["environment", "sky", "night"],
  }),
]);

export const MODEL_LAB_REGISTRY: readonly ModelLabEntry[] = Object.freeze([
  ...BUILDING_MODELS,
  ...ENVIRONMENT_MODELS,
]);

/** Environment shells can never be selected as a building — separate type. */
export function selectBuildingById(id: string): BuildingModel | null {
  return BUILDING_MODELS.find((m) => m.id === id) ?? null;
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

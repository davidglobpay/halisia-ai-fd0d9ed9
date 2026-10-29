/**
 * Pure project helpers (no database access), shared by the pages and tests.
 */
export const PROJECT_STAGES = [
  { value: "land", label: "Finding land" },
  { value: "feasibility", label: "Feasibility" },
  { value: "design", label: "Design" },
  { value: "construction", label: "Construction" },
  { value: "financing", label: "Financing" },
  { value: "transaction", label: "Buying or selling" },
  { value: "occupied", label: "Occupied" },
  { value: "archived", label: "Archived" },
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number]["value"];

export function stageLabel(stage: string): string {
  return PROJECT_STAGES.find((s) => s.value === stage)?.label ?? stage;
}

/**
 * The key HALISIA uses for a place: a ~11 m grid cell. It must match
 * locationKey() in intel-snapshot.server.ts, which writes the evidence.
 */
export function areaKey(lat: number, lng: number): string {
  return `geo:${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function validProjectName(name: string): string | null {
  const t = name.trim();
  if (!t) return "Give the project a name.";
  if (t.length > 160) return "Keep the name under 160 characters.";
  return null;
}

export function validCoordinate(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = typeof lat === "string" ? Number(lat) : lat;
  const b = typeof lng === "string" ? Number(lng) : lng;
  if (typeof a !== "number" || typeof b !== "number") return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  return { lat: a, lng: b };
}

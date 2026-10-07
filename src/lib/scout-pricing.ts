/** Client preview of the scout quote. The database (scout_compute_quote) is authoritative. */
export type ChecklistChoice = "check" | "unsure" | "not";
export type AccessLevel = "easy" | "difficult" | "remote";

export const SCOUT_TASKS = [
  { code: "boundaries", label: "Boundaries & access observations", kes: 500 },
  { code: "terrain", label: "Terrain, drainage & flood indicators", kes: 500 },
  { code: "roads", label: "Roads & transport", kes: 300 },
  { code: "utilities", label: "Utilities & mobile signal", kes: 400 },
  { code: "economic", label: "Asking-price / rent interviews", kes: 700 },
  { code: "social", label: "Social amenities & local context", kes: 500 },
  {
    code: "security",
    label: "Security observations & consented interviews",
    kes: 500,
  },
  { code: "custom", label: "Custom concern", kes: 500 },
] as const;

export const SCOUT_BASE_KES = 1000;
export const SCOUT_FEE_PCT = 15;
export const ACCESS_KES: Record<AccessLevel, number> = {
  easy: 0,
  difficult: 500,
  remote: 1500,
};

export function previewQuote(
  checklist: Record<string, ChecklistChoice>,
  access: AccessLevel,
  travelKes: number,
  catalog?: { code: string; amount_kes: number; active: boolean }[],
) {
  const price = (code: string, fallback: number) =>
    catalog?.find((c) => c.code === code)?.amount_kes ?? fallback;
  const baseKes = price("base", SCOUT_BASE_KES);
  const feePct = price("platform_fee_pct", SCOUT_FEE_PCT);
  const tasks = SCOUT_TASKS.filter(
    (t) =>
      ["check", "unsure"].includes(checklist[t.code] ?? "not") &&
      (!catalog || catalog.some((c) => c.code === t.code && c.active)),
  ).map((t) => ({ ...t, kes: price(t.code, t.kes) }));
  const tasksKes = tasks.reduce((s, t) => s + t.kes, 0);
  const work = baseKes + tasksKes;
  const fee = Math.round((work * feePct) / 100);
  const travel = Math.max(0, Number.isFinite(travelKes) ? travelKes : 0);
  const accessKes = price("access_" + access, ACCESS_KES[access]);
  return {
    baseKes,
    feePct,
    tasks,
    tasksKes,
    scoutWorkKes: work,
    platformFeeKes: fee,
    travelKes: travel,
    accessKes,
    scoutEarningsKes: work + travel + accessKes,
    totalKes: work + fee + travel + accessKes,
  };
}

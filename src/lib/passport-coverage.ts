/**
 * Coverage & freshness grouping for the Land Passport.
 * "Sourced fact" means a measured reading or official statistic from a named
 * provider. It is deliberately NOT called "verified": no row here has been
 * checked by a surveyor, registry or lawyer.
 */
import {
  CHAPTERS,
  type ChapterId,
  type EvidenceClass,
  type EvidenceItem,
} from "./passport-evidence";

export type Bucket = "sourced" | "estimate" | "ai" | "unavailable";

export const BUCKET_META: Record<Bucket, { label: string; hint: string }> = {
  sourced: {
    label: "Sourced facts",
    hint: "Measured readings or official statistics from a named provider. Not a legal or survey verification.",
  },
  estimate: {
    label: "Estimates",
    hint: "Modelled values or information supplied by a user or seller.",
  },
  ai: { label: "AI interpretations", hint: "HALISIA reasoning over the rows. Not source data." },
  unavailable: { label: "Unavailable", hint: "No data, provider failed, or not connected." },
};

export function bucketOf(cls: EvidenceClass): Bucket {
  if (cls === "measured" || cls === "official") return "sourced";
  if (cls === "modelled" || cls === "user") return "estimate";
  if (cls === "ai") return "ai";
  return "unavailable";
}

/** How long each chapter's data is expected to stay current. */
export const FRESHNESS_POLICY: Record<ChapterId, string> = {
  identity: "Until the source document or position changes",
  admin: "Boundaries: until re-gazetted. Statistics: census cycle",
  physical: "Persistent until source dataset is revised",
  climate: "Long-term normals: years. Air quality/weather: hours",
  access: "Roads and places: about 30 days",
  build: "Persistent until source dataset is revised",
  market: "Recomputed on every visit",
  trust: "Only changes when evidence is reviewed",
};

export type CoverageRow = {
  id: ChapterId;
  title: string;
  counts: Record<Bucket, number>;
  total: number;
  latest: string | null;
  policy: string;
};

export function buildCoverage(items: EvidenceItem[]): {
  rows: CoverageRow[];
  totals: Record<Bucket, number>;
} {
  const totals: Record<Bucket, number> = { sourced: 0, estimate: 0, ai: 0, unavailable: 0 };
  const rows = CHAPTERS.map((c) => {
    const counts: Record<Bucket, number> = { sourced: 0, estimate: 0, ai: 0, unavailable: 0 };
    let latest: string | null = null;
    const list = items.filter((i) => i.chapter === c.id);
    for (const it of list) {
      const b = bucketOf(it.cls);
      counts[b]++;
      totals[b]++;
      if (b !== "unavailable" && it.retrieved && (!latest || it.retrieved > latest))
        latest = it.retrieved;
    }
    return {
      id: c.id,
      title: c.title,
      counts,
      total: list.length,
      latest,
      policy: FRESHNESS_POLICY[c.id],
    };
  });
  return { rows, totals };
}

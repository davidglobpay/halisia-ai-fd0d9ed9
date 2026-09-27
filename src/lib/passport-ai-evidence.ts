import type { Confidence, EvidenceItem } from "./passport-evidence";

export type PassportAiExport = {
  text: string;
  generatedAt: string;
};

export type PassportAiEvidence = {
  cited: EvidenceItem[];
  unknownIds: string[];
  confidence: Confidence;
  limitation: string;
};

const CITE = /\[([a-z0-9_-]+)\]/gi;

export function citedEvidenceIds(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(CITE)) {
    const id = match[1]?.toLowerCase();
    if (id) ids.add(id);
  }
  return [...ids];
}

export function resolveAiEvidence(text: string, items: EvidenceItem[]): PassportAiEvidence {
  const ids = citedEvidenceIds(text);
  const byId = new Map(items.map((item) => [item.id.toLowerCase(), item]));
  const cited = ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const unknownIds = ids.filter((id) => !byId.has(id));
  const available = cited.filter((item) => item.value != null);
  const assessed = available.filter((item) => item.confidence !== "not_assessed");
  const rank: Record<Confidence, number> = { not_assessed: 0, low: 1, medium: 2, high: 3 };
  const weakest = assessed.reduce<Confidence>(
    (current, item) => (rank[item.confidence] < rank[current] ? item.confidence : current),
    "high",
  );
  const citationCoverage = ids.length ? cited.length / ids.length : 0;
  const confidence: Confidence =
    !ids.length || !available.length || citationCoverage < 1
      ? "not_assessed"
      : weakest === "high" && available.length >= 3
        ? "high"
        : weakest === "low"
          ? "low"
          : "medium";

  return {
    cited,
    unknownIds,
    confidence,
    limitation:
      confidence === "not_assessed"
        ? "Confidence is not assessed because the summary has missing, unavailable or unmatched citations."
        : `Confidence reflects the weakest cited evidence row and citation coverage; it is not an independent verification.`,
  };
}

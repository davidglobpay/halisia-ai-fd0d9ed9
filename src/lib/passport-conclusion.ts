/**
 * Build a short interpretation from evidence already shown in the report.
 * Empty input stays empty. Verdict-like terms and monetary amounts are blocked
 * so summaries cannot accidentally become ratings, suitability claims, or quotes.
 */
const UNSAFE_CONCLUSION = /\b(?:rating|grade|score|suitable|bearing\s+capacity|water[\s-]+table)\b|\b(?:KSh|KES|USD|EUR|GBP)\s*[\d,.]+|[$€£]\s*[\d,.]+/i;

export function buildEvidenceConclusion(
  lines: readonly (string | false | null | undefined)[],
): string {
  const body = lines
    .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    .map((line) => line.trim())
    .join(" ");

  if (!body || UNSAFE_CONCLUSION.test(body)) return "";
  return body;
}

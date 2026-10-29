/**
 * Build a short interpretation from evidence already shown in the report.
 * Empty input stays empty. Verdict-like terms and monetary amounts are blocked
 * so summaries cannot accidentally become ratings, suitability claims, or quotes.
 *
 * One exception: a sentence that only says a property was NOT measured,
 * assessed or derived is a limitation, not a verdict, and is kept. Without it
 * the soil disclaimer ("water table and bearing capacity are not measured")
 * would remove itself. Money amounts are never exempt, and negated verdicts
 * such as "not suitable" are still blocked.
 */
const UNSAFE_TERM = /\b(?:rating|grade|score|suitable|bearing\s+capacity|water[\s-]+table)\b/i;
const MONEY = /\b(?:KSh|KES|USD|EUR|GBP)\s*[\d,.]+|[$€£]\s*[\d,.]+/i;
const LIMITATION =
  /\b(?:not|never|cannot(?:\s+be)?|can't(?:\s+be)?)\s+(?:be\s+)?(?:measured|assessed|derived|established|determined|tested|known)\b/i;

function sentenceIsSafe(sentence: string): boolean {
  if (MONEY.test(sentence)) return false;
  if (!UNSAFE_TERM.test(sentence)) return true;
  return LIMITATION.test(sentence) && !/\bsuitab/i.test(sentence.replace(LIMITATION, ""));
}

export function buildEvidenceConclusion(
  lines: readonly (string | false | null | undefined)[],
): string {
  const body = lines
    .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    .map((line) => line.trim())
    .join(" ");

  if (!body) return "";
  const sentences = body.split(/(?<=[.!?])\s+/);
  return sentences.every(sentenceIsSafe) ? body : "";
}

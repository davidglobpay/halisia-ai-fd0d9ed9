/**
 * Indicative investment-readiness assessment.
 *
 * Seven evidence factors scored from what the platform can actually see. This
 * is NOT a credit decision — lending remains subject to each institution's own
 * credit, legal, valuation, technical and risk processes.
 */
import type { PropertyRow } from "@/lib/properties";

export const READINESS_DISCLAIMER =
  "Indicative readiness assessment. Lending decisions remain subject to each financial institution's independent credit, legal, valuation, technical, and risk processes.";

export type ReadinessFactor = {
  key: string;
  label: string;
  score: number; // 0-100
  weight: number;
  evidence: string;
  improve: string;
};

export type ReadinessResult = {
  total: number;
  band: "Early" | "Developing" | "Advancing" | "Investor-ready";
  factors: ReadinessFactor[];
  generatedAt: string;
};

type Extras = {
  hasConcept?: boolean;
  hasFinancingApplication?: boolean;
  financialInfoPct?: number; // 0-100
  professionalReview?: boolean;
};

function bandFor(total: number): ReadinessResult["band"] {
  if (total >= 80) return "Investor-ready";
  if (total >= 60) return "Advancing";
  if (total >= 40) return "Developing";
  return "Early";
}

export function assessReadiness(p: PropertyRow, extras: Extras = {}): ReadinessResult {
  const hasPin = p.latitude != null && p.longitude != null;
  const photos = p.media_urls?.length ?? 0;
  const priced = p.price != null;

  const factors: ReadinessFactor[] = [
    {
      key: "location",
      label: "Location evidence",
      weight: 18,
      score: (hasPin ? 60 : 0) + (p.county ? 20 : 0) + (p.address ? 20 : 0),
      evidence: hasPin
        ? `GPS pin set${p.county ? ` in ${p.county}` : ""}.`
        : "No GPS pin — location cannot be independently checked.",
      improve: hasPin ? "Add a boundary sketch or survey extract." : "Drop a map pin on the listing.",
    },
    {
      key: "market",
      label: "Market evidence",
      weight: 16,
      score: (priced ? 55 : 0) + (p.view_count > 20 ? 25 : p.view_count > 5 ? 12 : 0) + (p.ai_score ? 20 : 0),
      evidence: priced
        ? `Asking figure stated; ${p.view_count} marketplace views recorded.`
        : "No asking figure, so no market anchor exists.",
      improve: "State a price and keep the listing live long enough to gather comparable interest.",
    },
    {
      key: "concept",
      label: "Project concept",
      weight: 15,
      score: extras.hasConcept ? 85 : p.description && p.description.length > 200 ? 40 : 15,
      evidence: extras.hasConcept
        ? "An AI development concept study exists for this land."
        : "No development concept has been generated yet.",
      improve: "Run Explore Development Potential and pick a preferred option.",
    },
    {
      key: "documentation",
      label: "Ownership & documentation workflow",
      weight: 15,
      score: (p.review_state === "approved" ? 45 : p.review_state === "in_review" ? 25 : 5) + (photos >= 3 ? 25 : photos > 0 ? 10 : 0) + (p.status === "published" ? 20 : 0),
      evidence: `Listing review state: ${p.review_state}; ${photos} photo(s) on file.`,
      improve: "Upload title/search documents to your financing application and complete listing review.",
    },
    {
      key: "financial",
      label: "Financial information",
      weight: 14,
      score: extras.financialInfoPct ?? (extras.hasFinancingApplication ? 55 : 10),
      evidence: extras.hasFinancingApplication
        ? "A financing application with borrower and project figures exists."
        : "No financing application captured yet.",
      improve: "Start a financing application with income, requested amount and purpose.",
    },
    {
      key: "feasibility",
      label: "Development feasibility",
      weight: 12,
      score:
        (p.size_value != null ? 35 : 0) +
        ((p.utilities?.length ?? 0) > 0 ? 30 : 0) +
        ((p.amenities?.length ?? 0) > 0 ? 20 : 0) +
        (extras.hasConcept ? 15 : 0),
      evidence: `${p.size_value ?? "Unknown"} ${p.size_unit ?? ""} · ${(p.utilities ?? []).length} utility record(s).`,
      improve: "Confirm plot size, utilities on site and access before a lender's technical review.",
    },
    {
      key: "professional",
      label: "Professional review",
      weight: 10,
      score: extras.professionalReview ? 85 : 10,
      evidence: extras.professionalReview
        ? "At least one professional proposal has been received for this property."
        : "No professional (architect, QS, surveyor) has reviewed this yet.",
      improve: "Post a bid request to the pro network and shortlist a qualified reviewer.",
    },
  ].map((f) => ({ ...f, score: Math.max(0, Math.min(100, Math.round(f.score))) }));

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const total = Math.round(
    factors.reduce((s, f) => s + (f.score * f.weight) / 100, 0) * (100 / totalWeight),
  );

  return { total, band: bandFor(total), factors, generatedAt: new Date().toISOString() };
}

/**
 * Clarification layer.
 *
 * Before the AI writes the final title/description or ranks rentals, we ask the
 * user to confirm the details we are least sure about. Answers are folded back
 * into the prompt/scoring so the model never silently invents a fact.
 */
import type { WizardDraft } from "@/lib/listing-wizard";
import { isRental } from "@/lib/listing-wizard";
import type { RenterPreferences } from "@/lib/renter-match";

export type ClarifyQuestion = {
  key: string;
  question: string;
  why: string;
  options: string[];
  allowFreeText?: boolean;
};

export type ClarifyAnswers = Record<string, string>;

/** Questions about a listing draft that materially change the generated copy. */
export function listingClarifications(d: WizardDraft): ClarifyQuestion[] {
  const q: ClarifyQuestion[] = [];
  const has = (v: string) => v.trim().length > 0;

  if (!has(d.access_type))
    q.push({
      key: "access",
      question: "How do people reach the property today?",
      why: "Access type changes value, financing and construction cost — we will not guess it.",
      options: [
        "Tarmac road",
        "All-weather murram",
        "Seasonal murram",
        "Footpath only",
        "Not sure yet",
      ],
    });

  if (d.utilities.length === 0)
    q.push({
      key: "utilities",
      question: "Which utilities are already connected on site?",
      why: "Water and power availability is the most asked buyer question.",
      options: [
        "Power and water on site",
        "Power only",
        "Water only",
        "Neither yet",
        "Not sure yet",
      ],
    });

  if (!has(d.size_value))
    q.push({
      key: "size",
      question: "Is the size you will state measured or approximate?",
      why: "We label estimates as estimates instead of presenting them as survey data.",
      options: ["Surveyed / on title", "Approximate", "Not known yet"],
    });

  if (!has(d.latitude) || !has(d.longitude))
    q.push({
      key: "pin",
      question: "Should the listing show an exact pin or a general area?",
      why: "Some owners prefer an area only until an enquiry is qualified.",
      options: ["Exact pin is fine", "General area only", "I'll add the pin later"],
    });

  if (!has(d.price) && !has(d.monthly_rent))
    q.push({
      key: "price",
      question: "How firm is your asking figure?",
      why: "We phrase the copy differently for a firm price versus a negotiable guide.",
      options: ["Firm", "Negotiable", "Guide only", "Price on request"],
    });

  if (isRental(d) && !has(d.available_from))
    q.push({
      key: "available",
      question: "When can a tenant actually move in?",
      why: "Renters filter by move-in date before anything else.",
      options: ["Immediately", "Within 30 days", "Next quarter", "Not decided"],
    });

  q.push({
    key: "verification",
    question: "What has been verified so far?",
    why: "We only state what you confirm — HALISIA never asserts legal or title status.",
    options: ["Survey done", "Title search done", "Both done", "Nothing verified yet"],
    allowFreeText: true,
  });

  return q;
}

/** Questions that sharpen renter matching before results are ranked. */
export function renterClarifications(p: RenterPreferences | null): ClarifyQuestion[] {
  const q: ClarifyQuestion[] = [];
  if (!p) return q;
  if (p.commute_origin_lat == null || p.commute_origin_lng == null)
    q.push({
      key: "commute_origin",
      question: "Where do you commute to most days?",
      why: "Without an origin we cannot estimate commute bands, only facilities.",
      options: ["Use my current location", "I'll type an address", "I don't commute"],
    });
  if (p.max_commute_minutes == null)
    q.push({
      key: "commute_cap",
      question: "What is the longest one-way commute you would accept?",
      why: "We halve the commute score above your limit instead of hiding the listing.",
      options: ["30 minutes", "45 minutes", "60 minutes", "No limit"],
    });
  if (p.budget_max == null)
    q.push({
      key: "budget",
      question: "Is your budget ceiling firm?",
      why: "A firm ceiling filters harder; a soft one keeps near-misses visible.",
      options: ["Firm", "Can stretch 10%", "Flexible"],
    });
  if (p.counties.length === 0)
    q.push({
      key: "counties",
      question: "Which counties should we search?",
      why: "Location is the single biggest driver of your match score.",
      options: ["Nairobi", "Kiambu", "Machakos", "Anywhere in Kenya"],
      allowFreeText: true,
    });
  return q;
}

/** Renders answers as prompt-safe lines for the AI coach. */
export function answersToNotes(qs: ClarifyQuestion[], a: ClarifyAnswers): string[] {
  return qs
    .filter((q) => (a[q.key] ?? "").trim().length > 0)
    .map((q) => `${q.question} → ${a[q.key]}`);
}

export function unansweredCount(qs: ClarifyQuestion[], a: ClarifyAnswers): number {
  return qs.filter((q) => !(a[q.key] ?? "").trim()).length;
}

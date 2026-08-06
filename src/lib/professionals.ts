import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProCategory = Database["public"]["Enums"]["pro_category"];
export type ProVerification = Database["public"]["Enums"]["pro_verification"];
export type ProProfile = Database["public"]["Tables"]["professional_profiles"]["Row"];
export type ProReview = Database["public"]["Tables"]["professional_reviews"]["Row"];
export type ProRequest = Database["public"]["Tables"]["professional_requests"]["Row"];

/** Evidence a provider uploads to support their registration claim. */
export type VerificationEvidence = {
  label: string;
  url: string;
  kind: "registration_certificate" | "practising_licence" | "id_document" | "portfolio" | "other";
  addedAt: string;
};

/** A recurring weekly window the provider is available for consultations. */
export type AvailabilitySlot = {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  /** "09:00" */
  start: string;
  /** "12:30" */
  end: string;
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function parseEvidence(
  p: Pick<ProProfile, "verification_evidence">,
): VerificationEvidence[] {
  const raw = p.verification_evidence;
  return Array.isArray(raw) ? (raw as unknown as VerificationEvidence[]) : [];
}

export function parseAvailability(p: Pick<ProProfile, "availability_slots">): AvailabilitySlot[] {
  const raw = p.availability_slots;
  return Array.isArray(raw) ? (raw as unknown as AvailabilitySlot[]) : [];
}

/**
 * Registration details are private until Halisia verifies them, so the
 * directory never implies a regulator check that has not happened.
 */
export function publicRegistration(p: ProProfile): {
  body: string | null;
  number: string | null;
  hidden: boolean;
} {
  if (p.verification_status === "verified") {
    return { body: p.registration_body, number: p.registration_number, hidden: false };
  }
  return { body: p.registration_body, number: null, hidden: !!p.registration_number };
}

/** Fields a profile must carry before it can be published to the directory. */
export function profileReadiness(p: Partial<ProProfile>): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!p.display_name?.trim()) missing.push("Display name");
  if (!p.category) missing.push("Category");
  if (!p.county?.trim()) missing.push("Base county");
  if (!p.bio?.trim() || p.bio.trim().length < 60) missing.push("Short bio (60+ characters)");
  if (p.years_experience == null) missing.push("Years of experience");
  if (!p.contact_email?.trim() && !p.contact_phone?.trim())
    missing.push("A contact email or phone");
  return { ok: missing.length === 0, missing };
}

export const PRO_CATEGORIES: Array<{ value: ProCategory; label: string; blurb: string }> = [
  { value: "architect", label: "Architect", blurb: "Concept design, drawings and approvals." },
  { value: "engineer", label: "Engineer", blurb: "Structural, civil, electrical and mechanical." },
  { value: "surveyor", label: "Surveyor", blurb: "Boundaries, beacons and topographic surveys." },
  { value: "planner", label: "Planner", blurb: "Zoning, change of user and planning permission." },
  { value: "valuer", label: "Valuer", blurb: "Market and forced-sale valuation reports." },
  { value: "lawyer", label: "Lawyer", blurb: "Conveyancing, due diligence and contracts." },
  { value: "contractor", label: "Contractor", blurb: "Construction delivery and site works." },
  {
    value: "interior_designer",
    label: "Interior designer",
    blurb: "Fit-out and interior specification.",
  },
  {
    value: "landscape_designer",
    label: "Landscape designer",
    blurb: "External works and planting.",
  },
  {
    value: "quantity_surveyor",
    label: "Quantity surveyor",
    blurb: "Cost plans, BQs and valuations of works.",
  },
  {
    value: "environmental_consultant",
    label: "Environmental consultant",
    blurb: "EIA, NEMA and impact studies.",
  },
  {
    value: "property_manager",
    label: "Property manager",
    blurb: "Tenancy, rent collection and maintenance.",
  },
  {
    value: "real_estate_agent",
    label: "Real estate agent",
    blurb: "Marketing, viewings and negotiation.",
  },
  {
    value: "financial_adviser",
    label: "Financial adviser",
    blurb: "Structuring, tax and investment advice.",
  },
  { value: "bank", label: "Bank", blurb: "Mortgages and construction finance." },
  {
    value: "insurance_provider",
    label: "Insurance provider",
    blurb: "Contractor, title and property cover.",
  },
  {
    value: "utility_provider",
    label: "Utility-related service provider",
    blurb: "Power, water, borehole and connectivity.",
  },
];

export const PRO_CATEGORY_LABELS: Record<ProCategory, string> = PRO_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.value]: c.label }),
  {} as Record<ProCategory, string>,
);

export type ProFilters = { category?: ProCategory | "all"; county?: string; q?: string };

/** Public directory read — only published profiles are returned by RLS. */
export async function listProfessionals(filters: ProFilters = {}): Promise<ProProfile[]> {
  let q = supabase
    .from("professional_profiles")
    .select("*")
    .eq("published", true)
    .order("verification_status", { ascending: false })
    .order("years_experience", { ascending: false, nullsFirst: false });
  if (filters.category && filters.category !== "all") q = q.eq("category", filters.category);
  if (filters.county) q = q.eq("county", filters.county);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const term = filters.q?.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) =>
    [r.display_name, r.organisation, r.bio, r.town, r.county]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term)),
  );
}

export async function getProfessional(id: string): Promise<ProProfile | null> {
  const { data, error } = await supabase
    .from("professional_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMyProProfiles(): Promise<ProProfile[]> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return [];
  const { data, error } = await supabase
    .from("professional_profiles")
    .select("*")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveProProfile(
  input: Partial<ProProfile> & { display_name: string; category: ProCategory },
): Promise<ProProfile> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) throw new Error("Sign in to manage your service profile");
  // verification_status is never set from the client — only Halisia can verify.
  const { verification_status: _v, verified_at: _va, ...safe } = input;
  if (safe.published) {
    const readiness = profileReadiness({ ...input });
    if (!readiness.ok) {
      throw new Error(`Complete these before publishing: ${readiness.missing.join(", ")}`);
    }
  }
  const { data, error } = await supabase
    .from("professional_profiles")
    .upsert({ ...safe, user_id: userRes.user.id }, { onConflict: "user_id,category" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Submit registration evidence for review. Only ever moves the profile to
 * `pending` — a `verified` badge is granted by Halisia, never self-claimed.
 */
export async function submitVerification(input: {
  id: string;
  evidence: VerificationEvidence[];
  registration_body?: string | null;
  registration_number?: string | null;
  note?: string | null;
}): Promise<ProProfile> {
  if (input.evidence.length === 0) {
    throw new Error("Attach at least one document or link as evidence");
  }
  const { data, error } = await supabase
    .from("professional_profiles")
    .update({
      verification_evidence: input.evidence as unknown as never,
      verification_submitted_at: new Date().toISOString(),
      verification_note: input.note ?? null,
      registration_body: input.registration_body ?? null,
      registration_number: input.registration_number ?? null,
      verification_status: "pending",
    })
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

const REVIEW_PUBLIC_COLUMNS = "id, professional_id, rating, comment, created_at, updated_at";

/** Public review shape — reviewer identity is never exposed. */
export type PublicProReview = Omit<ProReview, "reviewer_id">;

export async function listReviews(professionalId: string): Promise<PublicProReview[]> {
  const { data, error } = await supabase
    .from("professional_reviews")
    .select(REVIEW_PUBLIC_COLUMNS)
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function submitReview(input: {
  professional_id: string;
  rating: number;
  comment?: string;
}): Promise<PublicProReview> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) throw new Error("Sign in to leave a review");
  const { data, error } = await supabase
    .from("professional_reviews")
    .upsert(
      { ...input, reviewer_id: userRes.user.id },
      { onConflict: "professional_id,reviewer_id" },
    )
    .select(REVIEW_PUBLIC_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function requestProfessional(input: {
  professional_id: string;
  project_brief: string;
  county?: string | null;
  budget_note?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  property_id?: string | null;
  preferred_start?: string | null;
  preferred_end?: string | null;
}): Promise<ProRequest> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) throw new Error("Sign in to send a contact request");
  const { data, error } = await supabase
    .from("professional_requests")
    .insert({ ...input, requester_id: userRes.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Requests addressed to profiles I own (professional dashboard leads). */
export async function listRequestsForMe(): Promise<ProRequest[]> {
  const { data, error } = await supabase
    .from("professional_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Requests I have sent, for the "my inquiries" panel on the dashboard. */
export async function listMyRequests(): Promise<ProRequest[]> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return [];
  const { data, error } = await supabase
    .from("professional_requests")
    .select("*")
    .eq("requester_id", userRes.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Provider confirms a consultation window (defaults to the requested one). */
export async function confirmRequestWindow(input: {
  id: string;
  start: string;
  end: string;
}): Promise<void> {
  const { error } = await supabase
    .from("professional_requests")
    .update({ confirmed_start: input.start, confirmed_end: input.end, status: "scheduled" })
    .eq("id", input.id);
  if (error) throw error;
}

/**
 * Turn a provider's weekly availability into concrete bookable windows over
 * the next `days` days, skipping anything already in the past.
 */
export function upcomingWindows(
  slots: AvailabilitySlot[],
  days = 14,
): Array<{ start: Date; end: Date; label: string }> {
  const out: Array<{ start: Date; end: Date; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    for (const s of slots.filter((s) => s.day === day.getDay())) {
      const [sh, sm] = s.start.split(":").map(Number);
      const [eh, em] = s.end.split(":").map(Number);
      const start = new Date(day);
      start.setHours(sh || 0, sm || 0, 0, 0);
      const end = new Date(day);
      end.setHours(eh || 0, em || 0, 0, 0);
      if (end <= now || end <= start) continue;
      out.push({
        start,
        end,
        label: `${start.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })} · ${s.start}–${s.end}`,
      });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, 12);
}

export async function setRequestStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("professional_requests").update({ status }).eq("id", id);
  if (error) throw error;
}

export function averageRating(reviews: ProReview[]): number | null {
  if (reviews.length === 0) return null;
  return Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
}

/** Verification wording — never imply registration is confirmed unless it is. */
export function verificationLabel(
  p: Pick<ProProfile, "verification_status" | "registration_body">,
) {
  switch (p.verification_status) {
    case "verified":
      return {
        label: "Verified by Halisia",
        note: p.registration_body
          ? `Registration with ${p.registration_body} checked by Halisia.`
          : "Credentials checked by Halisia.",
        tone: "emerald" as const,
      };
    case "pending":
      return {
        label: "Verification in review",
        note: "Submitted details are being checked. Treat registration as unconfirmed.",
        tone: "amber" as const,
      };
    default:
      return {
        label: "Self-declared",
        note: "Details supplied by the provider and not yet verified by Halisia. Confirm registration directly with the regulator before appointing.",
        tone: "muted" as const,
      };
  }
}

// ---------------------------------------------------------------------------
// Project matching
// ---------------------------------------------------------------------------

export type ProjectType =
  | "rental_apartments"
  | "family_home"
  | "subdivision"
  | "commercial"
  | "agricultural"
  | "buy_verify";

export const PROJECT_TYPES: Array<{ value: ProjectType; label: string; example: string }> = [
  {
    value: "rental_apartments",
    label: "Rental apartments",
    example: "I have land in Machakos and want to develop rental apartments.",
  },
  {
    value: "family_home",
    label: "Family home",
    example: "I want to build a 4-bedroom home in Kiambu.",
  },
  {
    value: "subdivision",
    label: "Subdivision & plots",
    example: "I want to subdivide 5 acres in Kajiado into plots.",
  },
  {
    value: "commercial",
    label: "Commercial development",
    example: "I plan a retail block in Nakuru town.",
  },
  {
    value: "agricultural",
    label: "Agricultural project",
    example: "I want a greenhouse farm in Meru.",
  },
  {
    value: "buy_verify",
    label: "Buying & verification",
    example: "I am buying a plot and need due diligence.",
  },
];

export type MatchRecommendation = {
  category: ProCategory;
  why: string;
  stage: "Feasibility" | "Design & approvals" | "Construction" | "Finance & risk";
  essential: boolean;
};

const MATCH_MATRIX: Record<ProjectType, MatchRecommendation[]> = {
  rental_apartments: [
    {
      category: "surveyor",
      why: "Confirm boundaries and produce a topographic survey before design.",
      stage: "Feasibility",
      essential: true,
    },
    {
      category: "architect",
      why: "Unit mix, massing and approval drawings for the apartment block.",
      stage: "Design & approvals",
      essential: true,
    },
    {
      category: "engineer",
      why: "Structural design for a multi-storey frame and services coordination.",
      stage: "Design & approvals",
      essential: true,
    },
    {
      category: "quantity_surveyor",
      why: "Cost plan and bills of quantities so the budget is defensible.",
      stage: "Design & approvals",
      essential: true,
    },
    {
      category: "environmental_consultant",
      why: "NEMA impact assessment is typically required at this scale.",
      stage: "Design & approvals",
      essential: true,
    },
    {
      category: "contractor",
      why: "Deliver the build against the approved drawings and cost plan.",
      stage: "Construction",
      essential: true,
    },
    {
      category: "bank",
      why: "Construction finance drawn down against certified progress.",
      stage: "Finance & risk",
      essential: false,
    },
    {
      category: "property_manager",
      why: "Letting, rent collection and maintenance once complete.",
      stage: "Finance & risk",
      essential: false,
    },
  ],
  family_home: [
    {
      category: "surveyor",
      why: "Fix the building line and confirm the parcel boundaries.",
      stage: "Feasibility",
      essential: true,
    },
    {
      category: "architect",
      why: "House design and county approval submission.",
      stage: "Design & approvals",
      essential: true,
    },
    {
      category: "engineer",
      why: "Foundation and structural design for the soil conditions.",
      stage: "Design & approvals",
      essential: true,
    },
    {
      category: "quantity_surveyor",
      why: "Keep the build inside budget with a priced schedule.",
      stage: "Design & approvals",
      essential: false,
    },
    {
      category: "contractor",
      why: "Construction of the dwelling.",
      stage: "Construction",
      essential: true,
    },
    {
      category: "interior_designer",
      why: "Fit-out and finishes specification.",
      stage: "Construction",
      essential: false,
    },
  ],
  subdivision: [
    {
      category: "surveyor",
      why: "Subdivision scheme, beacons and mutation forms.",
      stage: "Feasibility",
      essential: true,
    },
    {
      category: "planner",
      why: "Change of user and planning approval for the scheme.",
      stage: "Design & approvals",
      essential: true,
    },
    {
      category: "lawyer",
      why: "Title splitting, transfers and consents at the land registry.",
      stage: "Design & approvals",
      essential: true,
    },
    {
      category: "valuer",
      why: "Plot pricing evidence for sale or bank purposes.",
      stage: "Finance & risk",
      essential: false,
    },
    {
      category: "contractor",
      why: "Access roads, drainage and boundary works.",
      stage: "Construction",
      essential: false,
    },
  ],
  commercial: [
    {
      category: "surveyor",
      why: "Site survey and levels for a commercial footprint.",
      stage: "Feasibility",
      essential: true,
    },
    {
      category: "planner",
      why: "Zoning compliance and change of user where needed.",
      stage: "Feasibility",
      essential: true,
    },
    {
      category: "architect",
      why: "Commercial layout, parking and compliance design.",
      stage: "Design & approvals",
      essential: true,
    },
    {
      category: "engineer",
      why: "Structure, fire and services engineering.",
      stage: "Design & approvals",
      essential: true,
    },
    {
      category: "quantity_surveyor",
      why: "Cost plan, tendering and interim valuations.",
      stage: "Design & approvals",
      essential: true,
    },
    {
      category: "contractor",
      why: "Construction delivery.",
      stage: "Construction",
      essential: true,
    },
    {
      category: "financial_adviser",
      why: "Return modelling and funding structure.",
      stage: "Finance & risk",
      essential: false,
    },
    {
      category: "insurance_provider",
      why: "Contractors all-risk and public liability cover.",
      stage: "Finance & risk",
      essential: false,
    },
  ],
  agricultural: [
    {
      category: "surveyor",
      why: "Parcel extents and levels for irrigation planning.",
      stage: "Feasibility",
      essential: true,
    },
    {
      category: "environmental_consultant",
      why: "Water abstraction, soil and impact considerations.",
      stage: "Feasibility",
      essential: true,
    },
    {
      category: "utility_provider",
      why: "Borehole, water storage and power connection.",
      stage: "Construction",
      essential: true,
    },
    {
      category: "contractor",
      why: "Structures, fencing and access works.",
      stage: "Construction",
      essential: false,
    },
    {
      category: "financial_adviser",
      why: "Agricultural financing and grant options.",
      stage: "Finance & risk",
      essential: false,
    },
  ],
  buy_verify: [
    {
      category: "lawyer",
      why: "Title search, encumbrances and sale agreement.",
      stage: "Feasibility",
      essential: true,
    },
    {
      category: "surveyor",
      why: "Confirm beacons match the title before payment.",
      stage: "Feasibility",
      essential: true,
    },
    {
      category: "valuer",
      why: "Independent value check against the asking price.",
      stage: "Finance & risk",
      essential: true,
    },
    {
      category: "bank",
      why: "Mortgage or purchase financing where required.",
      stage: "Finance & risk",
      essential: false,
    },
    {
      category: "insurance_provider",
      why: "Title and property cover after transfer.",
      stage: "Finance & risk",
      essential: false,
    },
  ],
};

/** Simple keyword read of a free-text brief so the example prompt just works. */
export function inferProjectType(brief: string): ProjectType {
  const t = brief.toLowerCase();
  if (/(apartment|flats|rental block|units|bedsitter)/.test(t)) return "rental_apartments";
  if (/(subdivide|subdivision|plots|parcel split)/.test(t)) return "subdivision";
  if (/(shop|retail|office|mall|commercial|godown|warehouse)/.test(t)) return "commercial";
  if (/(farm|greenhouse|agri|irrigation|livestock|crop)/.test(t)) return "agricultural";
  if (/(buy|purchase|due diligence|verify|title search)/.test(t)) return "buy_verify";
  return "family_home";
}

export function recommendTeam(projectType: ProjectType): MatchRecommendation[] {
  return MATCH_MATRIX[projectType];
}

/**
 * Unified trust & verification status for Land Passports and listings.
 * Every step defaults to pending/unavailable. A step only becomes
 * "confirmed" when real runtime evidence supports it — never from OCR
 * success, completeness or an AI score.
 */
export type TrustState = "confirmed" | "pending" | "unavailable" | "not_applicable";

export type TrustStep = {
  key: "identity" | "documents" | "official_search" | "location" | "boundary" | "legal" | "listing";
  label: string;
  state: TrustState;
  detail: string;
};

export type SourceClass =
  | "official"
  | "independently_verified"
  | "seller_submitted"
  | "user_contributed"
  | "ai_generated"
  | "estimated"
  | "awaiting_verification";

export const SOURCE_CLASSES: Record<SourceClass, { label: string; meaning: string }> = {
  official: {
    label: "Officially sourced",
    meaning: "Published by a government or statutory body (e.g. census, county facts).",
  },
  independently_verified: {
    label: "Independently verified",
    meaning: "Checked by a qualified professional or authorised registry with recorded evidence.",
  },
  seller_submitted: {
    label: "Seller-submitted",
    meaning: "Provided by the person listing the property. Not checked by HALISIA.",
  },
  user_contributed: {
    label: "User-contributed",
    meaning: "Community observations. Reviewed before use, never treated as fact.",
  },
  ai_generated: {
    label: "AI analysis",
    meaning: "HALISIA interpretation of the evidence shown. Not a verification.",
  },
  estimated: {
    label: "Estimated / projected",
    meaning: "Modelled or proxy values with stated assumptions and uncertainty.",
  },
  awaiting_verification: {
    label: "Awaiting verification",
    meaning: "Claims that need a registry, survey or legal check before relying on them.",
  },
};

export type TrustInput = {
  /** Location status key from location-validation. */
  locationStatus: string;
  hasCoordinates: boolean;
  /** Is this Passport opened from a seller listing? */
  isListing?: boolean;
  /** Listing has seller-uploaded documents. */
  documentsSubmitted?: boolean;
  /** Parcel verification state recorded by an authorised reviewer. */
  evidenceBackedVerification?: boolean;
};

const EXACT = new Set(["verified_geometry", "verified_coordinate"]);

export function buildTrustSteps(i: TrustInput): TrustStep[] {
  const exact = EXACT.has(i.locationStatus);
  return [
    {
      key: "identity",
      label: "Identity verified",
      state: "unavailable",
      detail: "No identity-verification service is connected. Confirm seller ID in person.",
    },
    {
      key: "documents",
      label: "Documents submitted",
      state: !i.isListing ? "not_applicable" : i.documentsSubmitted ? "confirmed" : "pending",
      detail: !i.isListing
        ? "Only applies to listed properties."
        : i.documentsSubmitted
          ? "Seller uploaded documents. Submission is not proof of authenticity."
          : "No documents submitted yet.",
    },
    {
      key: "official_search",
      label: "Official search completed",
      state: "unavailable",
      detail:
        "HALISIA has no authorised land-registry connection. Obtain an official search via Ardhisasa or the Land Registry.",
    },
    {
      key: "location",
      label: "Location checked",
      state: !i.hasCoordinates ? "unavailable" : exact ? "confirmed" : "pending",
      detail: !i.hasCoordinates
        ? "No usable coordinates for this record."
        : exact
          ? "Coordinates passed range, Kenya-bounds and default-point checks."
          : "Position is approximate — treat the pin as an area, not a parcel.",
    },
    {
      key: "boundary",
      label: "Boundary confirmation",
      state: i.evidenceBackedVerification ? "confirmed" : "pending",
      detail: i.evidenceBackedVerification
        ? "An authorised reviewer recorded survey evidence."
        : "Needs a licensed surveyor to confirm beacons on site.",
    },
    {
      key: "legal",
      label: "Legal review",
      state: "pending",
      detail: "Needs an advocate to review title, encumbrances and consents.",
    },
    {
      key: "listing",
      label: "Listing information confirmed",
      state: i.isListing ? "pending" : "not_applicable",
      detail: i.isListing
        ? "Price, size and availability are as stated by the seller."
        : "Only applies to listed properties.",
    },
  ];
}

export function trustSummary(steps: TrustStep[]) {
  const applicable = steps.filter((s) => s.state !== "not_applicable");
  return {
    confirmed: applicable.filter((s) => s.state === "confirmed").length,
    total: applicable.length,
  };
}

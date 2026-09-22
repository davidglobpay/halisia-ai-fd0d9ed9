import type { PropertyKind, ListingIntent } from "@/lib/properties";

export type WizardDraft = {
  title: string;
  description: string;
  kind: PropertyKind;
  intent: ListingIntent;
  price: string;
  currency: string;
  size_value: string;
  size_unit: string;
  county: string;
  address: string;
  latitude: string;
  longitude: string;
  cover_image: string;
  media_urls: string[];
  amenities: string;
  utilities: string[];
  access_type: string;
  bedrooms: string;
  bathrooms: string;
  // rental block
  monthly_rent: string;
  deposit: string;
  service_charge: string;
  available_from: string;
  furnishing: string;
  parking_spaces: string;
  utilities_included: string[];
  security_features: string[];
  accessibility_features: string[];
  public_transport: string;
  house_rules: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  viewing_instructions: string;
};

export const EMPTY_DRAFT: WizardDraft = {
  title: "",
  description: "",
  kind: "land",
  intent: "sale",
  price: "",
  currency: "KES",
  size_value: "",
  size_unit: "acres",
  county: "",
  address: "",
  latitude: "",
  longitude: "",
  cover_image: "",
  media_urls: [],
  amenities: "",
  utilities: [],
  access_type: "",
  bedrooms: "",
  bathrooms: "",
  monthly_rent: "",
  deposit: "",
  service_charge: "",
  available_from: "",
  furnishing: "",
  parking_spaces: "",
  utilities_included: [],
  security_features: [],
  accessibility_features: [],
  public_transport: "",
  house_rules: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  viewing_instructions: "",
};

export type ChecklistItem = {
  key: string;
  label: string;
  why: string;
  weight: number;
  done: boolean;
  required: boolean;
  step: number;
};

export function isRental(d: WizardDraft) {
  return d.intent === "rent" || d.intent === "lease";
}

/** Deterministic completeness checklist — the AI coach layers advice on top. */
export function buildChecklist(d: WizardDraft): ChecklistItem[] {
  const has = (v: string) => v.trim().length > 0;
  const items: ChecklistItem[] = [
    {
      key: "title",
      label: "Listing title",
      why: "First thing buyers read in search results.",
      weight: 8,
      done: has(d.title),
      required: true,
      step: 1,
    },
    {
      key: "kind",
      label: "Property type & intent",
      why: "Places the listing in the right marketplace category.",
      weight: 4,
      done: true,
      required: true,
      step: 1,
    },
    {
      key: "price",
      label: isRental(d) ? "Monthly rent" : "Asking price",
      why: "Listings without a price get far fewer enquiries.",
      weight: 10,
      done: isRental(d) ? has(d.monthly_rent) : has(d.price),
      required: false,
      step: 1,
    },
    {
      key: "location",
      label: "County & address",
      why: "Powers county intelligence and local search.",
      weight: 8,
      done: has(d.county) && has(d.address),
      required: false,
      step: 2,
    },
    {
      key: "pin",
      label: "GPS / map pin",
      why: "Lets HALISIA read the site's terrain, air quality and nearby amenities, and show it on a map.",
      weight: 14,
      done: has(d.latitude) && has(d.longitude),
      required: false,
      step: 2,
    },
    {
      key: "size",
      label: "Plot / unit size",
      why: "Buyers filter by size before anything else.",
      weight: 8,
      done: has(d.size_value),
      required: false,
      step: 3,
    },
    {
      key: "access",
      label: "Road access",
      why: "Access type drives value and financing decisions.",
      weight: 6,
      done: has(d.access_type),
      required: false,
      step: 3,
    },
    {
      key: "utilities",
      label: "Utilities on-site",
      why: "Water and power availability is the top buyer question.",
      weight: 6,
      done: d.utilities.length > 0,
      required: false,
      step: 3,
    },
    {
      key: "amenities",
      label: "Nearby amenities",
      why: "Buyers ask what is within reach — schools, shops, hospitals.",
      weight: 5,
      done: has(d.amenities),
      required: false,
      step: 3,
    },
    {
      key: "photos",
      label: "Photos (3+)",
      why: "Listings with 3+ photos get materially more saves.",
      weight: 12,
      done: d.media_urls.length >= 3,
      required: false,
      step: 4,
    },
    {
      key: "cover",
      label: "Cover image",
      why: "The single image shown on marketplace cards.",
      weight: 5,
      done: has(d.cover_image) || d.media_urls.length > 0,
      required: false,
      step: 4,
    },
    {
      key: "description",
      label: "Description (80+ chars)",
      why: "Context reduces low-quality enquiries.",
      weight: 8,
      done: d.description.trim().length >= 80,
      required: false,
      step: 5,
    },
    {
      key: "contact",
      label: "Contact & viewing info",
      why: "Tells serious buyers exactly how to reach you.",
      weight: 6,
      done: has(d.contact_phone) || has(d.contact_email),
      required: false,
      step: 6,
    },
  ];

  if (isRental(d)) {
    items.push(
      {
        key: "deposit",
        label: "Deposit & service charge",
        why: "Renters budget on the total move-in cost.",
        weight: 6,
        done: has(d.deposit),
        required: false,
        step: 6,
      },
      {
        key: "available",
        label: "Available from date",
        why: "Renters filter by move-in date.",
        weight: 5,
        done: has(d.available_from),
        required: false,
        step: 6,
      },
      {
        key: "beds",
        label: "Bedrooms & bathrooms",
        why: "The primary rental filter.",
        weight: 6,
        done: has(d.bedrooms),
        required: false,
        step: 6,
      },
      {
        key: "furnishing",
        label: "Furnishing & parking",
        why: "Decides fit for relocating tenants.",
        weight: 4,
        done: has(d.furnishing),
        required: false,
        step: 6,
      },
      {
        key: "security",
        label: "Security features",
        why: "Top-three renter concern in Kenyan cities.",
        weight: 5,
        done: d.security_features.length > 0,
        required: false,
        step: 6,
      },
      {
        key: "transport",
        label: "Public transport notes",
        why: "Powers commute-based renter matching.",
        weight: 4,
        done: has(d.public_transport),
        required: false,
        step: 6,
      },
      {
        key: "rules",
        label: "House rules",
        why: "Prevents wasted viewings.",
        weight: 3,
        done: has(d.house_rules),
        required: false,
        step: 6,
      },
    );
  }

  return items;
}

export function completeness(items: ChecklistItem[]): number {
  const total = items.reduce((s, i) => s + i.weight, 0);
  const done = items.filter((i) => i.done).reduce((s, i) => s + i.weight, 0);
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

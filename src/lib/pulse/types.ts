/**
 * HALISIA Pulse — shared, client-safe types and vocabulary.
 * No server-only imports here: routes and components read this directly.
 */

export type PulseProvider = "newsdata" | "gnews" | "gdelt" | "rss";

export type PulseProviderStatus = "active" | "degraded" | "disabled" | "awaiting_api_key";

export type PulseGeoLevel =
  | "national"
  | "county"
  | "sub_county"
  | "town"
  | "estate"
  | "neighbourhood";

export const PULSE_CATEGORIES = [
  { slug: "politics", label: "Politics" },
  { slug: "infrastructure", label: "Infrastructure" },
  { slug: "roads", label: "Roads" },
  { slug: "transport", label: "Transport" },
  { slug: "housing", label: "Housing" },
  { slug: "land", label: "Land" },
  { slug: "property", label: "Property" },
  { slug: "environment", label: "Environment" },
  { slug: "climate", label: "Climate" },
  { slug: "flooding", label: "Flooding" },
  { slug: "agriculture", label: "Agriculture" },
  { slug: "business", label: "Business" },
  { slug: "technology", label: "Technology" },
  { slug: "health", label: "Health" },
  { slug: "education", label: "Education" },
  { slug: "security", label: "Security" },
  { slug: "investment", label: "Investment" },
  { slug: "energy", label: "Energy" },
  { slug: "utilities", label: "Utilities" },
  { slug: "tourism", label: "Tourism" },
  { slug: "county-government", label: "County Government" },
] as const;

export type PulseCategory = (typeof PULSE_CATEGORIES)[number]["slug"];

/** Quick filter chips shown above the feed. */
export const PULSE_QUICK_FILTERS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "national", label: "National" },
  { key: "property", label: "Property" },
  { key: "land", label: "Land" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "flooding", label: "Flooding" },
  { key: "investment", label: "Investment" },
  { key: "business", label: "Business" },
  { key: "environment", label: "Environment" },
  { key: "technology", label: "Technology" },
] as const;

export type PulseArticle = {
  id: string;
  provider: PulseProvider;
  url: string;
  title: string;
  author: string | null;
  sourceName: string | null;
  sourceLogoUrl: string | null;
  imageUrl: string | null;
  rawExcerpt: string | null;
  summary: string | null;
  whyItMatters: string | null;
  propertyImpact: string | null;
  landImpact: string | null;
  infrastructureImpact: string | null;
  investmentImpact: string | null;
  environmentalImpact: string | null;
  category: string;
  tags: string[];
  county: string | null;
  geoLevel: PulseGeoLevel;
  placeLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  confidence: number;
  viewCount: number;
  saveCount: number;
  shareCount: number;
  publishedAt: string | null;
  ingestedAt: string;
  trendingScore?: number;
};

export type PulseProviderHealth = {
  provider: PulseProvider;
  status: PulseProviderStatus;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  latencyMs: number | null;
  requestsToday: number;
  quotaNote: string | null;
};

export type PulseIngestionLog = {
  id: string;
  provider: PulseProvider;
  startedAt: string;
  finishedAt: string | null;
  fetchedCount: number;
  insertedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  failedCount: number;
  ok: boolean;
  errorMessage: string | null;
};

/** Speech engines the audio layer is designed to swap between. */
export type PulseTtsEngine = "web_speech" | "elevenlabs" | "azure" | "google";

/** Suggested HALISIA pilot tariffs, not provider or government fees.
 * Display only. Never use these prices to grant access or verify a payment.
 * Scout bookings use the database catalogue and server-calculated quote.
 *
 * Three tables live here and they are deliberately separate:
 *
 *   PLANS           recurring subscriptions, by who the plan is for
 *   SERVICE_PRICES  everything billed once, plus a row per plan so that a
 *                   page can show the relevant plan in context
 *   BUNDLES         packages that combine SERVICE_PRICES ids at a discount
 *
 * A bundle never carries its own copy of a component price. It lists the
 * SERVICE_PRICES ids it contains and the list price is summed from them, so a
 * bundle cannot silently stop being a discount when a component price moves.
 * `bundleSavingKes` is the number a buyer is shown and it is derived, never
 * typed in.
 *
 * On the two currencies: the USD figures are set separately for buyers paying
 * from outside Kenya and are NOT a live conversion of the KES figure. A
 * converted price drifts with the rate and would be wrong on the page within a
 * day of being written. Card settlement in USD also carries a processing cost
 * that M-Pesa does not. Both facts are stated on the pricing page rather than
 * hidden in a spread.
 */

export type PlanId =
  | "free"
  | "plus"
  | "pro"
  | "seller"
  | "studio"
  | "api"
  | "institution";

export type Plan = {
  id: PlanId;
  name: string;
  audience: string;
  /** 0 for the free plan and for quote-only plans, which are not sold monthly. */
  monthlyKes: number;
  monthlyUsd: number;
  /** Ten times monthly for every plan that is sold monthly: two months free. */
  annualKes: number;
  annualUsd: number;
  includes: readonly string[];
  readiness: string;
  /** Priced by agreement rather than off the shelf. */
  quoteOnly?: true;
  /**
   * The entitlements in this plan that also have a one-off price, so a page can
   * state what the plan is worth without anyone typing a figure.
   *
   * `perMonth` is the most a subscriber can draw in a month, so everything
   * computed from it is an upper bound and is labelled "up to" wherever it is
   * shown. Where a plan says "unlimited", the count here is a deliberately
   * conservative one a normal month would reach, never a number chosen to make
   * the plan look better: a claim about value has to survive the subscriber
   * checking it against the report prices on the same page.
   */
  includedValue?: readonly { serviceId: string; perMonth: number }[];
};

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "HALISIA Free",
    audience: "Anyone looking at a place in Kenya",
    monthlyKes: 0,
    monthlyUsd: 0,
    annualKes: 0,
    annualUsd: 0,
    includes: [
      "Location profiles for anywhere in Kenya, with every source named",
      "County records and the live county map",
      "Marketplace browsing, saved places and comparisons on screen",
      "Current beta PDF tools",
      "Scout quotes — build and price a visit before deciding",
    ],
    readiness:
      "Available now. Free tools stay free; nothing that is free today becomes paid.",
  },
  {
    id: "plus",
    name: "HALISIA Plus",
    audience: "A buyer working through one or two places",
    monthlyKes: 300,
    monthlyUsd: 3,
    annualKes: 3000,
    annualUsd: 30,
    includes: [
      "Everything in Free",
      "One Land Passport report each month",
      "Parcel snapshots without a per-report charge",
      "Saved comparisons and change alerts on places you follow",
      "Reports without the beta watermark",
    ],
    includedValue: [{ serviceId: "passport", perMonth: 1 }],
    readiness: "Subscription benefits, billing and activation pending.",
  },
  {
    id: "pro",
    name: "Professional Pro",
    audience: "Agents, brokers and listed professionals",
    monthlyKes: 990,
    monthlyUsd: 9,
    annualKes: 9900,
    annualUsd: 90,
    includes: [
      "Everything in Plus",
      "Five report credits each month, usable on any report up to the dossier",
      "Enhanced directory presence and lead management",
      "Client-facing cover page on reports you share",
      "Bulk county comparison",
    ],
    includedValue: [{ serviceId: "dossier", perMonth: 5 }],
    readiness:
      "Subscription benefits, billing and activation pending. Credentials remain subject to review.",
  },
  {
    id: "seller",
    name: "Seller Pro",
    audience: "Sellers, landlords and letting agents",
    monthlyKes: 1490,
    monthlyUsd: 13,
    annualKes: 14900,
    annualUsd: 130,
    includes: [
      "Everything in Plus",
      "Unlimited listing brochure packs",
      "One featured listing placement each month",
      "Enhanced listing insights and seller reporting",
    ],
    includedValue: [
      { serviceId: "brochure", perMonth: 2 },
      { serviceId: "listing", perMonth: 1 },
    ],
    readiness:
      "Subscription benefits, billing and activation pending. Advertising spend is separate.",
  },
  {
    id: "studio",
    name: "Studio",
    audience: "Developers, architects, surveyors and valuers",
    monthlyKes: 4900,
    monthlyUsd: 42,
    annualKes: 49000,
    annualUsd: 420,
    includes: [
      "Everything in Professional Pro",
      "Unlimited concept studies, massing and plan overlays",
      "Unlimited ground and geotechnical briefs",
      "Model Lab and Spatial Studio exports",
      "Three seats",
    ],
    includedValue: [
      { serviceId: "concept", perMonth: 2 },
      { serviceId: "geotech", perMonth: 2 },
    ],
    readiness:
      "Concept tools available in beta; seats, billing and activation pending. Professional drawings and statutory approvals are excluded.",
  },
  {
    id: "api",
    name: "Business API pilot",
    audience: "Businesses building on HALISIA data",
    monthlyKes: 9900,
    monthlyUsd: 85,
    annualKes: 99000,
    annualUsd: 850,
    includes: [
      "Proposed 1,000 calls each month",
      "Programmatic access to available HALISIA intelligence",
      "No registry access is included",
    ],
    readiness:
      "Commercial API access, quotas, billing and activation pending.",
  },
  {
    id: "institution",
    name: "Institutional licence",
    audience: "Counties, banks, SACCOs, insurers and development partners",
    monthlyKes: 0,
    monthlyUsd: 0,
    annualKes: 450000,
    annualUsd: 3800,
    quoteOnly: true,
    includes: [
      "Bulk parcel ingest and county-wide views",
      "Named seats with an access audit log",
      "Agreed support response times",
      "Scope, data sources and deliverables fixed in the agreement",
    ],
    readiness:
      "By agreement. Scope and price are confirmed in writing before any work starts.",
  },
] as const;

export type ServiceKind = "one_off" | "plan";

export type ServicePrice = {
  id: string;
  name: string;
  kind: ServiceKind;
  /** Set on `plan` rows only; must equal that plan's monthlyKes. */
  planId?: PlanId;
  amount: number;
  /** Set separately for payers outside Kenya; not a conversion of `amount`. */
  usd?: number;
  unit: string;
  scope: string;
  free: string;
  readiness: string;
  paths: readonly string[];
};

export const SERVICE_PRICES: readonly ServicePrice[] = [
  {
    id: "parcel",
    name: "Parcel snapshot",
    kind: "one_off",
    amount: 190,
    usd: 2,
    unit: "per parcel",
    scope:
      "One page: where the parcel is, the county record, how confident the location is and which sources were used.",
    free: "Reading the same location profile on screen remains free.",
    readiness: "Beta export available; paid entitlement pending.",
    paths: ["/explore", "/county", "/report"],
  },
  {
    id: "daypass",
    name: "Day pass",
    kind: "one_off",
    amount: 290,
    usd: 3,
    unit: "per 24 hours",
    scope:
      "Twenty-four hours of parcel snapshots with no per-report charge, plus one Land Passport report.",
    free: "Browsing, county records and the map stay free without a pass.",
    readiness: "Pass issuing, metering and billing pending.",
    paths: ["/explore", "/report", "/reports"],
  },
  {
    id: "passport",
    name: "Land Passport report",
    kind: "one_off",
    amount: 490,
    usd: 5,
    unit: "per location",
    scope: "Evidence-labelled PDF with available sources, risks and data gaps.",
    free: "Location profile and current beta PDF tools remain free.",
    readiness: "Beta report available; paid entitlement pending.",
    paths: ["/passport", "/report", "/reports"],
  },
  {
    id: "listing",
    name: "Featured property listing",
    kind: "one_off",
    amount: 500,
    usd: 5,
    unit: "per listing for 7 days",
    scope:
      "Proposed labelled sponsored placement; no sale or verification guarantee.",
    free: "Standard listings and browsing remain free.",
    readiness: "Sponsored placement and payment activation pending.",
    paths: ["/marketplace", "/sell", "/seller-tools"],
  },
  {
    id: "titledeed",
    name: "Title deed location report",
    kind: "one_off",
    amount: 690,
    usd: 7,
    unit: "per deed",
    scope:
      "Reads the parcel details off a deed photograph, then records how the location was arrived at, how uncertain it is and what the buildable envelope looks like under the setbacks you enter. Architectural visualisation only — not cadastral placement or survey evidence.",
    free: "Reading a deed on screen and the on-screen envelope remain free.",
    readiness: "Report available in beta; paid entitlement pending.",
    paths: ["/title-deed"],
  },
  {
    id: "compare",
    name: "Investment comparison report",
    kind: "one_off",
    amount: 790,
    usd: 8,
    unit: "per comparison, up to 3 locations",
    scope: "Proposed consolidated decision report using available evidence.",
    free: "Interactive comparisons and current beta exports remain free.",
    readiness: "Paid report packaging and entitlement pending.",
    paths: ["/compare", "/compare-locations"],
  },
  {
    id: "design",
    name: "Design Studio concept pack",
    kind: "one_off",
    amount: 990,
    usd: 9,
    unit: "per concept pack",
    scope:
      "Proposed saved concept views, assumptions and feasibility summary. Professional drawings and approvals excluded.",
    free: "Current model previews, AR and beta design tools remain free.",
    readiness:
      "Concept tools available; paid pack packaging and entitlement pending.",
    paths: ["/design-studio", "/model-lab", "/spatial", "/develop"],
  },
  {
    id: "geotech",
    name: "Ground and geotechnical brief",
    kind: "one_off",
    amount: 1290,
    usd: 12,
    unit: "per site",
    scope:
      "Proposed ground conditions, slope and drainage summary from available evidence. It is a desk brief and does not replace a site investigation by a geotechnical engineer.",
    free: "Terrain and drainage indicators on screen remain free.",
    readiness: "Brief available in beta; paid entitlement pending.",
    paths: ["/title-deed", "/develop", "/design-studio"],
  },
  {
    id: "dossier",
    name: "Detailed due-diligence dossier",
    kind: "one_off",
    amount: 1490,
    usd: 14,
    unit: "per location",
    scope:
      "Proposed deeper environmental, legal-context and construction analysis; external professional work excluded.",
    free: "Existing evidence summaries remain free.",
    readiness:
      "Expanded paid service in development; payment alone will not activate it.",
    paths: ["/title-deed", "/passport", "/reports"],
  },
  {
    id: "brochure",
    name: "Listing brochure pack",
    kind: "one_off",
    amount: 1490,
    usd: 14,
    unit: "per property",
    scope:
      "Proposed brochure as a PDF, an editable Word file and plain text, built from the listing details you have entered.",
    free: "Creating and editing the listing itself remains free.",
    readiness: "Brochure export available in beta; paid entitlement pending.",
    paths: ["/sell", "/seller-tools", "/marketplace"],
  },
  {
    id: "concept",
    name: "Concept study with massing and plan overlay",
    kind: "one_off",
    amount: 2900,
    usd: 28,
    unit: "per site",
    scope:
      "Proposed room-by-room brief, a massing study on the plot you entered and a plan overlay fitted against the boundary, with the fit described in writing. Architectural visualisation only — not cadastral placement or survey evidence, and not a substitute for an architect.",
    free: "The on-screen massing study and plan overlay remain free.",
    readiness: "Study available in beta; paid entitlement pending.",
    paths: ["/title-deed", "/design-studio", "/model-lab", "/develop"],
  },
  // Plan rows. These exist so a page can show the subscription that belongs to
  // it in context. The canonical subscription table is PLANS, and a test keeps
  // `amount` equal to that plan's monthly price.
  {
    id: "professional",
    name: "Professional Pro",
    kind: "plan",
    planId: "pro",
    amount: 990,
    usd: 9,
    unit: "per month",
    scope:
      "Proposed enhanced directory presence and lead management; credentials remain subject to review.",
    free: "Basic profiles, discovery and requests remain free. Provider work is quoted separately.",
    readiness: "Subscription benefits, billing and activation pending.",
    paths: ["/connections", "/pros", "/pro-profile"],
  },
  {
    id: "seller",
    name: "Seller Pro",
    kind: "plan",
    planId: "seller",
    amount: 1490,
    usd: 13,
    unit: "per month",
    scope:
      "Proposed enhanced listing insights and seller reporting; advertising spend excluded.",
    free: "Existing seller tools remain available in beta.",
    readiness: "Subscription benefits, billing and activation pending.",
    paths: ["/seller-tools", "/sell", "/rentals"],
  },
  {
    id: "api",
    name: "Business API pilot",
    kind: "plan",
    planId: "api",
    amount: 9900,
    usd: 85,
    unit: "per month, proposed 1,000 calls",
    scope:
      "Proposed business access to available HALISIA intelligence; no registry access included.",
    free: "Public app exploration remains free.",
    readiness: "Commercial API access, quotas, billing and activation pending.",
    paths: ["/mcp"],
  },
] as const;

export type Bundle = {
  id: string;
  name: string;
  audience: string;
  amountKes: number;
  amountUsd: number;
  /** SERVICE_PRICES ids. The list price is summed from these, never typed in. */
  includes: readonly string[];
  /** Things in the package that are not a SERVICE_PRICES row. */
  extras?: readonly { label: string; kes: number }[];
  readiness: string;
};

export const BUNDLES: readonly Bundle[] = [
  {
    id: "starter",
    name: "Starter check",
    audience: "A first look before you spend a Saturday travelling",
    amountKes: 590,
    amountUsd: 6,
    includes: ["parcel", "passport"],
    readiness: "Packaging and payment activation pending.",
  },
  {
    id: "buyer",
    name: "Buyer pack",
    audience: "You have found a plot and you are close to committing",
    amountKes: 1990,
    amountUsd: 18,
    includes: ["passport", "titledeed", "geotech", "compare"],
    readiness: "Packaging and payment activation pending.",
  },
  {
    id: "builder",
    name: "Builder pack",
    audience: "You are buying in order to build",
    amountKes: 3900,
    amountUsd: 35,
    includes: ["passport", "titledeed", "geotech", "compare", "design", "concept"],
    readiness: "Packaging and payment activation pending.",
  },
  {
    id: "diaspora",
    name: "Diaspora assurance",
    audience: "You are buying in Kenya and cannot stand on the plot yourself",
    amountKes: 11900,
    amountUsd: 99,
    includes: ["passport", "titledeed", "geotech", "compare", "design", "concept"],
    extras: [
      {
        label:
          "KES 6,000 toward one Scout visit — a person goes, photographs and records what they see. Travel beyond the credit is quoted and charged separately.",
        kes: 6000,
      },
      { label: "Twelve months of HALISIA Plus", kes: 3000 },
    ],
    readiness:
      "Packaging and payment activation pending. Scout dispatch additionally requires an approved scout and configured payment instructions.",
  },
] as const;

/** The plan this browser currently has. Payment integration replaces this
 * constant with the plan recorded against the signed-in account. Nothing in
 * the app gates on it today: every tool that is free now stays reachable. */
export const CURRENT_PLAN_ID: PlanId = "free";

export const planById = (id: PlanId): Plan | undefined =>
  PLANS.find((p) => p.id === id);

export const serviceById = (id: string): ServicePrice | undefined =>
  SERVICE_PRICES.find((s) => s.id === id);

export function pricesForPath(path: string) {
  return SERVICE_PRICES.filter((p) =>
    p.paths.some((prefix) => path === prefix || path.startsWith(prefix + "/")),
  );
}

/** What the contents of a bundle would cost bought one at a time. */
export function bundleListKes(b: Bundle): number {
  const services = b.includes.reduce(
    (sum, id) => sum + (serviceById(id)?.amount ?? 0),
    0,
  );
  const extras = (b.extras ?? []).reduce((sum, e) => sum + e.kes, 0);
  return services + extras;
}

export function bundleSavingKes(b: Bundle): number {
  return Math.max(0, bundleListKes(b) - b.amountKes);
}

/** Months saved by paying for a year up front, given the ten-month rule. */
export function annualSavingKes(p: Plan): number {
  if (p.quoteOnly || p.monthlyKes === 0) return 0;
  return Math.max(0, p.monthlyKes * 12 - p.annualKes);
}

/** The same saving for someone paying by card. */
export function annualSavingUsd(p: Plan): number {
  if (p.quoteOnly || p.monthlyUsd === 0) return 0;
  return Math.max(0, p.monthlyUsd * 12 - p.annualUsd);
}

/**
 * The most a subscriber could draw from a plan in one month, valued at the
 * one-off prices on the same page. An upper bound, always shown as "up to".
 */
export function planIncludedValueKes(p: Plan): number {
  return (p.includedValue ?? []).reduce(
    (sum, v) => sum + (serviceById(v.serviceId)?.amount ?? 0) * v.perMonth,
    0,
  );
}

/**
 * How many times over a month of the plan the included reports are worth, at
 * list price. Zero where the plan includes nothing with a price of its own.
 */
export function planValueMultiple(p: Plan): number {
  if (p.monthlyKes <= 0) return 0;
  return planIncludedValueKes(p) / p.monthlyKes;
}

/**
 * A package's saving as a percentage. The shilling figures are the
 * authoritative set, so a card showing dollars quotes the percentage rather
 * than a dollar saving: the extras inside a package (a Scout credit, a year of
 * Plus) are priced in shillings only, and a dollar "list price" summed from
 * them would be invented.
 */
export function bundleSavingPct(b: Bundle): number {
  const list = bundleListKes(b);
  if (list <= 0) return 0;
  return Math.round((bundleSavingKes(b) / list) * 100);
}

export const priceKes = (amount: number) =>
  "KES " + amount.toLocaleString("en-KE");

export const priceUsd = (amount: number) =>
  "USD " + amount.toLocaleString("en-US");

/* The three "from" figures the landing page quotes. They are derived here so
 * that page can never hard-code a price that the tables have moved past. */

export const lowestOneOffKes = (): number =>
  Math.min(
    ...SERVICE_PRICES.filter((s) => s.kind === "one_off").map((s) => s.amount),
  );

export const lowestBundleKes = (): number =>
  Math.min(...BUNDLES.map((b) => b.amountKes));

export const lowestPaidPlanMonthlyKes = (): number =>
  Math.min(
    ...PLANS.filter((p) => !p.quoteOnly && p.monthlyKes > 0).map(
      (p) => p.monthlyKes,
    ),
  );

/** Suggested HALISIA pilot tariffs, not provider or government fees.
 * Display only. Never use these prices to grant access or verify a payment.
 * Scout bookings use the database catalogue and server-calculated quote.
 */
export const SERVICE_PRICES = [
  {
    id: "passport",
    name: "Land Passport report",
    amount: 490,
    unit: "per location",
    scope: "Evidence-labelled PDF with available sources, risks and data gaps.",
    free: "Location profile and current beta PDF tools remain free.",
    readiness: "Beta report available; paid entitlement pending.",
    paths: ["/passport", "/report", "/reports"],
  },
  {
    id: "dossier",
    name: "Detailed due-diligence dossier",
    amount: 1490,
    unit: "per location",
    scope:
      "Proposed deeper environmental, legal-context and construction analysis; external professional work excluded.",
    free: "Existing evidence summaries remain free.",
    readiness:
      "Expanded paid service in development; payment alone will not activate it.",
    paths: ["/title-deed", "/passport", "/reports"],
  },
  {
    id: "compare",
    name: "Investment comparison report",
    amount: 790,
    unit: "per comparison, up to 3 locations",
    scope: "Proposed consolidated decision report using available evidence.",
    free: "Interactive comparisons and current beta exports remain free.",
    readiness: "Paid report packaging and entitlement pending.",
    paths: ["/compare", "/compare-locations"],
  },
  {
    id: "design",
    name: "Design Studio concept pack",
    amount: 990,
    unit: "per concept pack",
    scope:
      "Proposed saved concept views, assumptions and feasibility summary. Professional drawings and approvals excluded.",
    free: "Current model previews, AR and beta design tools remain free.",
    readiness:
      "Concept tools available; paid pack packaging and entitlement pending.",
    paths: ["/design-studio", "/model-lab", "/spatial", "/develop"],
  },
  {
    id: "listing",
    name: "Featured property listing",
    amount: 500,
    unit: "per listing for 7 days",
    scope:
      "Proposed labelled sponsored placement; no sale or verification guarantee.",
    free: "Standard listings and browsing remain free.",
    readiness: "Sponsored placement and payment activation pending.",
    paths: ["/marketplace", "/sell", "/seller-tools"],
  },
  {
    id: "seller",
    name: "Seller Pro",
    amount: 1490,
    unit: "per month",
    scope:
      "Proposed enhanced listing insights and seller reporting; advertising spend excluded.",
    free: "Existing seller tools remain available in beta.",
    readiness: "Subscription benefits, billing and activation pending.",
    paths: ["/seller-tools", "/sell", "/rentals"],
  },
  {
    id: "professional",
    name: "Professional Pro",
    amount: 990,
    unit: "per month",
    scope:
      "Proposed enhanced directory presence and lead management; credentials remain subject to review.",
    free: "Basic profiles, discovery and requests remain free. Provider work is quoted separately.",
    readiness: "Subscription benefits, billing and activation pending.",
    paths: ["/connections", "/pros", "/pro-profile"],
  },
  {
    id: "api",
    name: "Business API pilot",
    amount: 9900,
    unit: "per month, proposed 1,000 calls",
    scope:
      "Proposed business access to available HALISIA intelligence; no registry access included.",
    free: "Public app exploration remains free.",
    readiness: "Commercial API access, quotas, billing and activation pending.",
    paths: ["/mcp"],
  },
] as const;

export function pricesForPath(path: string) {
  return SERVICE_PRICES.filter((p) =>
    p.paths.some((prefix) => path === prefix || path.startsWith(prefix + "/")),
  );
}
export const priceKes = (amount: number) =>
  "KES " + amount.toLocaleString("en-KE");

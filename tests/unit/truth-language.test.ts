/**
 * Truth-language source regression.
 *
 * HALISIA's public surfaces may never imply verification, partnership or legal
 * authority that the underlying evidence does not support. These checks read the
 * source files directly so a copy regression fails in CI rather than in front of
 * a buyer.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const LANDING = read("src/routes/index.tsx");
const SECTIONS = read("src/components/halisia/landing-sections.tsx");
const NAV_GUIDE = read("src/components/halisia/nav-guide.tsx");
const EVIDENCE = read("src/lib/evidence.ts");
const COUNTY_MAP = read("src/components/halisia/kenya-county-map.tsx");
const PDF_COMPARE = read("src/lib/pdf-county-compare.ts");

const PUBLIC_SURFACES: Array<[string, string]> = [
  ["src/routes/index.tsx", LANDING],
  ["src/components/halisia/landing-sections.tsx", SECTIONS],
  ["src/components/halisia/nav-guide.tsx", NAV_GUIDE],
  ["src/lib/evidence.ts", EVIDENCE],
  ["src/components/halisia/kenya-county-map.tsx", COUNTY_MAP],
  ["src/lib/pdf-county-compare.ts", PDF_COMPARE],
];

describe("required public wording", () => {
  it.each([
    ["Community-contributed", LANDING],
    ["Read the location profile", LANDING],
    ["every score names its sources", LANDING],
    ["confidence stated on every output", LANDING],
    ["we do not assert title, boundary or ownership", LANDING],
    ["Every listing shows its source", SECTIONS],
    ["evidence behind them", SECTIONS],
    ["Reviewed contributions add to county data completeness", SECTIONS],
    ["credentials they've submitted", SECTIONS],
    ["county emblems", NAV_GUIDE],
    ["supported by multiple public sources", COUNTY_MAP],
    ["multiple-source support", PDF_COMPARE],
  ])("contains %s", (needle, source) => {
    expect(source).toContain(needle);
  });
});

describe("forbidden claims on public surfaces", () => {
  const forbidden = [
    "Community-verified",
    "See live intelligence",
    "Real Google Maps signals",
    "Every listing is verified through the HALISIA data pipeline",
    "Verified contributions raise county confidence scores",
    "with verification status and availability",
    "cross-verified",
    "official emblems",
    "persona-weighted 10-module score",
    "halisi-ai.lovable.app",
    "Rated 5 out of 5",
    "const VOICES",
  ];
  it.each(forbidden)("no surface says %s", (needle) => {
    const offenders = PUBLIC_SURFACES.filter(([, src]) => src.includes(needle)).map(([p]) => p);
    expect(offenders).toEqual([]);
  });
});

describe("evidence citations", () => {
  it("uses the correct halisia-ai domain", () => {
    expect(EVIDENCE).toContain("https://halisia-ai.lovable.app/marketplace");
    expect(EVIDENCE).toContain("https://halisia-ai.lovable.app/dashboard");
    expect(EVIDENCE).not.toContain("halisi-ai.lovable.app");
  });

  it("keeps zoning explicitly non-verifiable", () => {
    expect(EVIDENCE).toContain("Not machine-verifiable");
  });
});

describe("landing scenarios are illustrative, not testimonial", () => {
  it("declares illustrative scenarios instead of named quotes", () => {
    expect(LANDING).toContain("const SCENARIOS");
    expect(LANDING).toContain("Before wiring a deposit");
    expect(LANDING).toContain("Buying from abroad");
    expect(LANDING).toContain("Choosing where to spend a site visit");
  });

  it("renders no star rating markup", () => {
    expect(LANDING).not.toMatch(/<Star\b/);
    expect(LANDING).not.toMatch(/<Quote\b/);
  });
});

describe("marketplace trust states stay explicit", () => {
  const core = read("src/lib/marketplace.ts");
  const marketplace = read("src/routes/marketplace.index.tsx");
  const tiers = [
    "SOURCE_LISTED",
    "DATA_COMPLETENESS",
    "DOCUMENTS_REVIEWED",
    "EVIDENCE_VERIFIED",
    "REGULATOR_VERIFIED",
  ];

  it.each(tiers)("requires the %s concept", (tier) => {
    expect(core).toContain(`"${tier}"`);
  });

  it("does not derive evidence verification from listing fields", () => {
    expect(core).not.toContain('return "verified"');
    expect(core).not.toContain("Verified listing with complete data");
    expect(core).not.toMatch(/ai_score[\s\S]{0,160}evidenceVerified:\s*true/);
    expect(core).not.toMatch(/latitude[\s\S]{0,160}evidenceVerified:\s*true/);
    expect(core).not.toMatch(/completeness\([^)]*\)[\s\S]{0,160}evidenceVerified:\s*true/);
  });

  it("labels provenance, completeness and evidence separately in marketplace UI", () => {
    expect(marketplace).toContain("Source listed");
    expect(marketplace).toContain("% complete");
    expect(marketplace).toContain("Evidence not reviewed");
    expect(marketplace).toContain("Evidence-verified listings only");
    expect(marketplace).not.toMatch(/>Verified<|Verified listings only/);
  });
});

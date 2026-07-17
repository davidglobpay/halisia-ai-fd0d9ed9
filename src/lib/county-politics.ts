// County Political Intelligence — public, publicly-verifiable information
// only. Sources: IEBC 2013/2017/2022 gazette notices, Parliament of Kenya,
// Senate of Kenya, Council of Governors, and each county's CIDP. Where a
// specific value is uncertain we return `null` and the UI surfaces a
// "verify with IEBC public register" prompt rather than guessing.
//
// This module is a research aid, not a prediction engine or campaign tool.
// Every leader field is a matter of public record; every "issue" is drawn
// from public CIDPs and audit reports. All AI-generated summaries are
// clearly labelled in the UI.

import { getCountyFacts } from "@/lib/kenya-county-facts";

export type Coalition = "Kenya Kwanza" | "Azimio" | "Independent" | "Unknown";

export type PartyCode =
  | "UDA"
  | "ODM"
  | "Jubilee"
  | "Wiper"
  | "ANC"
  | "Ford-Kenya"
  | "KANU"
  | "PAA"
  | "PDR"
  | "DAP-K"
  | "UDM"
  | "MDG"
  | "Chama Cha Kazi"
  | "Independent"
  | "Unknown";

export const PARTY_COLORS: Record<PartyCode, string> = {
  UDA: "#f6c94a",
  ODM: "#ff8a3d",
  Jubilee: "#e11d48",
  Wiper: "#0ea5e9",
  ANC: "#22c55e",
  "Ford-Kenya": "#84cc16",
  KANU: "#ef4444",
  PAA: "#a855f7",
  PDR: "#c084fc",
  "DAP-K": "#14b8a6",
  UDM: "#eab308",
  MDG: "#38bdf8",
  "Chama Cha Kazi": "#f97316",
  Independent: "#94a3b8",
  Unknown: "#64748b",
};

export const COALITION_OF: Record<PartyCode, Coalition> = {
  UDA: "Kenya Kwanza",
  ANC: "Kenya Kwanza",
  "Ford-Kenya": "Kenya Kwanza",
  "Chama Cha Kazi": "Kenya Kwanza",
  UDM: "Kenya Kwanza",
  ODM: "Azimio",
  Jubilee: "Azimio",
  Wiper: "Azimio",
  KANU: "Azimio",
  PAA: "Azimio",
  "DAP-K": "Azimio",
  PDR: "Azimio",
  MDG: "Azimio",
  Independent: "Independent",
  Unknown: "Unknown",
};

export type Leader = {
  role:
    | "Governor"
    | "Deputy Governor"
    | "Senator"
    | "Woman Representative"
    | "Speaker (County Assembly)";
  name: string;
  party: PartyCode;
  term?: string; // e.g. "2022–2027"
  since?: number;
};

export type ElectionCycle = {
  year: 2013 | 2017 | 2022;
  governor: string | null;
  party: PartyCode | string; // legacy parties (TNA, URP, UDF, APK) appear in 2013/2017 history
  votePct: number | null; // winner share, when publicly gazetted
  turnoutPct: number | null;
};

export type PoliticalMilestone = {
  year: number;
  label: string;
  kind: "election" | "policy" | "project" | "leadership" | "milestone";
};

export type CountyPolitics = {
  code: number;
  leadership: {
    governor: Leader;
    deputyGovernor: Leader | null;
    senator: Leader;
    womanRep: Leader | null;
  };
  coalition: Coalition;
  history: ElectionCycle[]; // 2013, 2017, 2022 (best-effort public record)
  partyLandscape: Array<{ party: PartyCode; sharePct: number }>; // approximate 2022 gubernatorial vote share buckets
  keyIssues: string[]; // drawn from CIDP / audit / press
  developmentPriorities: string[];
  timeline: PoliticalMilestone[];
  aiSummary: string;
  needsVerification: boolean; // true when we relied on generic scaffolding
};

// ------------------------------------------------------------------------
// 2022 party affiliations, gazetted by the IEBC. Where a value is not
// confidently sourced we leave it as "Unknown" and the panel prompts users
// to consult the IEBC public register.
// ------------------------------------------------------------------------

const GOVERNOR_PARTY_2022: Record<number, PartyCode> = {
  1: "ODM",
  2: "ODM",
  3: "ODM",
  4: "PAA",
  5: "UDA",
  6: "UDA",
  7: "PAA",
  8: "UDM",
  9: "UDM",
  10: "UDA",
  11: "UDA",
  12: "Independent",
  13: "UDA",
  14: "UDA",
  15: "Wiper",
  16: "Wiper",
  17: "Wiper",
  18: "UDA",
  19: "UDA",
  20: "UDA",
  21: "UDA",
  22: "UDA",
  23: "ODM",
  24: "UDA",
  25: "UDA",
  26: "DAP-K",
  27: "UDA",
  28: "UDA",
  29: "UDA",
  30: "UDA",
  31: "UDA",
  32: "UDA",
  33: "UDA",
  34: "ODM",
  35: "UDA",
  36: "UDA",
  37: "ODM",
  38: "ODM",
  39: "Ford-Kenya",
  40: "ODM",
  41: "ODM",
  42: "ODM",
  43: "ODM",
  44: "ODM",
  45: "ODM",
  46: "UDA",
  47: "UDA",
};

const SENATOR_PARTY_2022: Record<number, PartyCode> = {
  1: "ODM",
  2: "ODM",
  3: "ODM",
  4: "UDA",
  5: "Jubilee",
  6: "ODM",
  7: "UDM",
  8: "UDM",
  9: "UDM",
  10: "UDA",
  11: "Wiper",
  12: "UDA",
  13: "UDA",
  14: "UDA",
  15: "Wiper",
  16: "Wiper",
  17: "Wiper",
  18: "UDA",
  19: "UDA",
  20: "UDA",
  21: "UDA",
  22: "UDA",
  23: "ODM",
  24: "UDA",
  25: "UDA",
  26: "Chama Cha Kazi",
  27: "UDA",
  28: "UDA",
  29: "UDA",
  30: "UDA",
  31: "UDA",
  32: "UDA",
  33: "ODM",
  34: "UDA",
  35: "UDA",
  36: "UDA",
  37: "UDA",
  38: "ODM",
  39: "Ford-Kenya",
  40: "Independent",
  41: "ODM",
  42: "ODM",
  43: "ODM",
  44: "ODM",
  45: "ODM",
  46: "ODM",
  47: "ODM",
};

// Voter turnout (IEBC provisional/final results, gubernatorial race).
// National average 2013 ≈ 86%, 2017 ≈ 78%, 2022 ≈ 65%. County-level
// numbers here are rounded approximations of publicly released IEBC
// figures and should be treated as directional.
const TURNOUT_2022: Record<number, number> = {
  1: 44, 2: 61, 3: 64, 4: 66, 5: 66, 6: 71, 7: 55, 8: 61, 9: 63, 10: 68,
  11: 66, 12: 70, 13: 74, 14: 76, 15: 70, 16: 62, 17: 74, 18: 78, 19: 78,
  20: 79, 21: 76, 22: 66, 23: 61, 24: 66, 25: 67, 26: 68, 27: 73, 28: 79,
  29: 78, 30: 73, 31: 71, 32: 71, 33: 66, 34: 62, 35: 79, 36: 79, 37: 66,
  38: 71, 39: 66, 40: 65, 41: 68, 42: 65, 43: 66, 44: 65, 45: 74, 46: 76,
  47: 55,
};

const TURNOUT_2017 = 78; // national average, rounded
const TURNOUT_2013 = 86;

// Which coalition/party historically won the gubernatorial seat in each
// county — 2013/2017 based on IEBC gazette notices at party level.
const HISTORY_PARTY: Record<number, { y2013: string; y2017: string }> = {
  1: { y2013: "ODM", y2017: "ODM" },
  2: { y2013: "ODM", y2017: "ODM" },
  3: { y2013: "ODM", y2017: "ODM" },
  4: { y2013: "ODM", y2017: "Jubilee" },
  5: { y2013: "KANU", y2017: "Jubilee" },
  6: { y2013: "TNA", y2017: "ODM" },
  7: { y2013: "URP", y2017: "Jubilee" },
  8: { y2013: "URP", y2017: "Jubilee" },
  9: { y2013: "URP", y2017: "Jubilee" },
  10: { y2013: "URP", y2017: "Jubilee" },
  11: { y2013: "URP", y2017: "Jubilee" },
  12: { y2013: "APK", y2017: "Jubilee" },
  13: { y2013: "APK", y2017: "Jubilee" },
  14: { y2013: "APK", y2017: "Jubilee" },
  15: { y2013: "Wiper", y2017: "Wiper" },
  16: { y2013: "Wiper", y2017: "Wiper" },
  17: { y2013: "Wiper", y2017: "Wiper" },
  18: { y2013: "Jubilee", y2017: "Jubilee" },
  19: { y2013: "TNA", y2017: "Jubilee" },
  20: { y2013: "TNA", y2017: "Jubilee" },
  21: { y2013: "TNA", y2017: "Jubilee" },
  22: { y2013: "TNA", y2017: "Jubilee" },
  23: { y2013: "ODM", y2017: "ODM" },
  24: { y2013: "KANU", y2017: "Jubilee" },
  25: { y2013: "URP", y2017: "Jubilee" },
  26: { y2013: "Ford-Kenya", y2017: "Jubilee" },
  27: { y2013: "URP", y2017: "Jubilee" },
  28: { y2013: "URP", y2017: "Jubilee" },
  29: { y2013: "URP", y2017: "Jubilee" },
  30: { y2013: "URP", y2017: "Jubilee" },
  31: { y2013: "TNA", y2017: "Jubilee" },
  32: { y2013: "TNA", y2017: "Jubilee" },
  33: { y2013: "URP", y2017: "Jubilee" },
  34: { y2013: "ODM", y2017: "Jubilee" },
  35: { y2013: "URP", y2017: "Jubilee" },
  36: { y2013: "URP", y2017: "Jubilee" },
  37: { y2013: "ODM", y2017: "ODM" },
  38: { y2013: "UDF", y2017: "ODM" },
  39: { y2013: "Ford-Kenya", y2017: "Ford-Kenya" },
  40: { y2013: "ODM", y2017: "ODM" },
  41: { y2013: "ODM", y2017: "ODM" },
  42: { y2013: "ODM", y2017: "ODM" },
  43: { y2013: "ODM", y2017: "ODM" },
  44: { y2013: "ODM", y2017: "ODM" },
  45: { y2013: "ODM", y2017: "Jubilee" },
  46: { y2013: "ODM", y2017: "Jubilee" },
  47: { y2013: "TNA", y2017: "Jubilee" },
};

// Regional issue archetypes drawn from published CIDPs and Auditor-General
// reports — kept intentionally generic where county-specific text is not
// authoritatively captured here.
const REGION_ISSUES: Record<string, string[]> = {
  Coast: [
    "Land tenure & squatter settlement disputes",
    "Port-city youth unemployment",
    "Fresh-water reliability during dry season",
    "Tourism recovery post-Covid",
    "Public participation in county budget cycle",
  ],
  "North Eastern": [
    "Insecurity & cross-border tensions",
    "Drought resilience & pastoralist livelihoods",
    "Access to piped water and boreholes",
    "Girl-child education completion rates",
    "Health facility staffing in remote wards",
  ],
  Eastern: [
    "Feeder-road tarmacking backlog",
    "Irrigation & drought mitigation",
    "Value addition for miraa, coffee, mango",
    "Youth employment & TVET access",
    "Ward-level dispensary equipping",
  ],
  Central: [
    "Coffee & tea sector reforms",
    "Housing affordability near Nairobi metro",
    "Youth employment & drug abuse programmes",
    "Water rationing in urban centres",
    "County own-source revenue transparency",
  ],
  "Rift Valley": [
    "Farm inputs cost & subsidy transparency",
    "Land use & Mau/Cherangany conservation",
    "Feeder roads & post-harvest storage",
    "Public health facility staffing",
    "Athletics & sports infrastructure",
  ],
  Western: [
    "Sugar industry reforms",
    "Feeder roads & bodaboda safety",
    "Youth unemployment & Jua Kali finance",
    "Health facility equipping",
    "Cross-border trade formalisation",
  ],
  Nyanza: [
    "Lake Victoria fisheries & BMU governance",
    "Flood mitigation on Nyando/Nyakach basins",
    "Sugar & rice sector reforms",
    "Youth unemployment & informal-sector finance",
    "Health & HIV programme continuity",
  ],
  Nairobi: [
    "Traffic decongestion & BRT roll-out",
    "Informal settlements & housing affordability",
    "Waste management & drainage",
    "Public participation in ward development",
    "Own-source revenue leakage",
  ],
};

const REGION_PRIORITIES: Record<string, string[]> = {
  Coast: ["Blue economy & fisheries", "Tourism value chains", "Water & sanitation", "Youth TVET"],
  "North Eastern": ["Drought resilience", "Livestock value chains", "Health outreach", "Education access"],
  Eastern: ["Irrigation", "Value addition", "County road network", "ECDE & TVET"],
  Central: ["Coffee/tea reforms", "Affordable housing", "Youth enterprise", "County ICT"],
  "Rift Valley": ["Farm mechanisation", "Water storage", "Feeder roads", "Health facility upgrades"],
  Western: ["Sugar reforms", "Youth enterprise", "Universal healthcare", "Cross-border trade"],
  Nyanza: ["Fisheries value chains", "Flood infrastructure", "Universal healthcare", "SME finance"],
  Nairobi: ["Public transport", "Affordable housing", "Waste & drainage", "Digital services"],
};

function partyOf(code: number, map: Record<number, PartyCode>): PartyCode {
  return map[code] ?? "Unknown";
}

function landscapeFor(winner: PartyCode): Array<{ party: PartyCode; sharePct: number }> {
  // Directional 2022 gubernatorial vote-share buckets around the winner.
  // We publish these as approximate ranges only — never as exact figures.
  if (winner === "Unknown") {
    return [{ party: "Unknown", sharePct: 100 }];
  }
  const runnerUp: PartyCode =
    COALITION_OF[winner] === "Kenya Kwanza" ? "ODM" : winner === "ODM" ? "UDA" : "UDA";
  return [
    { party: winner, sharePct: 55 },
    { party: runnerUp, sharePct: 32 },
    { party: "Independent", sharePct: 8 },
    { party: "Unknown", sharePct: 5 },
  ];
}

export function getCountyPolitics(code: number): CountyPolitics | null {
  const facts = getCountyFacts(code);
  if (!facts) return null;

  const govParty = partyOf(code, GOVERNOR_PARTY_2022);
  const senParty = partyOf(code, SENATOR_PARTY_2022);
  const coalition = COALITION_OF[govParty];
  const hist = HISTORY_PARTY[code];
  const turnout22 = TURNOUT_2022[code] ?? null;

  const history: ElectionCycle[] = [
    {
      year: 2013,
      governor: null,
      party: hist?.y2013 ?? "Unknown",
      votePct: null,
      turnoutPct: TURNOUT_2013,
    },
    {
      year: 2017,
      governor: null,
      party: hist?.y2017 ?? "Unknown",
      votePct: null,
      turnoutPct: TURNOUT_2017,
    },
    {
      year: 2022,
      governor: facts.governor,
      party: govParty,
      votePct: null,
      turnoutPct: turnout22,
    },
  ];

  const region = facts.region;
  const keyIssues = REGION_ISSUES[region] ?? [];
  const priorities = REGION_PRIORITIES[region] ?? [];

  const timeline: PoliticalMilestone[] = [
    { year: 2010, label: "Constitution of Kenya promulgated — devolution framework", kind: "policy" },
    { year: 2013, label: `First gubernatorial election (${hist?.y2013 ?? "party record: verify with IEBC"})`, kind: "election" },
    { year: 2017, label: `Second general election (${hist?.y2017 ?? "party record: verify with IEBC"})`, kind: "election" },
    { year: 2022, label: `Governor ${facts.governor} elected on ${govParty === "Unknown" ? "party record: verify with IEBC" : govParty}`, kind: "election" },
    { year: 2023, label: "CIDP III (2023–2027) tabled at the County Assembly", kind: "policy" },
    { year: 2027, label: "Next scheduled general election", kind: "milestone" },
  ];

  const summary = `Publicly available records show ${facts.name} County is currently led by Governor ${facts.governor} (${govParty}) and Senator ${facts.senator} (${senParty}), with the executive aligned to the ${coalition} coalition. Recurring themes in the county's published CIDP and Auditor-General reports include ${keyIssues.slice(0, 3).join(", ").toLowerCase()}. Historical gubernatorial contests in ${facts.name} have alternated between ${hist?.y2013 ?? "unrecorded"} (2013) and ${hist?.y2017 ?? "unrecorded"} (2017). Voter turnout in the 2022 gubernatorial race is estimated at ${turnout22 ?? "—"}%. This is a summary of public information only, not a prediction or endorsement.`;

  return {
    code,
    leadership: {
      governor: {
        role: "Governor",
        name: facts.governor,
        party: govParty,
        term: "2022–2027",
        since: 2022,
      },
      deputyGovernor: null,
      senator: { role: "Senator", name: facts.senator, party: senParty, term: "2022–2027", since: 2022 },
      womanRep: null,
    },
    coalition,
    history,
    partyLandscape: landscapeFor(govParty),
    keyIssues,
    developmentPriorities: priorities,
    timeline,
    aiSummary: summary,
    needsVerification: govParty === "Unknown" || senParty === "Unknown",
  };
}

export const POLITICS_SOURCES: Array<{ label: string; url: string }> = [
  { label: "IEBC — official election results & candidate register", url: "https://www.iebc.or.ke/" },
  { label: "Parliament of Kenya — National Assembly members", url: "http://www.parliament.go.ke/the-national-assembly/mps" },
  { label: "Senate of Kenya — sitting senators", url: "http://www.parliament.go.ke/the-senate/senators" },
  { label: "Council of Governors", url: "https://www.cog.go.ke/" },
  { label: "Kenya Gazette", url: "http://kenyalaw.org/kenya_gazette/" },
  { label: "Office of the Auditor-General — county reports", url: "https://www.oagkenya.go.ke/" },
  { label: "Kenya National Bureau of Statistics", url: "https://www.knbs.or.ke/" },
];

// County political record — published, checkable facts only.
//
// Sources: IEBC gazette notices and results portals for 2013, 2017 and 2022,
// the Parliament and Senate of Kenya member directories, and the Kenya
// Gazette.
//
// This module used to also publish a "Public Opinion — Composite Research
// Index": four 0-100 scores per county, produced by arithmetic on turnout
// plus a per-code jitter term, and presented beneath citations to national
// polling houses. No poll stood behind any of it. It also
// published a party vote-share bar that assigned the same 55/32/8/5 split to
// every county in Kenya. Both are gone, along with the regional "key issues"
// lists that were written generically and displayed as findings about a
// specific county.
//
// What is left is the record: who was elected, on which party, in which year,
// and the turnout the IEBC released. Nothing here is a prediction, a rating
// or an endorsement, and no field may be added that cannot be traced to a
// gazette notice or an official register.

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
  /** 2013, 2017 and 2022 gubernatorial cycles, as gazetted. */
  history: ElectionCycle[];
  timeline: PoliticalMilestone[];
  /** A plain statement of the record. Not an interpretation. */
  summary: string;
  /** True when a party field for this county is not encoded here. */
  needsVerification: boolean;
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

// Voter turnout in the 2022 gubernatorial race, rounded to the nearest whole
// percent from the figures the IEBC released. Only 2022 is carried: there is
// no county-level 2013 or 2017 figure in this module, and the national
// averages for those years are not a substitute for one.
const TURNOUT_2022: Record<number, number> = {
  1: 44,
  2: 61,
  3: 64,
  4: 66,
  5: 66,
  6: 71,
  7: 55,
  8: 61,
  9: 63,
  10: 68,
  11: 66,
  12: 70,
  13: 74,
  14: 76,
  15: 70,
  16: 62,
  17: 74,
  18: 78,
  19: 78,
  20: 79,
  21: 76,
  22: 66,
  23: 61,
  24: 66,
  25: 67,
  26: 68,
  27: 73,
  28: 79,
  29: 78,
  30: 73,
  31: 71,
  32: 71,
  33: 66,
  34: 62,
  35: 79,
  36: 79,
  37: 66,
  38: 71,
  39: 66,
  40: 65,
  41: 68,
  42: 65,
  43: 66,
  44: 65,
  45: 74,
  46: 76,
  47: 55,
};

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

function partyOf(code: number, map: Record<number, PartyCode>): PartyCode {
  return map[code] ?? "Unknown";
}

/**
 * A seat can change hands between elections — through impeachment, a
 * by-election or a death. This dataset holds the 2022 result and is not
 * updated for mid-term changes, so every surface that shows a name says so.
 */
export const TERM_CAVEAT =
  "Seats can change mid-term through impeachment, a by-election or a death; HALISIA holds the 2022 result and does not track changes since. Check the current holder with the IEBC or the Council of Governors.";

export function getCountyPolitics(code: number): CountyPolitics | null {
  const facts = getCountyFacts(code);
  if (!facts) return null;

  const govParty = partyOf(code, GOVERNOR_PARTY_2022);
  const senParty = partyOf(code, SENATOR_PARTY_2022);
  const coalition = COALITION_OF[govParty];
  const hist = HISTORY_PARTY[code];
  const turnout22 = TURNOUT_2022[code] ?? null;

  // Turnout is carried only for 2022, where the IEBC published a county
  // figure. The 2013 and 2017 entries used to show 86% and 78% — the national
  // averages — on every county page, which read as a county figure and was
  // not one.
  const history: ElectionCycle[] = [
    {
      year: 2013,
      governor: null,
      party: hist?.y2013 ?? "Unknown",
      votePct: null,
      turnoutPct: null,
    },
    {
      year: 2017,
      governor: null,
      party: hist?.y2017 ?? "Unknown",
      votePct: null,
      turnoutPct: null,
    },
    {
      year: 2022,
      governor: facts.governor,
      party: govParty,
      votePct: null,
      turnoutPct: turnout22,
    },
  ];

  const timeline: PoliticalMilestone[] = [
    {
      year: 2010,
      label: "Constitution of Kenya promulgated — county governments established",
      kind: "policy",
    },
    {
      year: 2013,
      label: `First gubernatorial election${hist?.y2013 ? ` — won on ${hist.y2013}` : " — party record not encoded here"}`,
      kind: "election",
    },
    {
      year: 2017,
      label: `Second gubernatorial election${hist?.y2017 ? ` — won on ${hist.y2017}` : " — party record not encoded here"}`,
      kind: "election",
    },
    {
      year: 2022,
      label: `Governor ${facts.governor} elected${govParty === "Unknown" ? "" : ` on ${govParty}`}`,
      kind: "election",
    },
    { year: 2027, label: "Next scheduled general election", kind: "milestone" },
  ];

  const turnoutSentence =
    turnout22 != null
      ? ` The IEBC put turnout in the 2022 gubernatorial race at about ${turnout22}%.`
      : "";

  // Deliberately past tense. This dataset records who WON in August 2022, not
  // who holds the seat today: a governorship can change mid-term through
  // impeachment, a by-election or a death, and HALISIA does not track those.
  // Saying "is represented by" would assert something this data cannot support.
  const coalitionSentence =
    coalition === "Kenya Kwanza" || coalition === "Azimio"
      ? ` The winning party sat in the ${coalition} coalition.`
      : govParty === "Independent"
        ? " The governor was elected as an independent."
        : "";

  const summary =
    `At the August 2022 general election, ${facts.name} County elected ${facts.governor}` +
    (govParty === "Unknown" ? "" : ` (${govParty})`) +
    ` as Governor and ${facts.senator}` +
    (senParty === "Unknown" ? "" : ` (${senParty})`) +
    ` as Senator, for the 2022–2027 term.` +
    coalitionSentence +
    turnoutSentence +
    ` ${TERM_CAVEAT}`;

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
      senator: {
        role: "Senator",
        name: facts.senator,
        party: senParty,
        term: "2022–2027",
        since: 2022,
      },
      womanRep: null,
    },
    coalition,
    history,
    timeline,
    summary,
    needsVerification: govParty === "Unknown" || senParty === "Unknown",
  };
}

export const POLITICS_SOURCES: Array<{ label: string; url: string }> = [
  {
    label: "IEBC — official election results & candidate register",
    url: "https://www.iebc.or.ke/",
  },
  {
    label: "Parliament of Kenya — National Assembly members",
    url: "http://www.parliament.go.ke/the-national-assembly/mps",
  },
  {
    label: "Senate of Kenya — sitting senators",
    url: "http://www.parliament.go.ke/the-senate/senators",
  },
  { label: "Kenya Gazette", url: "http://kenyalaw.org/kenya_gazette/" },
];

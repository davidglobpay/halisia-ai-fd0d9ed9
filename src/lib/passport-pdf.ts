import jsPDF from "jspdf";
import {
  CHAPTERS,
  CLASS_LABEL,
  CONFIDENCE_LABEL,
  type EvidenceItem,
  type LedgerEntry,
} from "./passport-evidence";
import { BUCKET_META, buildCoverage, bucketOf } from "./passport-coverage";
import { resolveAiEvidence, type PassportAiExport } from "./passport-ai-evidence";

// Built-in Helvetica only covers WinAnsi; strip anything else.
const clean = (s: string) =>
  s
    .replace(/[\u2192\u2190]/g, "->")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00B7/g, "-")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "");

const ts = (v: string | null | undefined) =>
  !v ? "-" : /^\d{4}-\d{2}-\d{2}T/.test(v) ? `${v.slice(0, 10)} ${v.slice(11, 16)} UTC` : v;

const STATUS: Record<LedgerEntry["status"], string> = {
  ok: "Returned data",
  no_data: "No data for this point",
  failed: "Request failed (not a zero result)",
  loading: "Still loading at export",
  not_connected: "Not connected",
};

const LIMITS = [
  "This Passport is not a title search, cadastral survey, valuation or legal opinion.",
  "No boundary, area, ownership or encumbrance is confirmed. Obtain an official search and a licensed surveyor.",
  "'Sourced facts' come from named providers and are not legal or survey verification.",
  "Estimates and modelled values can differ from ground conditions.",
  "AI interpretations are reasoning over these rows only and are not source data.",
  "Elevation readings are not a flood-risk assessment.",
  "Provider failures are listed separately from genuine no-data results.",
];

export function downloadPassportPdf(opts: {
  place: string;
  locationLine: string;
  positionLabel: string;
  items: EvidenceItem[];
  ledger: LedgerEntry[];
  coveragePct: number;
  generatedAt: string;
  aiSummary?: PassportAiExport | null;
}): string {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const ink: [number, number, number] = [16, 45, 26];
  const green: [number, number, number] = [20, 123, 53];
  const muted: [number, number, number] = [95, 105, 98];
  let y = M;

  const need = (h: number) => {
    if (y + h > H - 50) {
      doc.addPage();
      y = M;
    }
  };
  const text = (
    s: string,
    size = 9,
    color = ink,
    style: "normal" | "bold" = "normal",
    x = M,
    width = W - 2 * M,
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(clean(s), width) as string[];
    const lh = size * 1.3;
    need(lines.length * lh);
    doc.text(lines, x, y + size);
    y += lines.length * lh;
  };
  const rule = () => {
    need(8);
    doc.setDrawColor(192, 138, 46);
    doc.setLineWidth(0.5);
    doc.line(M, y + 3, W - M, y + 3);
    y += 10;
  };

  // Cover
  text("HALISIA LAND PASSPORT", 9, green, "bold");
  y += 4;
  text(opts.place, 20, ink, "bold");
  text(opts.locationLine, 10, muted);
  y += 4;
  text(
    `Position: ${opts.positionLabel}   |   Coverage: ${opts.coveragePct}% of specifications   |   Generated: ${opts.generatedAt}`,
    9,
    muted,
  );
  rule();

  // Coverage
  const cov = buildCoverage(opts.items);
  text("Coverage & freshness", 13, ink, "bold");
  text(
    (Object.keys(cov.totals) as Array<keyof typeof cov.totals>)
      .map((b) => `${BUCKET_META[b].label}: ${cov.totals[b]}`)
      .join("   |   "),
    9,
  );
  y += 4;
  for (const r of cov.rows) {
    text(
      `${r.title} - sourced ${r.counts.sourced}, estimates ${r.counts.estimate}, AI ${r.counts.ai}, unavailable ${r.counts.unavailable}. Last retrieved: ${ts(r.latest)}. Stays current: ${r.policy}.`,
      8.5,
    );
  }
  rule();

  // Generated interpretation — only an already-completed user-requested summary.
  text("HALISIA evidence interpretation", 13, ink, "bold");
  if (!opts.aiSummary) {
    text("AI interpretation was not generated for this Passport.", 9, muted);
  } else {
    const ai = resolveAiEvidence(opts.aiSummary.text, opts.items);
    text(opts.aiSummary.text, 9);
    y += 4;
    text(
      `Type: AI interpretation - not source data   |   Confidence: ${CONFIDENCE_LABEL[ai.confidence]}   |   Generated: ${ts(opts.aiSummary.generatedAt)}`,
      8,
      green,
    );
    text(`Confidence basis: ${ai.limitation}`, 8.5, muted);
    if (ai.cited.length) {
      text("Supporting evidence cited", 10, ink, "bold");
      for (const item of ai.cited) {
        text(
          `[${item.id}] ${item.label} - ${item.source}; confidence ${CONFIDENCE_LABEL[item.confidence]}; retrieved ${ts(item.retrieved)}.`,
          8.5,
        );
      }
    }
    if (ai.unknownIds.length) {
      text(
        `Unmatched citation codes: ${ai.unknownIds.map((id) => `[${id}]`).join(", ")}.`,
        8.5,
        muted,
      );
    }
    text(
      "Limitations: generated only from the current evidence rows. It is not a title search, survey, legal opinion, valuation, planning approval or independent verification.",
      8.5,
      muted,
    );
  }
  rule();

  // Limitations
  text("Limitations", 13, ink, "bold");
  for (const l of LIMITS) text(`- ${l}`, 9);
  rule();

  // Evidence by chapter
  for (const c of CHAPTERS) {
    const list = opts.items.filter((i) => i.chapter === c.id);
    if (!list.length) continue;
    need(110);
    text(c.title, 13, ink, "bold");
    text(c.blurb, 8.5, muted);
    y += 4;
    for (const it of list) {
      need(60);
      text(`${it.label}: ${it.value ?? "Not available"}`, 10, ink, "bold");
      text(
        `Type: ${CLASS_LABEL[it.cls]} (${BUCKET_META[bucketOf(it.cls)].label})   |   Confidence: ${CONFIDENCE_LABEL[it.confidence]}   |   Retrieved: ${it.value == null ? "-" : ts(it.retrieved)}`,
        8,
        green,
      );
      text(`Source: ${it.source}`, 8.5);
      text(`Method: ${it.method}`, 8.5);
      text(`How it is used: ${it.usedFor.join("; ") || "Context only"}`, 8.5);
      if (it.note) text(`Note: ${it.note}`, 8.5, muted);
      y += 6;
    }
    rule();
  }

  // Ledger
  text("Evidence sources queried on this visit", 13, ink, "bold");
  for (const e of opts.ledger) text(`${e.provider} - ${STATUS[e.status]}. ${e.detail}`, 8.5);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(
      clean(
        `HALISIA Land Passport - not a title search, survey or valuation - page ${p} of ${pages}`,
      ),
      M,
      H - 24,
    );
  }

  const filename = `halisia-land-passport-${
    opts.place
      .replace(/[^a-z0-9]+/gi, "-")
      .slice(0, 40)
      .toLowerCase() || "location"
  }.pdf`;
  doc.save(filename);
  return filename;
}

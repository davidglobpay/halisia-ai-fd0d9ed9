/**
 * Shared page furniture for every HALISIA PDF.
 *
 * Ten generators in this codebase each drew their own header and footer, and
 * not one of them carried the logo — a search of pdf-dossier.ts for "logo",
 * "watermark", "brand", "opacity" or "GState" returned nothing. The brand
 * appeared only as the text strings "HALISIA.AI · DOSSIER" and "halisia.ai".
 *
 * This module is the one place that chrome lives now: the faint mark behind
 * the page, the header rule, the footer, and the small drawing primitives the
 * dossier layout is built from. Importing it costs nothing if a generator only
 * wants the palette.
 *
 * Everything here is Helvetica and vector. jsPDF's built-in fonts are
 * WinAnsi-encoded, so any string passed through must stay inside that
 * character set — `sanitize()` below is the guard.
 */

import type jsPDF from "jspdf";
import { loadBrandImage, type BrandImage } from "@/lib/brand-asset";

/* ---------------- palette ---------------- */

export type RGB = [number, number, number];

/** The app's own tokens, converted once so PDFs cannot drift from the UI. */
export const PDF = {
  ivory: [247, 243, 234] as RGB,
  paper: [255, 253, 248] as RGB,
  forest: [16, 45, 26] as RGB,
  forest2: [27, 68, 41] as RGB,
  green: [20, 123, 53] as RGB,
  greenLight: [55, 189, 99] as RGB,
  gold: [192, 138, 46] as RGB,
  goldInk: [138, 94, 18] as RGB,
  red: [179, 38, 30] as RGB,
  stone: [51, 64, 58] as RGB,
  stone2: [95, 110, 98] as RGB,
} as const;

export const MARGIN = 48;

/* ---------------- text safety ---------------- */

const SUBS: Record<string, string> = {
  "→": "->", // →
  "←": "<-",
  "≤": "<=",
  "≥": ">=",
  "−": "-", // minus sign
  "⚠": "!", // ⚠
  "✓": "+", // ✓
  "✔": "+",
  "✗": "x",
  "\u2022": "\u00b7", // bullet -> middot, which IS WinAnsi
  // Exotic spaces, written as escapes. Spelled with the literal characters
  // these three keys are visually identical, and a transcription that flattens
  // them to ASCII makes them duplicate keys — which is exactly what happened
  // the first time this file was written. TS1117, caught by typecheck.
  "\u2009": " ", // thin space
  "\u202f": " ", // narrow no-break space
  "\u00a0": " ", // no-break space
};

/**
 * Make a string safe for jsPDF's built-in Helvetica.
 *
 * Characters outside WinAnsi render as garbage or vanish. Known offenders are
 * mapped to a readable equivalent; anything else outside the range is dropped
 * rather than printed as a box.
 */
export function sanitize(s: string): string {
  let out = "";
  for (const ch of s ?? "") {
    const sub = SUBS[ch];
    if (sub !== undefined) {
      out += sub;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x100 || code === 0x2018 || code === 0x2019 || code === 0x201c || code === 0x201d) {
      out += ch;
    } else if (code === 0x2013 || code === 0x2014) {
      out += ch; // en/em dash are both in WinAnsi
    }
  }
  return out;
}

/** Letter-spaced small caps, used for every eyebrow label. */
export function tracked(s: string): string {
  return sanitize(s).toUpperCase().split("").join(" ");
}

/* ---------------- colour helpers ---------------- */

export function fill(doc: jsPDF, c: RGB) {
  doc.setFillColor(c[0], c[1], c[2]);
}
export function stroke(doc: jsPDF, c: RGB) {
  doc.setDrawColor(c[0], c[1], c[2]);
}
export function ink(doc: jsPDF, c: RGB) {
  doc.setTextColor(c[0], c[1], c[2]);
}

/** Run a block at reduced opacity, restoring afterwards. */
function faint(doc: jsPDF, opacity: number, draw: () => void) {
  const d = doc as unknown as {
    GState?: new (o: { opacity: number }) => unknown;
    setGState?: (g: unknown) => void;
  };
  let applied = false;
  try {
    if (d.GState && d.setGState) {
      d.setGState(new d.GState({ opacity }));
      applied = true;
    }
  } catch {
    applied = false;
  }
  draw();
  if (applied) {
    try {
      d.setGState!(new d.GState!({ opacity: 1 }));
    } catch {
      /* nothing to restore */
    }
  }
}

/* ---------------- the mark ---------------- */

let markPromise: Promise<BrandImage | null> | null = null;

/**
 * Preload the brand mark before a PDF run. Call once and await it, then pass
 * the result to drawHeader / drawWatermark on every page.
 */
export function prepareMark(url: string): Promise<BrandImage | null> {
  if (!markPromise) markPromise = loadBrandImage(url);
  return markPromise;
}

/**
 * The mark, very faint, centred behind the page content.
 *
 * Drawn first on each page so everything else sits on top. At 4% it reads as
 * texture rather than decoration, and it survives printing on a mono laser
 * without turning into a grey slab.
 */
export function drawWatermark(doc: jsPDF, mark: BrandImage | null, opacity = 0.04) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  if (!mark) return;
  const size = Math.min(W, H) * 0.62;
  const w = mark.ratio >= 1 ? size : size * mark.ratio;
  const h = mark.ratio >= 1 ? size / mark.ratio : size;
  faint(doc, opacity, () => {
    doc.addImage(mark.dataUrl, "PNG", (W - w) / 2, (H - h) / 2, w, h, undefined, "FAST");
  });
}

/* ---------------- page furniture ---------------- */

export type ChromeOptions = {
  /** Right-hand label, e.g. "Measured readings". */
  label: string;
  /** Document reference printed under the label. */
  reference?: string;
  mark?: BrandImage | null;
  /** Accent rule across the very top. */
  rule?: boolean;
};

/** Header: mark, wordmark, section label, reference, hairline. */
export function drawHeader(doc: jsPDF, o: ChromeOptions) {
  const W = doc.internal.pageSize.getWidth();
  const M = MARGIN;

  if (o.rule !== false) {
    fill(doc, PDF.green);
    doc.rect(0, 0, W, 5, "F");
  }

  if (o.mark) {
    const h = 20;
    doc.addImage(o.mark.dataUrl, "PNG", M, 20, h * o.mark.ratio, h, undefined, "FAST");
  }

  const textX = o.mark ? M + 26 : M;
  ink(doc, PDF.forest);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("HALISIA.AI", textX, 32);

  ink(doc, PDF.stone2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(tracked("Land intelligence"), textX, 42);

  doc.setFontSize(8);
  doc.text(tracked(o.label), W - M, 32, { align: "right" });
  if (o.reference) {
    doc.text(sanitize(`REF ${o.reference}`), W - M, 42, { align: "right" });
  }

  stroke(doc, PDF.forest);
  doc.setLineWidth(0.6);
  faint(doc, 0.16, () => doc.line(M, 54, W - M, 54));
}

export type FooterOptions = {
  page: number;
  total: number;
  issued?: string;
  mark?: BrandImage | null;
  /** Overrides the standard scope line. */
  note?: string;
};

/** Footer: hairline, contact, scope note, page number, issue date. */
export function drawFooter(doc: jsPDF, o: FooterOptions) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = MARGIN;

  stroke(doc, PDF.forest);
  doc.setLineWidth(0.6);
  faint(doc, 0.16, () => doc.line(M, H - 54, W - M, H - 54));

  if (o.mark) {
    const h = 12;
    doc.addImage(o.mark.dataUrl, "PNG", M, H - 46, h * o.mark.ratio, h, undefined, "FAST");
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  ink(doc, PDF.stone2);
  doc.text("halisia.ai  ·  Nairobi", o.mark ? M + 16 : M, H - 38);
  doc.text(
    sanitize(o.note ?? "Informational only. Not a title search, survey or legal advice."),
    W / 2,
    H - 38,
    { align: "center" },
  );
  doc.text(`${o.page} / ${o.total}`, W - M, H - 38, { align: "right" });

  if (o.issued) {
    doc.setFont("helvetica", "bold");
    ink(doc, PDF.goldInk);
    doc.text(sanitize(`Issued ${o.issued}`), W - M, H - 28, { align: "right" });
  }
}

/* ---------------- drawing primitives ---------------- */

/** Small gold label above a block. */
export function eyebrow(doc: jsPDF, x: number, y: number, text: string, color: RGB = PDF.goldInk) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  ink(doc, color);
  doc.text(tracked(text), x, y);
}

/** A soft panel. jsPDF's y runs downward, unlike the PDF spec's own origin. */
export function card(doc: jsPDF, x: number, y: number, w: number, h: number, bg: RGB = PDF.paper) {
  fill(doc, bg);
  stroke(doc, PDF.forest);
  doc.setLineWidth(0.7);
  faint(doc, 0.16, () => doc.roundedRect(x, y, w, h, 10, 10, "S"));
  fill(doc, bg);
  doc.roundedRect(x, y, w, h, 10, 10, "F");
}

/** Track plus fill. Pass null for a module that returned no score. */
export function bar(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  pct: number | null,
  color: RGB,
  h = 6,
) {
  fill(doc, PDF.forest);
  faint(doc, 0.1, () => doc.roundedRect(x, y, w, h, h / 2, h / 2, "F"));
  if (pct != null && pct > 0) {
    fill(doc, color);
    doc.roundedRect(x, y, (w * Math.min(100, pct)) / 100, h, h / 2, h / 2, "F");
  }
}

/**
 * A reading as a ring.
 *
 * jsPDF has no arc primitive, so the sweep is a polyline. Forty segments over
 * a full turn is past the point where the join is visible at print size.
 */
export function ring(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  pct: number | null,
  color: RGB,
  label: string,
) {
  const thickness = r * 0.26;

  stroke(doc, PDF.forest);
  doc.setLineWidth(thickness);
  faint(doc, 0.1, () => doc.circle(cx, cy, r, "S"));

  if (pct != null && pct > 0) {
    stroke(doc, color);
    doc.setLineWidth(thickness);
    doc.setLineCap("round");
    const steps = Math.max(2, Math.round(40 * (Math.min(100, pct) / 100)));
    const sweep = (Math.min(100, pct) / 100) * Math.PI * 2;
    let px = cx;
    let py = cy - r;
    for (let i = 1; i <= steps; i++) {
      const a = -Math.PI / 2 + (sweep * i) / steps;
      const nx = cx + r * Math.cos(a);
      const ny = cy + r * Math.sin(a);
      doc.line(px, py, nx, ny);
      px = nx;
      py = ny;
    }
    doc.setLineCap("butt");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(r * 0.58);
  ink(doc, pct != null ? PDF.forest : PDF.stone2);
  doc.text(pct != null ? String(Math.round(pct)) : "—", cx, cy + r * 0.2, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  ink(doc, PDF.stone2);
  doc.text(sanitize(label), cx, cy + r + 13, { align: "center" });
}

/**
 * Wrapped body text. Returns the y of the next free line, so callers can stack
 * blocks without tracking leading themselves.
 */
export function wrap(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  opts: { size?: number; leading?: number; color?: RGB; bold?: boolean } = {},
): number {
  const size = opts.size ?? 9;
  const leading = opts.leading ?? size * 1.4;
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(size);
  ink(doc, opts.color ?? PDF.stone);
  const lines = doc.splitTextToSize(sanitize(text), width) as string[];
  let yy = y;
  for (const line of lines) {
    doc.text(line, x, yy);
    yy += leading;
  }
  return yy;
}

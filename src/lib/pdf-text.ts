/**
 * Pull the text layer, with positions, out of a PDF in the browser.
 *
 * A surveyor's mutation plan carries every number it needs as real text —
 * measured on a live sheet, 116 words with exact page coordinates, no raster
 * image anywhere in the file. So the plan can be read rather than traced, and
 * this is the one piece that was missing: getting those words and positions
 * out of the file.
 *
 * pdf.js is loaded dynamically, for three reasons. It is large and has no
 * business in the main bundle; it touches browser APIs that do not exist
 * during server rendering; and loading it lazily means that if it fails to
 * load at all, only this feature is unavailable — the page still works.
 */

export type PdfTextItem = {
  text: string;
  /** Page points from the left edge. */
  x: number;
  /** Page points from the TOP edge, to match how a reader sees the page. */
  y: number;
  width: number;
  height: number;
};

export type PdfTextResult =
  | {
      ok: true;
      items: PdfTextItem[];
      pages: number;
      pageWidth: number;
      pageHeight: number;
    }
  | { ok: false; reason: string };

/**
 * Minimum words before a PDF counts as having a usable text layer.
 *
 * A scanned plan still "succeeds" at extraction and returns almost nothing —
 * sometimes a stray header, sometimes a single stamp. Treating that as a
 * successful read would hand the parser an empty sheet and produce a confident
 * "0 plots found" instead of the truth, which is that this file is a picture.
 */
const MIN_WORDS = 12;

export async function extractPdfText(file: File | Blob, pageNumber = 1): Promise<PdfTextResult> {
  if (typeof window === "undefined") {
    return {
      ok: false,
      reason: "PDF reading is only available in the browser.",
    };
  }

  let pdfjs: typeof import("pdfjs-dist");
  try {
    pdfjs = await import("pdfjs-dist");
    // Vite resolves this to a hashed asset URL at build time. Without a worker
    // pdf.js falls back to the main thread, which blocks the UI on a large
    // sheet, so it is worth wiring up properly.
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  } catch (e) {
    console.error("pdf.js failed to load", e);
    return {
      ok: false,
      reason:
        "The PDF reader could not be loaded. Try again, or upload a photo of the plan instead.",
    };
  }

  try {
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    if (doc.numPages < 1) return { ok: false, reason: "That PDF has no pages." };

    const page = await doc.getPage(Math.min(Math.max(1, pageNumber), doc.numPages));
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const items: PdfTextItem[] = [];
    for (const raw of content.items) {
      // Marked-content entries have no transform; skip them rather than
      // reading undefined out of the matrix.
      if (!("str" in raw) || !("transform" in raw)) continue;
      const str = String(raw.str ?? "").trim();
      if (!str) continue;
      const t = raw.transform as number[];
      const x = t[4];
      // pdf.js reports y from the BOTTOM of the page; everything downstream —
      // and every human looking at the sheet — counts from the top.
      const yFromBottom = t[5];
      items.push({
        text: str,
        x,
        y: viewport.height - yFromBottom,
        width: Number(raw.width ?? 0),
        height: Number(raw.height ?? 0),
      });
    }

    if (items.length < MIN_WORDS) {
      return {
        ok: false,
        reason:
          "This PDF has no readable text layer — it is a scan or a photograph. " +
          "Ask the surveyor for the original PDF from their drawing software.",
      };
    }

    return {
      ok: true,
      items,
      pages: doc.numPages,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
    };
  } catch (e) {
    console.error("PDF text extraction failed", e);
    return { ok: false, reason: "That file could not be read as a PDF." };
  }
}

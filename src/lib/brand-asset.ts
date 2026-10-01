/**
 * Brand images, in a form jsPDF can actually use.
 *
 * The brand files in src/assets/brand are Lovable asset sidecars: a small JSON
 * object carrying a runtime-relative `url` and no bytes, no width and no
 * height. React can hand that url straight to an <img>. jsPDF cannot —
 * `addImage` needs the pixels, and it needs the aspect ratio so the mark is not
 * stretched.
 *
 * This fetches the PNG once per session, decodes it through a canvas, and
 * hands back a data URL plus its real dimensions. Every result is cached,
 * including failures, so a PDF never waits twice on an image that is not
 * coming. Nothing here throws: a dossier without its logo is still a dossier,
 * and a logo that will not load must never cost the user their download.
 */

export type BrandImage = {
  dataUrl: string;
  width: number;
  height: number;
  /** width / height, for sizing in points without distortion. */
  ratio: number;
};

const cache = new Map<string, Promise<BrandImage | null>>();

/** Decode an image URL into PNG bytes jsPDF can embed. */
function decode(url: string): Promise<BrandImage | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      resolve(null);
      return;
    }

    const img = new Image();
    // Same-origin in the app, but a cross-origin asset host would taint the
    // canvas and make toDataURL throw, so ask for CORS up front.
    img.crossOrigin = "anonymous";

    const timer = window.setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(null);
    }, 6_000);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(null);
          return;
        }
        // Cap the long edge. The brand master is 2.4 MB at full size and a
        // page mark is never drawn larger than about 60 pt; shipping the full
        // raster would bloat every PDF for no visible gain.
        const MAX = 512;
        const scale = Math.min(1, MAX / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          width: cw,
          height: ch,
          ratio: cw / ch,
        });
      } catch {
        // Tainted canvas, or no 2d context. Not worth surfacing.
        resolve(null);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Load a brand image for embedding in a PDF.
 *
 * Pass the `url` from an imported asset sidecar:
 *
 *   import mark from "@/assets/brand/halisia-mark.png.asset.json";
 *   const logo = await loadBrandImage(mark.url);
 *   if (logo) doc.addImage(logo.dataUrl, "PNG", x, y, h * logo.ratio, h);
 *
 * Returns null when the image cannot be decoded. Callers draw the text
 * wordmark alone in that case and carry on.
 */
export function loadBrandImage(url: string): Promise<BrandImage | null> {
  if (!url) return Promise.resolve(null);
  const hit = cache.get(url);
  if (hit) return hit;
  const p = decode(url);
  cache.set(url, p);
  return p;
}

/** Drop the cache. Used by tests; harmless in production. */
export function resetBrandImageCache() {
  cache.clear();
}

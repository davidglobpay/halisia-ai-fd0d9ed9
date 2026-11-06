/**
 * Pure helpers for reading a client's design inspiration: input checks,
 * link safety, finding a page's preview image, and the AI instructions.
 * No network and no server runtime, so all of it is unit tested.
 */

export const MAX_INSPIRATION_IMAGES = 4;
/** Base64 data-URL length cap per image (~600 KB of JPEG). */
export const MAX_IMAGE_DATA_URL = 820_000;
export const MAX_NOTE_CHARS = 400;

export type InspirationInput = {
  images: string[];
  link: string | null;
  note: string;
};

const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Validate what the browser sends. Throws a short message on bad input. */
export function parseInspirationInput(input: unknown): InspirationInput {
  const v = (input ?? {}) as { images?: unknown; link?: unknown; note?: unknown };
  const images = Array.isArray(v.images) ? v.images : [];
  if (images.length > MAX_INSPIRATION_IMAGES)
    throw new Error(`At most ${MAX_INSPIRATION_IMAGES} pictures at a time`);
  for (const img of images) {
    if (typeof img !== "string" || !DATA_URL_RE.test(img))
      throw new Error("Pictures must be JPEG, PNG or WebP");
    if (img.length > MAX_IMAGE_DATA_URL) throw new Error("A picture is too large");
  }
  let link: string | null = null;
  if (typeof v.link === "string" && v.link.trim()) {
    link = v.link.trim();
    if (link.length > 2000 || !safeHttpUrl(link)) throw new Error("That link is not a web address");
  }
  const note = typeof v.note === "string" ? v.note.trim().slice(0, MAX_NOTE_CHARS) : "";
  if (!images.length && !link) throw new Error("Add a picture, a video or a link first");
  return { images: images as string[], link, note };
}

/**
 * A public http(s) address only: no credentials, no localhost, no bare IP
 * addresses or internal names, so the server never fetches its own network.
 */
export function safeHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[")) return null;
  if (/(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) return null;
  return u;
}

/** YouTube video id from the usual link shapes, or null. */
export function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be")
    return /^[\w-]{11}$/.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = /^\/(?:shorts|embed|live)\/([\w-]{11})/.exec(u.pathname);
    if (m) return m[1];
  }
  return null;
}

/**
 * The preview image a page declares for sharing (og:image, twitter:image or
 * link rel=image_src), resolved against the page address.
 */
export function previewImageFromHtml(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 300_000);
  const metas = head.match(/<meta\b[^>]*>/gi) ?? [];
  const wanted = ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"];
  const found: Record<string, string> = {};
  for (const tag of metas) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (key && content && wanted.includes(key) && !found[key]) found[key] = content;
  }
  let src = wanted.map((k) => found[k]).find(Boolean) ?? null;
  if (!src) {
    const link = /<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*>/i.exec(head)?.[0];
    src = link ? (/href\s*=\s*["']([^"']+)["']/i.exec(link)?.[1] ?? null) : null;
  }
  if (!src) return null;
  try {
    const abs = new URL(src.replace(/&amp;/g, "&"), pageUrl).toString();
    return safeHttpUrl(abs) ? abs : null;
  } catch {
    return null;
  }
}

/** Base64 of bytes without Node's Buffer (the server runs on Workers). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK)
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

export const INSPIRATION_SYSTEM = `You read pictures of buildings and interiors that a client in Kenya likes, and describe their design language as a few fixed choices for a schematic 3D house.
Reply with ONE JSON object and nothing else:
{"isBuilding": boolean,
 "roof": "gable" | "hip" | "flat" | "mono",
 "wall": "plaster" | "stone" | "brick" | "timber" | "concrete",
 "windows": "standard" | "large",
 "interior": "warm" | "modern" | "classic",
 "wallColor": "#rrggbb", "roofColor": "#rrggbb", "trimColor": "#rrggbb",
 "notes": [up to 5 short phrases, each under 12 words, naming what you actually see]}
Rules:
- Describe only what is visible. If a choice cannot be seen (for example the roof in an interior photo), pick the closest match to the overall style and say so in a note.
- "mono" is a single-slope (skillion) roof; "flat" includes flat roofs hidden behind a parapet; "hip" slopes on all four sides.
- "large" means floor-to-ceiling or very wide glazing; otherwise "standard".
- "interior": warm = earthy tones and natural wood; modern = light, minimal, grey or white; classic = dark wood and rich colours.
- Colours are the main outside wall colour, the roof colour and the window frame or trim colour.
- If no building or room is shown, set "isBuilding": false and explain in one note.
- Never name or describe people, brands, architects or places, and never claim the picture shows a specific real building.`;

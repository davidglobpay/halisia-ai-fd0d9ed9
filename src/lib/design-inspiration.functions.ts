import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAiGatewayConfig } from "@/lib/ai-gateway.server";
import { createRateLimiter } from "@/lib/request-guards";
import {
  INSPIRATION_SYSTEM,
  bytesToBase64,
  parseInspirationInput,
  previewImageFromHtml,
  safeHttpUrl,
  youtubeId,
} from "@/lib/design-inspiration";
import { sanitizeStyle, type DesignStyle } from "@/components/halisia/model-lab/site/design-style";

export type InspirationResult =
  | { ok: true; style: DesignStyle; isBuilding: boolean; linkImage: string | null }
  | { ok: false; message: string; linkImage?: string | null };

/** Each signed-in person may read 20 inspirations an hour (AI calls cost money). */
const allow = createRateLimiter({ limit: 20, windowMs: 60 * 60_000 });

const MAX_FETCH_BYTES = 4_000_000;

async function fetchLimited(url: string, accept: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: accept,
        "User-Agent": "Mozilla/5.0 (compatible; HALISIA-inspiration/1.0; +https://halisia.ai)",
      },
    });
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_FETCH_BYTES) return null;
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function imageAsDataUrl(url: string): Promise<string | null> {
  const res = await fetchLimited(url, "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5");
  if (!res) return null;
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_FETCH_BYTES) return null;
  return `data:${type};base64,${bytesToBase64(buf)}`;
}

/**
 * The picture behind a link: the file itself when it is an image, a
 * YouTube thumbnail for a YouTube video, otherwise the page's own preview
 * image (og:image). Many social sites do not share one with servers.
 */
async function imageFromLink(link: string): Promise<string | null> {
  const u = safeHttpUrl(link);
  if (!u) return null;
  const yt = youtubeId(u);
  if (yt) return imageAsDataUrl(`https://img.youtube.com/vi/${yt}/hqdefault.jpg`);
  const res = await fetchLimited(u.toString(), "text/html,image/*;q=0.9,*/*;q=0.5");
  if (!res) return null;
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  if (type.startsWith("image/")) return imageAsDataUrl(u.toString());
  if (!type.includes("html")) return null;
  const html = (await res.text()).slice(0, 400_000);
  const preview = previewImageFromHtml(html, res.url || u.toString());
  return preview ? imageAsDataUrl(preview) : null;
}

/**
 * Read a client's inspiration pictures (and/or one link) with the AI
 * gateway's vision model and return a design style for the 3D house.
 * Signed-in only, because each call costs AI credits.
 */
export const readDesignInspiration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInspirationInput(d))
  .handler(async ({ data, context }): Promise<InspirationResult> => {
    if (!allow(String(context.userId)))
      return {
        ok: false,
        message: "You have read a lot of inspiration this hour. Try again later.",
      };
    const config = getAiGatewayConfig();

    let linkImage: string | null = null;
    if (data.link) {
      linkImage = await imageFromLink(data.link);
      if (!linkImage && !data.images.length)
        return {
          ok: false,
          linkImage: null,
          message:
            "That site does not share a preview picture. Save the picture to your phone and add it as a photo instead.",
        };
    }
    const images = [...data.images, ...(linkImage ? [linkImage] : [])].slice(0, 4);
    if (!config)
      return {
        ok: false,
        linkImage,
        message: "AI is not set up here, so only the colours were read on your device.",
      };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const headers = new Headers({ "Content-Type": "application/json" });
      headers.set(
        config.authHeader,
        config.authHeader.toLowerCase() === "authorization"
          ? `Bearer ${config.apiKey}`
          : config.apiKey,
      );
      const res = await fetch(config.url, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: INSPIRATION_SYSTEM },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: data.note
                    ? `The client adds: "${data.note.replace(/"/g, "'")}". Read the pictures.`
                    : "Read the pictures.",
                },
                ...images.map((url) => ({ type: "image_url", image_url: { url } })),
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        await res.text();
        const message =
          res.status === 429
            ? "AI is busy right now. Try again in a minute."
            : res.status === 402
              ? "AI credits have run out for this app, so only the colours were read."
              : "AI could not read the pictures just now.";
        return { ok: false, linkImage, message };
      }
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = body.choices?.[0]?.message?.content ?? "";
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(json) as Record<string, unknown>;
      } catch {
        return { ok: false, linkImage, message: "AI gave an answer HALISIA could not read." };
      }
      return {
        ok: true,
        isBuilding: parsed.isBuilding !== false,
        style: sanitizeStyle({ ...parsed, source: "ai" }),
        linkImage,
      };
    } catch {
      return { ok: false, linkImage, message: "AI took too long to answer. Try one picture." };
    } finally {
      clearTimeout(timer);
    }
  });

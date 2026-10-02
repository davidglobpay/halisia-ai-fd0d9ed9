import { createServerFn } from "@tanstack/react-start";
import type { TtsEngine } from "./pulse/tts.server";

/**
 * Read any text aloud with a cloud voice.
 *
 * The TTS stack already had a text-generic core — `synthesize(text, engine)` in
 * pulse/tts.server.ts takes a bare string and knows nothing about articles. But
 * every caller above it was welded to a Pulse article: `synthesizeArticleAudio`
 * takes an articleId, looks the row up, and builds the script itself, so no
 * other surface in the app could speak. This is the same core with a text
 * parameter instead of a database lookup, which is all that was ever missing.
 *
 * Returns `ok: false` when no provider is configured or all of them failed, so
 * the caller falls back to the browser's own Web Speech API. A dossier that
 * cannot be read aloud in a cloud voice should still be readable aloud.
 */

/** Matches the slice inside `synthesize`, enforced here so a caller is told. */
const MAX_CHARS = 4000;

export const synthesizeText = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string; engine?: TtsEngine }) => input)
  .handler(async ({ data }) => {
    const text = (data.text ?? "").trim();
    if (!text) {
      return { ok: false as const, reason: "Nothing to read aloud.", engines: [] as string[] };
    }
    // A public endpoint that speaks arbitrary text is a quota drain if it takes
    // anything. The cap is the same one `synthesize` applies internally; saying
    // so here means a long page is truncated knowingly rather than silently.
    if (text.length > MAX_CHARS) {
      return {
        ok: false as const,
        reason: `Too long to read aloud in one pass (${text.length} characters, limit ${MAX_CHARS}).`,
        engines: [] as string[],
      };
    }

    const { availableEngines, synthesize } = await import("./pulse/tts.server");
    const engines = availableEngines();
    const result = await synthesize(text, data.engine);
    if (!result.ok) return { ok: false as const, reason: result.reason, engines };

    return {
      ok: true as const,
      engine: result.engine,
      mimeType: result.mimeType,
      audioBase64: result.audioBase64,
      engines,
    };
  });

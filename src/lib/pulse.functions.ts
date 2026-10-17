import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TtsEngine } from "./pulse/tts.server";

/** Increment the read counter for an article. Public, idempotent-ish. */
export const trackArticleView = createServerFn({ method: "POST" })
  .inputValidator((input: { articleId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("news_articles")
      .select("view_count")
      .eq("id", data.articleId)
      .maybeSingle();
    if (!row) return { ok: false };
    await supabaseAdmin
      .from("news_articles")
      .update({ view_count: (row.view_count ?? 0) + 1 })
      .eq("id", data.articleId);
    return { ok: true };
  });

/** Admin-only manual refresh of the Pulse feed. */
export const runPulseIngestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { useAi?: boolean } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrator",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { runIngestion } = await import("./pulse/ingest.server");
    return runIngestion({ useAi: data.useAi ?? true });
  });

/** Admin-only trending recompute. */
export const recomputePulseTrending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrator",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { recomputeTrending } = await import("./pulse/ingest.server");
    return { scored: await recomputeTrending() };
  });

/** Admin-only archive sweep for stale articles. */
export const archivePulseArticles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrator",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { archiveOldArticles } = await import("./pulse/ingest.server");
    return { archived: await archiveOldArticles(data.days ?? 45) };
  });

/**
 * Read an article aloud with a cloud voice. Returns `ok: false` when no
 * provider is configured or every provider failed, so the browser can fall
 * back to the Web Speech API.
 */
export const synthesizeArticleAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { articleId: string; engine?: TtsEngine }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("news_articles")
      .select("id, title, summary, raw_excerpt, why_it_matters")
      .eq("id", data.articleId)
      .eq("archived", false)
      .maybeSingle();
    if (!row) return { ok: false as const, reason: "Article not found", engines: [] as string[] };

    const script = [
      row.title,
      row.summary ?? row.raw_excerpt ?? "",
      row.why_it_matters ? `Why it matters. ${row.why_it_matters}` : "",
    ]
      .filter(Boolean)
      .join(". ");

    const { availableEngines, synthesize } = await import("./pulse/tts.server");
    const engines = availableEngines();
    const result = await synthesize(script, data.engine);
    if (!result.ok) return { ok: false as const, reason: result.reason, engines };

    return {
      ok: true as const,
      engine: result.engine,
      mimeType: result.mimeType,
      audioBase64: result.audioBase64,
      engines,
    };
  });

/** Which cloud voices are usable right now (for the audio engine switch). */
export const listTtsEngines = createServerFn({ method: "GET" }).handler(async () => {
  const { availableEngines } = await import("./pulse/tts.server");
  return { engines: availableEngines() };
});

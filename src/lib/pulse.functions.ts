import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TtsEngine } from "./pulse/tts.server";

/** Sampled public view signals. Atomic in the database; never used for ranking.
 * The process-local cooldown is best-effort and is not a rate limiter.
 */
const VIEW_COOLDOWN_MS = 60_000;
const recentViews = new Map<string, number>();

export const trackArticleView = createServerFn({ method: "POST" })
  .inputValidator((input: { articleId: string }) => {
    if (!input || typeof input.articleId !== "string") return { articleId: "" };
    return { articleId: input.articleId.toLowerCase() };
  })
  .handler(async ({ data }) => {
    const id = data.articleId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return { ok: false as const };

    const now = Date.now();
    const last = recentViews.get(id);
    if (last != null && now - last < VIEW_COOLDOWN_MS) return { ok: true as const };
    if (recentViews.size > 5000) recentViews.clear();
    recentViews.set(id, now);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("increment_article_view", {
      _article_id: id,
    });
    if (error && recentViews.get(id) === now) recentViews.delete(id);
    return { ok: !error } as const;
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

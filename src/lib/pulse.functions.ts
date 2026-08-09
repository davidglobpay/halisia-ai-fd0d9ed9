import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
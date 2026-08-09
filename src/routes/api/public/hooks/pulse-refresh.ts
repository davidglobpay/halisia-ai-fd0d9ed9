import { createFileRoute } from "@tanstack/react-router";

type Mode = "refresh" | "hourly" | "nightly";

/**
 * Scheduled Pulse refresh, called by pg_cron.
 *   refresh  (every 10 min) — ingest + dedupe + trending
 *   hourly              — ingest with AI enrichment + trending
 *   nightly             — full ingest, trending, archive sweep
 */
export const Route = createFileRoute("/api/public/hooks/pulse-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || apikey !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let mode: Mode = "refresh";
        try {
          const body = (await request.json()) as { mode?: Mode };
          if (body?.mode === "hourly" || body?.mode === "nightly") mode = body.mode;
        } catch {
          /* empty body is fine */
        }

        const { runIngestion, recomputeTrending, archiveOldArticles } = await import(
          "@/lib/pulse/ingest.server"
        );

        try {
          const summary = await runIngestion({ useAi: mode !== "refresh" });
          const scored = await recomputeTrending();
          const archived = mode === "nightly" ? await archiveOldArticles(45) : 0;
          return Response.json({ ok: true, mode, summary, scored, archived });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("pulse-refresh failed", message);
          return Response.json({ ok: false, mode, error: message }, { status: 500 });
        }
      },
    },
  },
});

import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

type Mode = "refresh" | "hourly" | "nightly";

type PulseRefreshDependencies = {
  runIngestion: (options: { useAi: boolean }) => Promise<unknown>;
  recomputeTrending: () => Promise<unknown>;
  archiveOldArticles: (days: number) => Promise<number>;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function isRateLimited(ip: string, now = Date.now()): boolean {
  const current = rateLimits.get(ip);
  if (!current || current.resetAt <= now) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

async function defaultDependencies(): Promise<PulseRefreshDependencies> {
  return import("@/lib/pulse/ingest.server");
}

export function resetPulseRefreshRateLimitForTests(): void {
  rateLimits.clear();
}

export async function handlePulseRefresh(
  request: Request,
  dependencies?: PulseRefreshDependencies,
): Promise<Response> {
  const expected = process.env["PULSE_CRON_SECRET"]?.trim() ?? "";
  if (!expected) {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }

  if (isRateLimited(clientIp(request))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const provided = request.headers.get("apikey") ?? "";
  if (!secretsMatch(provided, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let mode: Mode = "refresh";
  try {
    const body = (await request.json()) as { mode?: Mode };
    if (body?.mode === "hourly" || body?.mode === "nightly") mode = body.mode;
  } catch {
    /* empty body is fine */
  }

  const { runIngestion, recomputeTrending, archiveOldArticles } =
    dependencies ?? (await defaultDependencies());

  try {
    const summary = await runIngestion({ useAi: mode !== "refresh" });
    const scored = await recomputeTrending();
    const archived = mode === "nightly" ? await archiveOldArticles(45) : 0;
    return Response.json({ ok: true, mode, summary, scored, archived });
  } catch (error) {
    console.error("pulse-refresh failed", error);
    return Response.json(
      { ok: false, mode, error: "Pulse refresh failed" },
      { status: 500 },
    );
  }
}

/**
 * Scheduled Pulse refresh, called by pg_cron.
 *   refresh  (every 10 min) — ingest + dedupe + trending
 *   hourly              — ingest with AI enrichment + trending
 *   nightly             — full ingest, trending, archive sweep
 */
export const Route = createFileRoute("/api/public/hooks/pulse-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => handlePulseRefresh(request),
    },
  },
});

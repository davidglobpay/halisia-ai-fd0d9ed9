import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

function env(names: readonly string[]): string | undefined {
  const p = (globalThis as RuntimeGlobals).process?.env;
  for (const n of names) {
    const v = p?.[n]?.trim();
    if (v) return v;
  }
  return undefined;
}

function projectUrl(): string {
  const url = env(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL is required");
  return url;
}

function publishableKey(): string {
  const direct = env(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (direct) return direct;
  const keyset = env(["SUPABASE_PUBLISHABLE_KEYS"]);
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const key = [keys.default, ...Object.values(keys)].find(
          (v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"),
        );
        if (key) return key.trim();
      }
    } catch {
      // fall through
    }
  }
  const legacy = env(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("Supabase publishable key is required");
}

/** Forwards the verified OAuth token so RLS runs as the signed-in user. */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("A verified sign-in is required");
  return createClient(projectUrl(), publishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

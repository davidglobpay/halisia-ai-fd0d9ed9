import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

/**
 * Supabase stores the browser session under `sb-<project ref>-auth-token`.
 * The ref comes from the same .env the build reads, so a synthetic session is
 * found by the app instead of sitting under a key nobody reads.
 */
export function supabaseAuthStorageKey(): string {
  let url = process.env.VITE_SUPABASE_URL ?? "";
  if (!url) {
    try {
      const env = readFileSync(new URL("../../../.env", import.meta.url), "utf8");
      url = /^VITE_SUPABASE_URL=["']?([^"'\n]+)/m.exec(env)?.[1] ?? "";
    } catch {
      url = "";
    }
  }
  const ref = url ? new URL(url).hostname.split(".")[0] : "synthetic";
  return `sb-${ref}-auth-token`;
}

export const SYNTHETIC_USER_ID = "11111111-1111-4111-8111-111111111111";

/**
 * A signed-in browser session for UI tests only. Its token is not signed by
 * Supabase, so any real database call with it is refused; tests that use it
 * stub the calls they need. This exercises the signed-in screens, not
 * production authentication.
 */
export async function seedSyntheticSession(page: Page) {
  await page.addInitScript(
    ({ key, id }) => {
      const user = {
        id,
        aud: "authenticated",
        role: "authenticated",
        email: "qa@example.invalid",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-01-01T00:00:00Z",
      };
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const b64 = (o: unknown) =>
        btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const token =
        b64({ alg: "HS256", typ: "JWT" }) +
        "." +
        b64({ sub: id, exp, aud: "authenticated", role: "authenticated" }) +
        ".synthetic-signature";
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: token,
          refresh_token: "synthetic",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { key: supabaseAuthStorageKey(), id: SYNTHETIC_USER_ID },
  );
}

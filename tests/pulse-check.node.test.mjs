import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
const original = readFileSync(
  new URL("../src/routes/api/public/hooks/pulse-refresh.ts", import.meta.url),
  "utf8",
);
const source = original
  .replace(/import \{ createFileRoute \} from [^;]+;/, "")
  .replace(/import \{ secretsMatch \} from [^;]+;/, "")
  .replace(/type Mode = [^;]+;/, "")
  .replace("export const Route", "const Route")
  .replace("let mode: Mode", "let mode")
  .replace(/ as \{ mode\?: Mode \| "check" \}/, "")
  .replace("err instanceof Error ? err.message : String(err)", "String(err)");
// Same algorithm as src/lib/cron-secret.server.ts (tested directly in
// tests/unit/request-guards.test.ts); injected because this harness runs the
// route source without a module loader.
const secretsMatch = async (provided, expected) => {
  if (!expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
};
function handler(secret) {
  const context = vm.createContext({
    Response,
    process: { env: { PULSE_CRON_SECRET: secret } },
    console,
    createFileRoute: () => (config) => config,
    secretsMatch,
  });
  return vm.runInContext(source + "; Route.server.handlers.POST", context);
}
test("valid key check returns without ingestion import", async () => {
  const response = await handler("synthetic-test-key")({
    request: new Request("https://example.invalid", {
      method: "POST",
      headers: { "x-cron-secret": "synthetic-test-key" },
      body: JSON.stringify({ mode: "check" }),
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, mode: "check" });
});
for (const [label, expected, provided] of [
  ["missing", "synthetic-test-key", ""],
  ["wrong", "synthetic-test-key", "wrong"],
  ["unconfigured", "", ""],
])
  test(label + " credentials rejected", async () => {
    const response = await handler(expected)({
      request: new Request("https://example.invalid", {
        method: "POST",
        headers: { "x-cron-secret": provided },
        body: JSON.stringify({ mode: "check" }),
      }),
    });
    assert.equal(response.status, 401);
  });

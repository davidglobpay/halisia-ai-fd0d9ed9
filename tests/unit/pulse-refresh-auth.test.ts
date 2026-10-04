import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  handlePulseRefresh,
  resetPulseRefreshRateLimitForTests,
} from "../../src/routes/api/public/hooks/pulse-refresh";

const SECRET = "pulse-test-secret";

function dependencies() {
  return {
    runIngestion: vi.fn().mockResolvedValue({ ingested: 1 }),
    recomputeTrending: vi.fn().mockResolvedValue(1),
    archiveOldArticles: vi.fn().mockResolvedValue(0),
  };
}

function request(apikey?: string, body?: unknown, ip = "203.0.113.10") {
  const headers = new Headers({ "x-forwarded-for": ip });
  if (apikey !== undefined) headers.set("apikey", apikey);
  return new Request("http://localhost/api/public/hooks/pulse-refresh", {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("Pulse refresh webhook authentication", () => {
  beforeEach(() => {
    process.env.PULSE_CRON_SECRET = SECRET;
    process.env.SUPABASE_PUBLISHABLE_KEY = "browser-publishable-key";
    resetPulseRefreshRateLimitForTests();
  });

  afterEach(() => {
    delete process.env.PULSE_CRON_SECRET;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    vi.restoreAllMocks();
  });

  it("rejects an absent authentication header", async () => {
    const response = await handlePulseRefresh(request(), dependencies());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects a wrong secret", async () => {
    const response = await handlePulseRefresh(request("wrong-secret"), dependencies());
    expect(response.status).toBe(401);
  });

  it("does not accept the browser publishable key", async () => {
    const response = await handlePulseRefresh(
      request(process.env.SUPABASE_PUBLISHABLE_KEY),
      dependencies(),
    );
    expect(response.status).toBe(401);
  });

  it("fails closed when PULSE_CRON_SECRET is unset", async () => {
    delete process.env.PULSE_CRON_SECRET;
    const deps = dependencies();
    const response = await handlePulseRefresh(request(SECRET), deps);
    expect(response.status).toBe(503);
    expect(deps.runIngestion).not.toHaveBeenCalled();
  });

  it("proceeds with the correct secret without a live AI call", async () => {
    const deps = dependencies();
    const response = await handlePulseRefresh(request(SECRET), deps);
    expect(response.status).toBe(200);
    expect(deps.runIngestion).toHaveBeenCalledWith({ useAi: false });
    expect(await response.json()).toMatchObject({ ok: true, mode: "refresh" });
  });

  it("does not expose internal error messages", async () => {
    const deps = dependencies();
    deps.runIngestion.mockRejectedValueOnce(new Error("database password leaked"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await handlePulseRefresh(request(SECRET), deps);
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(body).not.toContain("database password leaked");
    expect(body).toContain("Pulse refresh failed");
  });

  it("rate-limits repeated requests from the same client", async () => {
    const deps = dependencies();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await handlePulseRefresh(request(SECRET), deps);
      expect(response.status).toBe(200);
    }
    const response = await handlePulseRefresh(request(SECRET), deps);
    expect(response.status).toBe(429);
  });
});

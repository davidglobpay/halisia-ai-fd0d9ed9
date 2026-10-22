import { afterEach, expect, it, vi } from "vitest";

const { query, client, result } = vi.hoisted(() => {
  const result = { data: [{ title: "County report" }], error: null as unknown };
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(async () => result),
  };
  const client = vi.fn((url: string, key: string, options: unknown) => {
    void url;
    void key;
    void options;
    return { from: vi.fn(() => query) };
  });
  return { query, client, result };
});

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: client }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { passportLocationNews } from "@/lib/pulse.functions";

const read = passportLocationNews as unknown as (input: {
  data: { county: string };
}) => Promise<{ articles: Array<{ title: string }> }>;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  result.error = null;
});

it("reads at most six unarchived stories for the requested county using public access", async () => {
  vi.stubEnv("SUPABASE_URL", "https://example.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  expect(await read({ data: { county: "Bungoma" } })).toEqual({ articles: result.data });
  expect(query.select).toHaveBeenCalledWith("title, source_name, published_at, url, category");
  expect(query.eq).toHaveBeenCalledWith("county", "Bungoma");
  expect(query.eq).toHaveBeenCalledWith("archived", false);
  expect(query.limit).toHaveBeenCalledWith(6);
  expect(client.mock.calls[0]?.[1]).toBe("sb_publishable_test");
});

it("does not turn a failed news query into genuine zero results", async () => {
  vi.stubEnv("SUPABASE_URL", "https://example.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  result.error = { message: "Unavailable" };
  await expect(read({ data: { county: "Bungoma" } })).rejects.toThrow(
    "County news is temporarily unavailable",
  );
});

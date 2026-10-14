import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicJson } from "@/lib/public-json";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("public provider deadline", () => {
  it("returns a provider response without altering it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"status":"observed"}')));
    await expect(fetchPublicJson("https://example.invalid/test")).resolves.toEqual({
      status: "observed",
    });
  });
  it("rejects HTTP errors rather than returning manufactured data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(fetchPublicJson("https://example.invalid/test")).rejects.toThrow("HTTP 503");
  });
  it("aborts an unresponsive provider within its deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    );
    const result = expect(fetchPublicJson("https://example.invalid/test", {}, 100)).rejects.toThrow(
      "aborted",
    );
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});

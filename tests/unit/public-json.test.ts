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
      /aborted|deadline exceeded/,
    );
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps the deadline active while the response body stalls", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start() {} }))),
    );
    const result = expect(fetchPublicJson("https://example.invalid/test", {}, 100)).rejects.toThrow(
      "deadline exceeded",
    );
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects malformed provider JSON and releases its timer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    await expect(fetchPublicJson("https://example.invalid/test")).rejects.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects a declared oversized response before reading it", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          headers: { "content-length": "999" },
        }),
      ),
    );
    await expect(fetchPublicJson("https://example.invalid/test", {}, 100, 10)).rejects.toThrow(
      "byte limit",
    );
  });
  it("caps chunked responses even when their content-length is missing or false", async () => {
    for (const declared of [undefined, "1"]) {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode('{"a":"'));
          c.enqueue(new TextEncoder().encode('more than limit"}'));
        },
        cancel,
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(body, {
            headers: declared ? { "content-length": declared } : {},
          }),
        ),
      );
      await expect(fetchPublicJson("https://example.invalid/test", {}, 100, 10)).rejects.toThrow(
        "byte limit",
      );
      expect(cancel).toHaveBeenCalledOnce();
    }
  });
  it("counts UTF-8 bytes, and accepts a body exactly at the cap", async () => {
    const raw = '{"name":"土地"}';
    const length = new TextEncoder().encode(raw).byteLength;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Response(raw)),
    );
    await expect(fetchPublicJson("https://example.invalid/test", {}, 100, length)).resolves.toEqual(
      { name: "土地" },
    );
    await expect(
      fetchPublicJson("https://example.invalid/test", {}, 100, length - 1),
    ).rejects.toThrow("byte limit");
  });
});

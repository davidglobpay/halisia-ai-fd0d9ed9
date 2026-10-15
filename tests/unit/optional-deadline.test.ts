import { afterEach, expect, it, vi } from "vitest";
import { optionalDeadline } from "@/lib/optional-deadline";
afterEach(() => vi.useRealTimers());
it("preserves successful inputs and clears the deadline", async () => {
  vi.useFakeTimers();
  await expect(optionalDeadline(Promise.resolve({ meters: 1664 }), 100)).resolves.toEqual({
    meters: 1664,
  });
  expect(vi.getTimerCount()).toBe(0);
});
it("rejects hung optional inputs instead of inventing evidence", async () => {
  vi.useFakeTimers();
  const result = expect(optionalDeadline(new Promise(() => {}), 100)).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(100);
  await result;
  expect(vi.getTimerCount()).toBe(0);
});

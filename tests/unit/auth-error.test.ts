import { describe, it, expect } from "vitest";
import { isAuthError } from "@/lib/auth-error";
describe("isAuthError", () => {
  it("detects rejected signed-in-only requests", () => {
    expect(isAuthError(new Error("Unauthorized: Invalid token"))).toBe(true);
  });
  it("ignores provider failures", () => {
    expect(isAuthError(new Error("Google Maps not configured"))).toBe(false);
  });
});

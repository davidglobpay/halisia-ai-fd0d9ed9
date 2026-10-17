import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from, auth: { getUser: mocks.getUser } },
}));
import { createProperty, updateProperty } from "@/lib/properties";

describe("property helpers withhold seller moderation decisions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects immediate publication before create reaches the API", async () => {
    await expect(
      createProperty({ title: "Synthetic listing", kind: "land", status: "published" }),
    ).rejects.toThrow(/review/);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects approval even when publication was omitted", async () => {
    await expect(updateProperty("synthetic-id", { review_state: "approved" })).rejects.toThrow(
      /moderation/,
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("preserves content-only edit payloads without creating an approval", async () => {
    const single = vi.fn().mockResolvedValue({ data: { title: "Changed title" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    mocks.from.mockReturnValue({ update });
    await expect(updateProperty("synthetic-id", { title: "Changed title" })).resolves.toEqual({
      title: "Changed title",
    });
    expect(update).toHaveBeenCalledWith({ title: "Changed title" });
    expect(eq).toHaveBeenCalledWith("id", "synthetic-id");
  });
});

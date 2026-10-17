import { expect, it, vi } from "vitest";
import { saveListingWithMediaCleanup } from "@/lib/listing-media-update";
it("keeps existing files when saving fails", async () => {
  const remove = vi.fn();
  await expect(
    saveListingWithMediaCleanup(
      async () => {
        throw new Error("Save failed");
      },
      ["old"],
      remove,
    ),
  ).rejects.toThrow("Save failed");
  expect(remove).not.toHaveBeenCalled();
});
it("revokes only removed files after the saved listing is known", async () => {
  const order: string[] = [];
  const remove = vi.fn(async (url: string) => {
    order.push(url);
  });
  const saved = { media_urls: ["keep"], cover_image: "cover" };
  expect(
    await saveListingWithMediaCleanup(
      async () => {
        order.push("saved");
        return saved;
      },
      ["old", "keep", "cover", "old"],
      remove,
    ),
  ).toBe(saved);
  expect(order).toEqual(["saved", "old"]);
});
it("preserves a successful save if cleanup fails", async () => {
  const saved = { media_urls: [], cover_image: null };
  expect(
    await saveListingWithMediaCleanup(
      async () => saved,
      ["old"],
      async () => {
        throw new Error("Storage offline");
      },
    ),
  ).toBe(saved);
});

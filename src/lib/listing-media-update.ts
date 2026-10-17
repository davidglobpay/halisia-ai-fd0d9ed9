/** Only revoke removed media after the listing update has succeeded. */
export async function saveListingWithMediaCleanup<
  T extends { media_urls: string[] | null; cover_image: string | null },
>(save: () => Promise<T>, previous: string[], remove: (url: string) => Promise<void>): Promise<T> {
  const saved = await save();
  const retained = new Set([...(saved.media_urls ?? []), saved.cover_image].filter(Boolean));
  await Promise.allSettled([...new Set(previous)].filter((url) => !retained.has(url)).map(remove));
  return saved;
}

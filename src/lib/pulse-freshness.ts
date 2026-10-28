/**
 * Whether the Pulse feed is current, judged only from the newest stored
 * story's publish date. When ingestion stops, the page must say so rather
 * than show an empty week or old stories as if they were today's news.
 */
export const PULSE_STALE_AFTER_HOURS = 48;

export type PulseFreshness =
  | { state: "unknown" }
  | { state: "current"; newestAt: string }
  | { state: "stale"; newestAt: string; daysOld: number };

export function pulseFreshness(newestPublishedAt: string | null | undefined, now = Date.now()) {
  if (!newestPublishedAt) return { state: "unknown" } as PulseFreshness;
  const t = Date.parse(newestPublishedAt);
  if (!Number.isFinite(t)) return { state: "unknown" } as PulseFreshness;
  const hours = (now - t) / 3_600_000;
  if (hours <= PULSE_STALE_AFTER_HOURS)
    return { state: "current", newestAt: newestPublishedAt } as PulseFreshness;
  return {
    state: "stale",
    newestAt: newestPublishedAt,
    daysOld: Math.floor(hours / 24),
  } as PulseFreshness;
}

/** "17 Oct 2026" in Kenyan time, independent of the viewer's locale. */
export function formatPulseDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(new Date(iso));
}

export function pulseStaleMessage(f: PulseFreshness): string | null {
  if (f.state !== "stale") return null;
  return `The newest story here is from ${formatPulseDate(f.newestAt)}, ${f.daysOld} days ago. Automatic news updates are paused, so this feed is not current. Choose “All” to see the stored stories.`;
}

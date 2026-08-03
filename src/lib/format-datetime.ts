/**
 * Deterministic date/time formatting.
 *
 * Using `toLocaleString()` with no options produces different output on the
 * server (UTC) and in the browser (user locale + timezone), which causes React
 * hydration mismatches. These helpers pin locale and timezone so SSR and the
 * client always agree.
 */
const LOCALE = "en-GB";
const TIME_ZONE = "Africa/Nairobi";

const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toDate(value: string | number | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | number | Date): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : "—";
}

export function formatDateTime(value: string | number | Date): string {
  const d = toDate(value);
  return d ? `${dateTimeFmt.format(d)} EAT` : "—";
}

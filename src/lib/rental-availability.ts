/**
 * Availability + viewing windows for rental vacancies.
 *
 * Stored on `rental_details.availability_windows` / `viewing_windows` as JSON
 * so landlords can manage several date ranges (e.g. a unit free in March and
 * again from July) without a second table.
 */
import type { Json } from "@/integrations/supabase/types";

export type AvailabilityWindow = {
  id: string;
  start: string; // YYYY-MM-DD inclusive
  end: string | null; // YYYY-MM-DD inclusive, null = open ended
  note?: string;
};

export type ViewingWindow = {
  id: string;
  weekday: number; // 0 = Sunday … 6 = Saturday
  from: string; // HH:MM
  to: string; // HH:MM
  note?: string;
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `w${Math.random().toString(36).slice(2)}`;
}

export function parseAvailability(raw: Json | null | undefined): AvailabilityWindow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => r as Record<string, unknown>)
    .filter((r) => r && typeof r["start"] === "string")
    .map((r) => ({
      id: String(r["id"] ?? newId()),
      start: String(r["start"]),
      end: typeof r["end"] === "string" && r["end"] ? String(r["end"]) : null,
      note: typeof r["note"] === "string" ? r["note"] : undefined,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function parseViewings(raw: Json | null | undefined): ViewingWindow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => r as Record<string, unknown>)
    .filter((r) => r && r["from"] != null && r["to"] != null)
    .map((r) => ({
      id: String(r["id"] ?? newId()),
      weekday: Math.max(0, Math.min(6, Number(r["weekday"] ?? 1))),
      from: String(r["from"]),
      to: String(r["to"]),
      note: typeof r["note"] === "string" ? r["note"] : undefined,
    }))
    .sort((a, b) => a.weekday - b.weekday || a.from.localeCompare(b.from));
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isAvailableOn(iso: string, windows: AvailabilityWindow[]): boolean {
  return windows.some((w) => iso >= w.start && (w.end == null || iso <= w.end));
}

export function windowFor(iso: string, windows: AvailabilityWindow[]): AvailabilityWindow | null {
  return windows.find((w) => iso >= w.start && (w.end == null || iso <= w.end)) ?? null;
}

/** Earliest upcoming (or current) availability date, or null when none. */
export function nextAvailable(windows: AvailabilityWindow[], from = new Date()): string | null {
  const today = toIsoDate(from);
  const active = windows.find((w) => today >= w.start && (w.end == null || today <= w.end));
  if (active) return today;
  const upcoming = windows
    .filter((w) => w.start > today)
    .sort((a, b) => a.start.localeCompare(b.start));
  return upcoming[0]?.start ?? null;
}

export function describeAvailability(
  windows: AvailabilityWindow[],
  fallbackFrom: string | null,
): string {
  if (windows.length === 0)
    return fallbackFrom ? `Available from ${fallbackFrom}` : "Availability not stated";
  const next = nextAvailable(windows);
  if (!next) return `Past windows only (${windows.length})`;
  const w = windowFor(next, windows) ?? windows.find((x) => x.start === next)!;
  const end = w.end ? ` → ${w.end}` : " onwards";
  return next === toIsoDate(new Date()) ? `Available now${end}` : `Available ${w.start}${end}`;
}

export function describeViewings(v: ViewingWindow[]): string {
  if (v.length === 0) return "Viewing times not set";
  return v.map((x) => `${WEEKDAYS[x.weekday]} ${x.from}–${x.to}`).join(" · ");
}

/** Six-week grid (leading/trailing days included) for a month calendar. */
export function monthGrid(
  year: number,
  month: number,
): { iso: string; inMonth: boolean; day: number }[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const cells: { iso: string; inMonth: boolean; day: number }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - startOffset + i);
    cells.push({ iso: toIsoDate(d), inMonth: d.getMonth() === month, day: d.getDate() });
  }
  return cells;
}

export function toJson(v: unknown): Json {
  return JSON.parse(JSON.stringify(v)) as Json;
}

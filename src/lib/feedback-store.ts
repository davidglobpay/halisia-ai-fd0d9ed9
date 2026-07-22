/**
 * Lightweight local feedback store for AI intelligence modules. Powers
 * the per-card 👍 / 👎 / flag widget and persists to localStorage so a
 * user's ratings survive reloads and can later be replayed to any
 * server-side "continuous learning" pipeline.
 */
import type { ModuleId } from "@/lib/intelligence-engine";

export type Rating = "up" | "down" | null;

export interface ModuleFeedback {
  rating: Rating;
  flag?: string;
  updatedAt: string;
}

const KEY = "halisia:module-feedback:v1";

function read(): Record<string, ModuleFeedback> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function write(all: Record<string, ModuleFeedback>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("halisia:feedback"));
  } catch {
    /* ignore quota */
  }
}

export function getFeedback(id: ModuleId): ModuleFeedback | undefined {
  return read()[id];
}

export function setRating(id: ModuleId, rating: Rating) {
  const all = read();
  const prev = all[id] ?? { rating: null, updatedAt: new Date().toISOString() };
  all[id] = { ...prev, rating, updatedAt: new Date().toISOString() };
  write(all);
}

export function flagIssue(id: ModuleId, reason: string) {
  const all = read();
  const prev = all[id] ?? { rating: null, updatedAt: new Date().toISOString() };
  all[id] = { ...prev, flag: reason, updatedAt: new Date().toISOString() };
  write(all);
}

export function allFeedback(): Record<string, ModuleFeedback> {
  return read();
}

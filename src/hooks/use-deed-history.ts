import { useCallback, useEffect, useState } from "react";

const KEY = "halisia.deed-history.v1";
const MAX = 25;

export type DeedHistoryEntry = {
  id: string;
  createdAt: number;
  mode: "query" | "upload";
  label: string;
  queryType?: "title" | "lr" | "parcel" | "registry";
  queryValue?: string;
  fileName?: string;
  fields?: {
    titleNumber: string | null;
    lrNumber: string | null;
    parcelNumber: string | null;
    county: string | null;
    registry: string | null;
    confidence: number;
  };
  location?: { lat: number; lng: number; address: string };
};

function read(): DeedHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(items: DeedHistoryEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* ignore quota */
  }
}

export function useDeedHistory() {
  const [items, setItems] = useState<DeedHistoryEntry[]>([]);

  useEffect(() => {
    setItems(read());
  }, []);

  const add = useCallback((entry: Omit<DeedHistoryEntry, "id" | "createdAt">) => {
    const next: DeedHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    setItems((prev) => {
      const merged = [next, ...prev].slice(0, MAX);
      write(merged);
      return merged;
    });
    return next;
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const merged = prev.filter((e) => e.id !== id);
      write(merged);
      return merged;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    write([]);
  }, []);

  return { items, add, remove, clear };
}
import { useEffect, useRef, useState } from "react";

/**
 * useState that mirrors its value into localStorage under `key`.
 * SSR-safe: reads from storage in a mount effect, so first render matches
 * the server-rendered `initial` and there are no hydration mismatches.
 */
export function usePersistedState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore malformed JSON / disabled storage */
    }
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [key, value]);

  return [value, setValue];
}
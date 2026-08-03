import { useCallback, useEffect, useState } from "react";

export const REDUCED_MOTION_KEY = "halisia:pipelineReducedMotion";
const EVENT = "halisia:reducedMotionChanged";

function read(): boolean | null {
  try {
    const v = window.localStorage.getItem(REDUCED_MOTION_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* storage disabled */
  }
  return null;
}

/**
 * Landing-page motion preference, persisted across sessions.
 * Seeds from the OS `prefers-reduced-motion` setting, then lets the explicit
 * in-app toggle win. Every consumer stays in sync via a window event.
 */
export function useReducedMotionPref(): [boolean, () => void, (v: boolean) => void] {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const stored = read();
    if (stored != null) {
      setReduced(stored);
    } else {
      try {
        setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch {
        /* matchMedia unavailable */
      }
    }
    const sync = () => {
      const v = read();
      if (v != null) setReduced(v);
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const set = useCallback((next: boolean) => {
    setReduced(next);
    try {
      window.localStorage.setItem(REDUCED_MOTION_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { reduced: next } }));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => set(!reduced), [reduced, set]);

  return [reduced, toggle, set];
}

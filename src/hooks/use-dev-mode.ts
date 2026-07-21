import { useEffect, useState } from "react";

const KEY = "halisia:devMode";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("dev") === "1") {
      window.localStorage.setItem(KEY, "1");
      return true;
    }
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Developer-mode flag. Enable with ?dev=1 or localStorage['halisia:devMode']='1'. */
export function useDevMode(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(read());
    const handler = () => setOn(read());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  return on;
}

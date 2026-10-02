import { useEffect, useState } from "react";
import { Volume2, Square } from "lucide-react";

/** Reads short text aloud with the browser's built-in voice. No server cost. */
export function ListenButton({ text, label = "Listen" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOk(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  if (!ok) return null;
  const toggle = () => {
    const s = window.speechSynthesis;
    s.cancel();
    if (on) return setOn(false);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-KE";
    u.onend = u.onerror = () => setOn(false);
    s.speak(u);
    setOn(true);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? "Stop reading" : `${label}: read aloud`}
      className="inline-flex min-h-[28px] items-center gap-1 rounded-full border border-foreground/15 px-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
    >
      {on ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
      {on ? "Stop" : label}
    </button>
  );
}

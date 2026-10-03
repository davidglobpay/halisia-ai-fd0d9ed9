import { useEffect, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

const SPEECH_STOP_EVENT = "halisia:speech-stop";

/** Reads short text aloud with the browser's built-in voice. No server cost. */
export function ListenButton({ text, label = "Listen" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  const [on, setOn] = useState(false);
  const speakingRef = useRef(false);
  useEffect(() => {
    setOk(typeof window !== "undefined" && "speechSynthesis" in window);
    const stopped = () => {
      speakingRef.current = false;
      setOn(false);
    };
    window.addEventListener(SPEECH_STOP_EVENT, stopped);
    return () => {
      window.removeEventListener(SPEECH_STOP_EVENT, stopped);
      if (speakingRef.current && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.dispatchEvent(new Event(SPEECH_STOP_EVENT));
      }
    };
  }, []);
  if (!ok) return null;
  const toggle = () => {
    const s = window.speechSynthesis;
    s.cancel();
    window.dispatchEvent(new Event(SPEECH_STOP_EVENT));
    if (on) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-KE";
    u.onend = u.onerror = () => {
      speakingRef.current = false;
      setOn(false);
    };
    s.speak(u);
    speakingRef.current = true;
    setOn(true);
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={on ? "Stop reading" : `${label}: read aloud`}
      className="min-h-7 h-7 rounded-full border border-foreground/15 px-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
    >
      {on ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
      {on ? "Stop" : label}
    </Button>
  );
}

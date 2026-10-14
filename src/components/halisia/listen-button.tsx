import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

const SPEECH_STOP_EVENT = "halisia:speech-stop";
/** Browser voice, shared across tiles. One reader at a time, no server cost. */
export function ListenButton({
  text,
  label = "Listen",
}: {
  text: string | (() => string);
  label?: string;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const speakingRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const invalidateSpeech = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    setSupported("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    const stopped = () => {
      invalidateSpeech();
      speakingRef.current = false;
      utteranceRef.current = null;
      setOn(false);
    };
    window.addEventListener(SPEECH_STOP_EVENT, stopped);
    return () => {
      window.removeEventListener(SPEECH_STOP_EVENT, stopped);
      invalidateSpeech();
      if (speakingRef.current && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.dispatchEvent(new Event(SPEECH_STOP_EVENT));
      }
    };
  }, [invalidateSpeech]);
  const toggle = () => {
    const s = window.speechSynthesis;
    const stopping = speakingRef.current;
    window.dispatchEvent(new Event(SPEECH_STOP_EVENT));
    s.cancel();
    if (stopping) return;
    setNotice("");
    const clean = (typeof text === "function" ? text() : text).replace(/\s+/g, " ").trim();
    if (!clean) {
      setNotice("No output to read yet.");
      return;
    }
    // Short queued passages avoid mobile browsers truncating long utterances.
    const chunks = clean.match(/.{1,220}(?:\s|$)|.{1,220}/g) ?? [clean];
    const token = generation.current;
    speakingRef.current = true;
    setOn(true);
    const next = (index: number) => {
      if (token !== generation.current) return;
      if (index >= chunks.length) {
        speakingRef.current = false;
        utteranceRef.current = null;
        setOn(false);
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[index]);
      u.lang = "en-KE";
      const voices = s.getVoices();
      const voice =
        voices.find((v) => v.lang.toLowerCase() === "en-ke") ??
        voices.find((v) => v.lang.startsWith("en"));
      if (voice) u.voice = voice;
      utteranceRef.current = u;
      u.onend = () => next(index + 1);
      u.onerror = () => {
        if (token === generation.current) {
          speakingRef.current = false;
          setOn(false);
          setNotice("Voice unavailable. Please try another browser or installed voice.");
        }
      };
      s.speak(u);
    };
    next(0);
  };
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggle}
        disabled={supported !== true}
        aria-pressed={on}
        aria-label={on ? `Stop reading ${label}` : `${label}: read aloud`}
        className="min-h-9 h-auto rounded-full border border-foreground/15 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
      >
        {on ? (
          <Square className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Volume2 className="h-3 w-3" aria-hidden="true" />
        )}
        {on ? "Stop" : label}
      </Button>
      {(supported === false || notice) && (
        <span role="status" className="text-[10px] text-muted-foreground">
          {notice || "Voice reading is unavailable in this browser."}
        </span>
      )}
    </span>
  );
}

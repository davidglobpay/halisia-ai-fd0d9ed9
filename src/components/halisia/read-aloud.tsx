import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Volume2 } from "lucide-react";
import { synthesizeText } from "@/lib/speech.functions";
import { loadAudio } from "@/lib/media-cache";

/**
 * Read any block of text aloud.
 *
 * Drop it beside any heading:
 *
 *   <ReadAloud text={summary} label="Listen" />
 *
 * A cloud voice is used when one is configured — ElevenLabs, Azure with a
 * Kenyan English voice, or Google Cloud TTS. When none is, or the call fails,
 * it falls back to the browser's own speech synthesis, which costs nothing and
 * works offline. Either way the button behaves the same, so a reader never
 * finds out which path they got unless it fails entirely.
 *
 * Nothing here is bound to a Pulse article, which is the whole point: the
 * existing player could only speak rows from `news_articles`.
 */

/** Stable cache key for a block of text. FNV-1a, 32-bit, hex. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Browser speech synthesis. Returns a stop function, or null if unsupported. */
function speakText(text: string, onEnd: () => void): (() => void) | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.lang = "en-KE";
  utter.onend = onEnd;
  utter.onerror = onEnd;
  window.speechSynthesis.speak(utter);
  return () => {
    window.speechSynthesis.cancel();
    onEnd();
  };
}

export function ReadAloud({
  text,
  label = "Listen",
  className = "",
}: {
  /** The passage to speak. Empty or whitespace renders nothing. */
  text: string;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopSpeechRef = useRef<(() => void) | null>(null);

  // Always release the voice on unmount — a panel that keeps talking after the
  // user has navigated away is the worst version of this feature.
  useEffect(() => {
    return () => {
      stopSpeechRef.current?.();
      audioRef.current?.pause();
    };
  }, []);

  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;

  const stop = () => {
    stopSpeechRef.current?.();
    stopSpeechRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
  };

  const playBrowser = () => {
    const halt = speakText(clean, () => setPlaying(false));
    if (!halt) {
      setNotice("Audio is not supported in this browser.");
      setPlaying(false);
      return;
    }
    stopSpeechRef.current = halt;
    setPlaying(true);
  };

  const start = async () => {
    setNotice(null);
    setBusy(true);
    try {
      const res = await loadAudio(hash(clean), "auto", () =>
        synthesizeText({ data: { text: clean } }).then((r) =>
          r.ok
            ? { mimeType: r.mimeType, audioBase64: r.audioBase64, engine: r.engine }
            : Promise.reject(new Error(r.reason)),
        ),
      );
      const el = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
      el.onended = () => setPlaying(false);
      el.onerror = () => {
        // A cloud clip that will not decode is still a failure the reader
        // should not see. Fall through to the browser voice.
        audioRef.current = null;
        playBrowser();
      };
      audioRef.current = el;
      await el.play();
      setPlaying(true);
    } catch {
      // No provider configured, the text was refused, or the network failed.
      // The browser voice is always there.
      playBrowser();
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => (playing ? stop() : void start())}
        disabled={busy}
        data-testid="read-aloud"
        aria-label={playing ? "Stop reading" : `${label} — read this aloud`}
        className="inline-flex items-center gap-1.5 rounded-full glass border border-white/12 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/5 transition disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-hidden="true" />
        ) : playing ? (
          <Pause className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        ) : (
          <Volume2 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        )}
        {playing ? "Stop" : label}
      </button>
      {notice && (
        <span role="status" className="text-[10px] text-muted-foreground">
          {notice}
        </span>
      )}
    </span>
  );
}

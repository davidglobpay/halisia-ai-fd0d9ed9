import { useCallback, useEffect, useRef, useState } from "react";

type SRWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

export function useVoiceInput(opts: { onFinal: (transcript: string) => void; lang?: string }) {
  const { onFinal, lang = "en-US" } = opts;
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as SRWindow;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const w = window as SRWindow;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Voice input isn't supported in this browser.");
      return;
    }
    setError(null);
    setInterim("");
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal?: boolean };
        const alt = r[0];
        if (r.isFinal) finalText += alt.transcript;
        else interimText += alt.transcript;
      }
      setInterim(interimText);
      if (finalText) {
        onFinal(finalText.trim());
        setInterim("");
      }
    };
    rec.onerror = (e) => {
      setError(e.error || e.message || "Voice input error");
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start voice input");
      setListening(false);
    }
  }, [lang, onFinal]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  return { supported, listening, interim, error, start, stop };
}

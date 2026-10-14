import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { tokenize, tokenAt, firstWord, msPerWord } from "@/lib/spoken-text";

/**
 * A passage that reads itself aloud and highlights the word being spoken.
 *
 * The app already has ListenButton, which speaks the rendered text of a card.
 * That is right for a card of short figures. It is wrong for the long written
 * passages — the location read, the interpretation, the limitations — where a
 * person listening has no idea which sentence they are in, and a person who
 * reads slowly loses their place the moment the voice gets ahead of them.
 * Following the word is the whole point: it keeps reading and listening in the
 * same place, which is what makes a dense page survivable.
 *
 * The highlight is driven by the browser's own `boundary` event, so it tracks
 * the real voice rather than a guess. Safari has historically not fired that
 * event for remote voices; when nothing arrives within a second of starting,
 * the component falls back to advancing on a timer derived from the measured
 * characters-per-second of the passage. The fallback is deliberately coarse —
 * it keeps a reader roughly in place rather than pretending to precision it
 * does not have.
 *
 * Follows the policy in docs/output-accessibility.md: browser synthesis only
 * so there is no server voice charge, one reader at a time across the app via
 * the shared `halisia:speech-stop` event, Kenyan English preferred where it is
 * installed, cancellation on unmount, and an explicit state when the browser
 * has no speech at all rather than a button that silently does nothing.
 */

const STOP_EVENT = "halisia:speech-stop";

export function SpokenText({
  text,
  className,
  label = "Listen",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [available, setAvailable] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const playing = useRef(false);
  const pausedAt = useRef(0);
  const gotBoundary = useRef(false);
  const startedAt = useRef(0);

  useEffect(() => {
    setAvailable(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const clearTimer = () => {
    if (delay.current !== null) {
      clearTimeout(delay.current);
      delay.current = null;
    }
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  const stop = useCallback(() => {
    generation.current += 1;
    playing.current = false;
    clearTimer();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* some browsers throw when nothing is speaking */
    }
    setState("idle");
    setActive(-1);
  }, []);

  // One reader at a time, and never leave a voice running behind a closed page.
  useEffect(() => {
    const onStop = () => stop();
    window.addEventListener(STOP_EVENT, onStop);
    return () => {
      window.removeEventListener(STOP_EVENT, onStop);
      generation.current += 1;
      playing.current = false;
      clearTimer();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [stop, text]);

  const pickVoice = () => {
    const voices = window.speechSynthesis.getVoices?.() ?? [];
    return (
      voices.find((v) => v.lang === "en-KE") ??
      voices.find((v) => v.lang?.startsWith("en-")) ??
      undefined
    );
  };

  const play = useCallback(() => {
    if (!available) return;
    window.dispatchEvent(new Event(STOP_EVENT));
    clearTimer();
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }

    const session = ++generation.current;
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-KE";
    u.rate = 0.98;

    gotBoundary.current = false;
    startedAt.current = Date.now();

    u.onboundary = (e: SpeechSynthesisEvent) => {
      if (session !== generation.current || !playing.current) return;
      gotBoundary.current = true;
      clearTimer();
      const i = tokenAt(tokens, e.charIndex);
      if (i >= 0) setActive(i);
    };
    u.onend = () => {
      if (session !== generation.current) return;
      generation.current += 1;
      playing.current = false;
      clearTimer();
      setState("idle");
      setActive(-1);
    };
    u.onerror = () => {
      if (session !== generation.current) return;
      generation.current += 1;
      playing.current = false;
      clearTimer();
      setState("idle");
      setActive(-1);
    };

    playing.current = true;
    setState("playing");
    setActive(firstWord(tokens));
    window.speechSynthesis.speak(u);

    // Fallback for engines that never fire `boundary`: advance on a timer
    // paced by the passage length. Coarse on purpose — it keeps a reader near
    // the right line without claiming to be in step with the voice.
    delay.current = setTimeout(() => {
      delay.current = null;
      if (session !== generation.current || gotBoundary.current) return;
      const words = tokens.filter((t) => t.word).length;
      if (!words) return;
      const perWord = msPerWord(u.rate);
      timer.current = setInterval(
        () => {
          if (session !== generation.current || !playing.current) return;
          const elapsed = Date.now() - startedAt.current;
          const n = Math.floor(elapsed / perWord);
          let seen = -1;
          for (let i = 0; i < tokens.length; i++) {
            if (!tokens[i].word) continue;
            seen++;
            if (seen === n) {
              setActive(i);
              return;
            }
          }
          clearTimer();
        },
        Math.max(120, perWord / 2),
      );
    }, 1000);
  }, [available, text, tokens]);

  const pause = useCallback(() => {
    try {
      window.speechSynthesis.pause();
      playing.current = false;
      pausedAt.current = Date.now();
      setState("paused");
    } catch {
      /* ignore */
    }
  }, []);

  const resume = useCallback(() => {
    try {
      window.speechSynthesis.resume();
      startedAt.current += Date.now() - pausedAt.current;
      playing.current = true;
      setState("playing");
    } catch {
      /* ignore */
    }
  }, []);

  if (!available)
    return (
      <div className={className}>
        <p className="text-sm leading-relaxed">{text}</p>
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          This browser has no speech voice installed, so the read-aloud is not
          available here. The full text is above.
        </p>
      </div>
    );

  return (
    <div className={className} data-testid="spoken-text">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={
            state === "playing" ? pause : state === "paused" ? resume : play
          }
          aria-label={state === "playing" ? "Pause reading" : label}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm text-primary-foreground"
        >
          {state === "playing" ? (
            <Pause className="h-4 w-4" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          {state === "playing"
            ? "Pause"
            : state === "paused"
              ? "Continue"
              : label}
        </button>
        {state !== "idle" && (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop reading"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm"
          >
            <Square className="h-3.5 w-3.5" aria-hidden />
            Stop
          </button>
        )}
      </div>
      <p
        className="mt-3 text-sm leading-relaxed"
        aria-live="off"
        data-testid="spoken-text-body"
      >
        {tokens.map((t, i) =>
          t.word ? (
            <span
              key={`${t.start}-${i}`}
              data-spoken={i === active ? "now" : undefined}
              className={
                i === active
                  ? "rounded-[3px] bg-emerald-glow/30 text-foreground ring-1 ring-emerald-glow/40"
                  : undefined
              }
            >
              {t.text}
            </span>
          ) : (
            <span key={`${t.start}-${i}`}>{t.text}</span>
          ),
        )}
      </p>
    </div>
  );
}

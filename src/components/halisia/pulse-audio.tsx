import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Volume2 } from "lucide-react";
import { listTtsEngines, synthesizeArticleAudio } from "@/lib/pulse.functions";
import { speakArticle, type PulseArticle } from "@/lib/pulse";
import { loadAudio } from "@/lib/media-cache";

type Engine = "auto" | "elevenlabs" | "azure" | "google" | "web_speech";

const LABELS: Record<Engine, string> = {
  auto: "Best available",
  elevenlabs: "ElevenLabs",
  azure: "Azure Speech",
  google: "Google Cloud TTS",
  web_speech: "Browser voice",
};

/** Listen to an article: cloud voice when configured, browser voice otherwise. */
export function PulseAudioPlayer({ article }: { article: PulseArticle }) {
  const [engine, setEngine] = useState<Engine>("auto");
  const [available, setAvailable] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [usedEngine, setUsedEngine] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopSpeechRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    void listTtsEngines()
      .then((r) => setAvailable(r.engines))
      .catch(() => setAvailable([]));
    return () => {
      stopSpeechRef.current?.();
      audioRef.current?.pause();
    };
  }, []);

  const stop = () => {
    stopSpeechRef.current?.();
    stopSpeechRef.current = null;
    audioRef.current?.pause();
    setPlaying(false);
  };

  const playBrowser = (reason?: string) => {
    const stopper = speakArticle(article);
    if (!stopper) {
      setNotice("Audio is not supported in this browser.");
      setPlaying(false);
      return;
    }
    stopSpeechRef.current = stopper;
    setUsedEngine("web_speech");
    setPlaying(true);
    if (reason) setNotice(reason);
  };

  const play = async () => {
    setNotice(null);
    if (engine === "web_speech") return playBrowser();
    setBusy(true);
    try {
      // Cached per article + engine, so replays and revisits never trigger a
      // duplicate TTS call.
      const res = await loadAudio(article.id, engine, async () => {
        const r = await synthesizeArticleAudio({
          data: {
            articleId: article.id,
            ...(engine === "auto" ? {} : { engine }),
          },
        });
        if (!r.ok) throw new Error(r.reason);
        return { engine: r.engine, mimeType: r.mimeType, audioBase64: r.audioBase64 };
      });
      const el = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
      audioRef.current = el;
      el.onended = () => setPlaying(false);
      el.onerror = () => playBrowser("Playback failed. Playing the browser voice.");
      await el.play();
      setUsedEngine(res.engine);
      setPlaying(true);
    } catch (err) {
      playBrowser(
        `Speech service error — ${err instanceof Error ? err.message : "unknown error"}. Playing the browser voice.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="elev-1 rounded-2xl border border-white/10 p-4" data-testid="pulse-audio">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => (playing ? stop() : void play())}
          disabled={busy}
          aria-label={playing ? "Stop audio briefing" : "Play audio briefing"}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 text-sm font-medium text-accent disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {playing ? "Stop" : "Listen"}
        </button>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Speech engine</span>
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value as Engine)}
            aria-label="Speech engine"
            className="min-h-9 rounded-full border border-white/10 bg-transparent px-3 text-xs"
          >
            {(["auto", "elevenlabs", "azure", "google", "web_speech"] as Engine[]).map((e) => (
              <option key={e} value={e} className="bg-background">
                {LABELS[e]}
                {e !== "auto" && e !== "web_speech" && !available.includes(e)
                  ? " (not configured)"
                  : ""}
              </option>
            ))}
          </select>
        </label>

        {usedEngine && (
          <span className="text-[11px] text-muted-foreground">
            Playing with {LABELS[(usedEngine as Engine) ?? "auto"] ?? usedEngine}
          </span>
        )}
      </div>
      {notice && (
        <p role="status" className="mt-2 text-[11px] text-amber-glow">
          {notice}
        </p>
      )}
    </div>
  );
}

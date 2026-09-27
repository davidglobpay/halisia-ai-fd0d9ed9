import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { summarisePassport } from "@/lib/passport-ai.functions";

/** Optional AI reading of the evidence rows, kept apart from source data. */
export function AiInterpretation({
  digest,
  place,
  coveragePct,
}: {
  digest: string;
  place: string;
  coveragePct: number;
}) {
  const run = useServerFn(summarisePassport);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [text, setText] = useState("");
  const tooThin = coveragePct < 40;

  const go = async () => {
    setState("loading");
    const r = await run({ data: { digest, place } }).catch(() => ({
      ok: false as const,
      status: 0,
      message: "Could not reach the AI service.",
    }));
    if (r.ok) {
      setText(r.text);
      setState("done");
    } else {
      setText(r.message);
      setState("error");
    }
  };

  return (
    <section className="rounded-2xl border border-accent/30 bg-card/80 p-4" data-testid="passport-ai">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base">
          <Sparkles className="h-4 w-4 text-accent" /> HALISIA interpretation
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">AI · not source data</span>
      </div>
      {tooThin ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Too little evidence for an AI summary ({coveragePct}% coverage). Not assessed.
        </p>
      ) : state === "idle" ? (
        <button
          onClick={go}
          className="mt-3 min-h-[44px] rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
        >
          Summarise the evidence
        </button>
      ) : state === "loading" ? (
        <p className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the evidence…
        </p>
      ) : state === "error" ? (
        <p className="mt-2 text-xs text-destructive" role="alert">{text}</p>
      ) : (
        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Built only from the evidence rows below; bracketed codes point to the row it came from. Not
        advice, not a valuation, not a verification.
      </p>
    </section>
  );
}

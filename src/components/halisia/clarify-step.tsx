import { HelpCircle } from "lucide-react";
import type { ClarifyAnswers, ClarifyQuestion } from "@/lib/clarify";

type Props = {
  title?: string;
  intro?: string;
  questions: ClarifyQuestion[];
  answers: ClarifyAnswers;
  onChange: (next: ClarifyAnswers) => void;
};

/**
 * Asks the user to confirm the details we are least sure about before the AI
 * writes copy or ranks matches. Everything here is optional — skipping simply
 * means the AI stays silent on that point rather than guessing.
 */
export function ClarifyStep({
  title = "Quick clarifications",
  intro = "Confirm the details below so HALISIA never guesses on your behalf. Skip anything you are unsure about.",
  questions,
  answers,
  onChange,
}: Props) {
  if (questions.length === 0)
    return (
      <p className="text-sm text-muted-foreground" data-testid="clarify-empty">
        Nothing to clarify — we have everything we need.
      </p>
    );

  return (
    <section data-testid="clarify-step" className="grid gap-3">
      <div>
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-accent">
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" /> {title}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
      </div>

      {questions.map((q) => (
        <fieldset
          key={q.key}
          className="rounded-2xl border border-white/10 bg-white/5 p-3.5"
          data-testid={`clarify-${q.key}`}
        >
          <legend className="px-1 text-sm font-medium">{q.question}</legend>
          <p className="text-[11px] text-muted-foreground">{q.why}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {q.options.map((o) => {
              const active = answers[q.key] === o;
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...answers, [q.key]: active ? "" : o })}
                  className={`rounded-full border px-3 py-1 text-[11px] transition ${
                    active
                      ? "border-accent bg-accent/20 text-accent"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {q.allowFreeText && (
            <input
              aria-label={`${q.question} — other`}
              placeholder="Or type your own answer"
              value={q.options.includes(answers[q.key] ?? "") ? "" : (answers[q.key] ?? "")}
              onChange={(e) => onChange({ ...answers, [q.key]: e.target.value })}
              className="input mt-2 !py-1.5 !text-xs"
            />
          )}
        </fieldset>
      ))}
    </section>
  );
}

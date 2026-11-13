/**
 * A small pop-up guide for a 3D view: how to turn, zoom, slide and use the
 * view's own controls, one step at a time. It opens by itself the first time
 * a visitor sees that view, stays out of the middle of the scene so dragging
 * still works, and comes back from the "?" button.
 */
import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

const KEY = (id: string) => `halisia:viewer-guide:${id}:seen`;

function seen(id: string): boolean {
  try {
    return window.localStorage.getItem(KEY(id)) !== null;
  } catch {
    return true; // storage blocked: do not pop up on every visit
  }
}

function markSeen(id: string) {
  try {
    window.localStorage.setItem(KEY(id), String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

export function ViewerGuide({
  id,
  title,
  steps,
  position = "bottom",
  buttonClassName,
}: {
  /** Which view, so each is remembered separately. */
  id: string;
  title: string;
  /** [heading, what to do] pairs. */
  steps: Array<[string, string]>;
  /** Edge of the view the card sits on; pick the one without controls. */
  position?: "top" | "bottom";
  /** Where the "?" button goes, when the default corner is taken. */
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!seen(id)) setOpen(true);
  }, [id]);

  const close = () => {
    markSeen(id);
    setOpen(false);
    setI(0);
  };

  const edge = position === "top" ? "top-2" : "bottom-2";
  const [head, body] = steps[i] ?? ["", ""];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setI(0);
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-label={`How to use this view: ${title}`}
        className={`absolute z-20 grid h-10 w-10 place-items-center rounded-full border border-border bg-card/95 text-card-foreground shadow ${buttonClassName ?? `left-2 ${position === "top" ? "bottom-2" : "top-2"}`}`}
        data-testid={`guide-${id}-button`}
      >
        <HelpCircle className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <section
          aria-label={title}
          className={`absolute left-2 right-16 ${edge} z-20 rounded-2xl border border-border bg-card/95 p-3 text-xs text-card-foreground shadow-lg sm:right-auto sm:w-80`}
          data-testid={`guide-${id}`}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                {title} · {i + 1} of {steps.length}
              </p>
              <p className="mt-1 text-sm font-semibold">{head}</p>
              <p className="mt-0.5 text-muted-foreground">{body}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close the guide"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex flex-1 gap-1" aria-hidden="true">
              {steps.map((_, k) => (
                <span
                  key={k}
                  className={`h-1 flex-1 rounded-full ${k === i ? "bg-accent" : "bg-border"}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setI((k) => Math.max(0, k - 1))}
              disabled={i === 0}
              className="min-h-9 rounded-full border border-border px-3 disabled:opacity-40"
            >
              Back
            </button>
            {i < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setI((k) => k + 1)}
                className="min-h-9 rounded-full bg-primary px-3 font-semibold text-primary-foreground"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="min-h-9 rounded-full bg-primary px-3 font-semibold text-primary-foreground"
              >
                Got it
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}

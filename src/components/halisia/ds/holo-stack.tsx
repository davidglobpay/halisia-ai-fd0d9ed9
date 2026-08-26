import { useId, useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type HoloItem = {
  key: string;
  title: string;
  body?: ReactNode;
  meta?: string;
  icon?: LucideIcon;
  /** Optional 0-100 signal rendered as a hairline gold/green meter. */
  value?: number;
};

export type HoloStackProps = {
  /** Anchor id for in-page navigation. */
  id?: string;
  eyebrow: string;
  title: ReactNode;
  /** One-line summary shown on the hero tile while collapsed. */
  intro?: string;
  /** Small right-aligned action (link, button). */
  action?: ReactNode;
  items?: HoloItem[];
  /** Custom rail content; takes precedence over `items`. */
  children?: ReactNode;
  defaultOpen?: boolean;
  itemClassName?: string;
  className?: string;
  "data-testid"?: string;
};

/**
 * Holographic stack: one hero tile carrying the section title, with the
 * detail tiles collapsed underneath. Expanding reveals a horizontally
 * scrolling rail so a dense section never floods the page on entry.
 */
export function HoloStack({
  id,
  eyebrow,
  title,
  intro,
  action,
  items,
  children,
  defaultOpen = false,
  itemClassName = "w-[260px] sm:w-[280px]",
  className,
  ...rest
}: HoloStackProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const count = items?.length;

  return (
    <section
      id={id}
      className={cn("mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-10 md:py-14", className)}
      data-testid={rest["data-testid"] ?? "holo-stack"}
      data-open={open ? "true" : "false"}
    >
      <div className="holo-hero relative overflow-hidden rounded-[28px] p-5 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-[11px] uppercase tracking-[0.28em] text-accent">{eyebrow}</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-4xl">{title}</h2>
            {intro && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{intro}</p>}
          </div>
          <div className="flex items-center gap-2">
            {action}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              data-testid="holo-toggle"
              className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/45 bg-accent/10 px-4 text-xs font-semibold text-foreground transition-colors hover:bg-accent/20"
            >
              {open ? "Collapse" : count ? `Reveal ${count} tiles` : "Reveal details"}
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform duration-300", open && "rotate-180")}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>

      <div
        id={panelId}
        hidden={!open}
        data-testid="holo-panel"
        className="holo-panel mt-4"
        role="group"
        aria-label={typeof title === "string" ? title : eyebrow}
      >
        <ul
          className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3"
          style={{ scrollbarWidth: "none" }}
        >
          {children
            ? children
            : (items ?? []).map((it) => (
                <li key={it.key} className={cn("shrink-0 snap-start", itemClassName)}>
                  <article className="holo-tile flex h-full flex-col rounded-2xl p-4">
                    {it.icon && (
                      <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-accent/30 bg-accent/10">
                        <it.icon className="h-4.5 w-4.5 text-accent" aria-hidden="true" />
                      </span>
                    )}
                    {it.meta && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {it.meta}
                      </span>
                    )}
                    <h3 className="mt-1 text-sm font-semibold leading-snug">{it.title}</h3>
                    {it.body && (
                      <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                        {it.body}
                      </div>
                    )}
                    {typeof it.value === "number" && (
                      <div className="mt-auto pt-4">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                            style={{ width: `${Math.max(0, Math.min(100, it.value))}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </article>
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}

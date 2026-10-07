import { OutputTools, OutputVisual, OutputIcon } from "@/components/halisia/output-tools";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type HoloDetail = {
  key: string;
  label: string;
  /** Short headline value (a score, a count, a status). */
  value?: ReactNode;
  /** Longer supporting copy. */
  body?: ReactNode;
  icon?: LucideIcon;
  /** Optional 0-100 signal rendered as a hairline meter. */
  meter?: number;
};

export type HoloTileProps = {
  /** `hero` is the large section title tile; `tile` is a rail card. */
  variant?: "hero" | "tile";
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  /** One-line summary shown while collapsed. */
  summary?: ReactNode;
  icon?: LucideIcon;
  /** Headline figure rendered on the right of the header. */
  value?: ReactNode;
  /** Optional 0-100 signal meter under the header. */
  meter?: number;
  /** Horizontally scrollable detail tiles revealed on expand. */
  details?: HoloDetail[];
  /** Custom expanded content; takes precedence over `details`. */
  children?: ReactNode;
  /** Extra control rendered in the header (link, button). */
  action?: ReactNode;
  /** Rendered under the expanded rail. */
  footer?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  detailClassName?: string;
  "data-testid"?: string;
};

/**
 * HoloTile — the shared holographic tile.
 *
 * A single collapsed tile carries the title, an optional signal, and a
 * summary. Clicking it reveals a horizontally scrolling rail of detail
 * tiles inside the same surface, so a dense section can stay one line tall
 * until the reader asks for more.
 */
export function HoloTile({
  variant = "tile",
  id,
  eyebrow,
  title,
  summary,
  icon: Icon,
  value,
  meter,
  details,
  children,
  action,
  footer,
  defaultOpen = false,
  className,
  detailClassName = "w-[200px] sm:w-[220px]",
  ...rest
}: HoloTileProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const hero = variant === "hero";
  const expandable = Boolean(children) || Boolean(details?.length);

  return (
    <section
      data-output-card
      id={id}
      data-testid={rest["data-testid"] ?? "holo-tile"}
      data-open={open ? "true" : "false"}
      className={cn(
        hero ? "holo-hero rounded-[28px] p-5 md:p-7" : "holo-tile rounded-2xl p-4",
        "relative scroll-mt-24 overflow-hidden",
        open && "holo-lit",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div
              className={cn(
                "uppercase tracking-[0.24em] text-accent",
                hero ? "text-[11px]" : "text-[10px]",
              )}
            >
              {eyebrow}
            </div>
          )}
          <div className="mt-1 flex items-center gap-2">
            {Icon ? (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10">
                <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
              </span>
            ) : (
              <OutputIcon subject={typeof title === "string" ? title : (eyebrow ?? "output")} />
            )}
            {hero ? (
              <h2 className="intaglio font-display text-2xl font-semibold tracking-tight md:text-4xl">
                {title}
              </h2>
            ) : (
              <h3 className="intaglio text-sm font-semibold leading-snug">{title}</h3>
            )}
          </div>
          {summary && (
            <div
              className={cn(
                "mt-2 leading-relaxed text-muted-foreground",
                hero ? "text-sm" : "text-[12px]",
              )}
            >
              {summary}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {value !== undefined && (
            <span
              className={cn(
                "font-display font-semibold text-foreground",
                hero ? "text-2xl" : "text-lg",
              )}
            >
              {value}
            </span>
          )}
          <OutputTools label={typeof title === "string" ? title : (eyebrow ?? "output")} />
          {action}
          {expandable && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              data-testid="holo-tile-toggle"
              className={cn(
                "focus-ring inline-flex items-center gap-1.5 rounded-full border border-accent/45 bg-accent/10 font-semibold text-foreground transition-colors hover:bg-accent/20",
                hero ? "min-h-11 px-4 text-xs" : "min-h-9 px-3 text-[11px]",
              )}
            >
              {open ? "Collapse" : details?.length ? `${details.length} details` : "Details"}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-300",
                  open && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      <OutputVisual
        subject={typeof title === "string" ? title : (eyebrow ?? "")}
        value={typeof summary === "string" ? summary : undefined}
      />
      {typeof meter === "number" && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            style={{ width: `${Math.max(0, Math.min(100, meter))}%` }}
          />
        </div>
      )}

      {expandable && (
        <div
          id={panelId}
          hidden={!open}
          data-testid="holo-tile-panel"
          className="holo-panel mt-3"
          role="group"
          aria-label={typeof title === "string" ? title : eyebrow}
        >
          {children ?? (
            <ul className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2">
              {(details ?? []).map((d) => (
                <li key={d.key} className={cn("shrink-0 snap-start", detailClassName)}>
                  <article
                    data-output-card
                    className="holo-tile flex h-full flex-col rounded-xl p-3"
                  >
                    <div className="flex items-center gap-2">
                      {d.icon ? (
                        <d.icon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                      ) : (
                        <OutputIcon subject={d.label} />
                      )}
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {d.label}
                      </span>
                    </div>
                    {d.value !== undefined && (
                      <div className="mt-1 font-display text-base font-semibold">{d.value}</div>
                    )}
                    {d.body && (
                      <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                        {d.body}
                      </div>
                    )}
                    <OutputVisual
                      subject={d.label}
                      value={typeof d.value === "string" ? d.value : undefined}
                    />
                    <OutputTools label={d.label} />
                    {typeof d.meter === "number" && (
                      <div className="mt-auto pt-3">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                            style={{
                              width: `${Math.max(0, Math.min(100, d.meter))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </article>
                </li>
              ))}
            </ul>
          )}
          {footer && <div className="mt-2 text-[11px] text-muted-foreground">{footer}</div>}
        </div>
      )}
    </section>
  );
}

/** Horizontal, snap-scrolling rail of HoloTiles (or any tile content). */
export function HoloTileRail({
  label,
  children,
  className,
  itemClassName = "w-[260px] sm:w-[300px]",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <ul
      aria-label={label}
      data-testid="holo-tile-rail"
      className={cn(
        "scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3",
        className,
      )}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <li key={i} className={cn("shrink-0 snap-start", itemClassName)}>
              {child}
            </li>
          ))
        : children}
    </ul>
  );
}

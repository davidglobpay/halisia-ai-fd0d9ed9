import { type ReactNode, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, type LucideIcon } from "lucide-react";
import { StatusBadge, type StatusKind } from "./status-badge";
import { ConfidenceIndicator } from "./confidence-indicator";

/**
 * Canonical dashboard widget:
 *   icon · title · primary metric · secondary metric · status
 *   confidence · AI explanation · last updated · actions
 *
 * Follows the HALISIA design-system spec so every future feature
 * (marketplace, financing, professional services, construction) can
 * plug in without re-inventing the card shell.
 */
export function MetricCard({
  icon: Icon,
  title,
  primary,
  secondary,
  status,
  confidencePct,
  aiExplanation,
  lastUpdated,
  actions,
  children,
  defaultOpen = false,
}: {
  icon?: LucideIcon;
  title: string;
  primary: ReactNode;
  secondary?: ReactNode;
  status?: StatusKind;
  confidencePct?: number;
  aiExplanation?: string;
  lastUpdated?: string;
  actions?: ReactNode;
  children?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expandable = Boolean(children || aiExplanation);

  return (
    <section
      className="glass rounded-2xl p-4 transition-shadow hover:shadow-[0_20px_50px_-20px_oklch(0.68_0.19_249/0.5)]"
      aria-label={title}
    >
      <header className="flex items-start gap-3">
        {Icon && (
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/5 border border-white/10">
            <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            {status && <StatusBadge kind={status} />}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <div className="text-xl font-bold tabular-nums leading-none">{primary}</div>
            {secondary && (
              <div className="text-xs text-muted-foreground tabular-nums">{secondary}</div>
            )}
          </div>
        </div>
        {confidencePct != null && <ConfidenceIndicator pct={confidencePct} compact />}
      </header>

      {aiExplanation && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground/80">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent" aria-hidden="true" />
          <span>{aiExplanation}</span>
        </p>
      )}

      {expandable && open && children && (
        <div className="mt-3 border-t border-white/10 pt-3">{children}</div>
      )}

      {(expandable || actions || lastUpdated) && (
        <footer className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          {lastUpdated ? <span>Updated {lastUpdated}</span> : <span />}
          <div className="flex items-center gap-2">
            {actions}
            {expandable && children && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {open ? "Collapse" : "Expand"}
                {open ? (
                  <ChevronUp className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </footer>
      )}
    </section>
  );
}

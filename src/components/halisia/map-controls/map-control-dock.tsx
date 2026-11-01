import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { Layers, Maximize2, Minimize2, X, type LucideIcon } from "lucide-react";
import {
  activeOverlayCount,
  fullscreenSupported,
  nextLayerSelection,
  type LayerSelectionKind,
} from "@/lib/map-controls";

export type DockAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
};

export type LayerOption = { id: string; label: string; hint?: string; disabled?: boolean };

export type LayerGroup = {
  id: string;
  title: string;
  kind: LayerSelectionKind;
  options: LayerOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

export type MapControlDockProps = {
  actions?: DockAction[];
  layers?: LayerGroup[];
  /** Attribution or caveats shown at the foot of the layer panel. */
  layerFootnote?: ReactNode;
  /** Element to put into fullscreen; omit to hide the fullscreen button. */
  fullscreenTarget?: RefObject<HTMLElement | null>;
  side?: "right" | "left";
  /** Distance from the top of the map, to clear other overlays. */
  topOffsetClass?: string;
  /** Stacking class; Leaflet maps need it above their 800-level controls. */
  zClass?: string;
  testId?: string;
};

const BTN =
  "inline-flex h-11 w-11 items-center justify-center text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

/**
 * Floating navigation and layer controls shared by every non-protected map and
 * 3D view: one look (HALISIA ivory card, green active state, gold layers
 * accent), 44 px touch targets, keyboard and screen-reader labels.
 */
export function MapControlDock({
  actions = [],
  layers = [],
  layerFootnote,
  fullscreenTarget,
  side = "right",
  topOffsetClass = "top-3",
  zClass = "z-[450]",
  testId = "map-control-dock",
}: MapControlDockProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fs = useFullscreen(fullscreenTarget);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const count = activeOverlayCount(layers);
  const sideClass = side === "right" ? "right-3" : "left-3";

  return (
    <div
      ref={rootRef}
      data-testid={testId}
      className={`pointer-events-auto absolute ${topOffsetClass} ${sideClass} ${zClass} flex flex-col items-end gap-2`}
    >
      {layers.length > 0 && (
        <button
          type="button"
          aria-label="Map layers"
          aria-expanded={open}
          aria-controls={panelId}
          title="Map layers"
          data-testid={`${testId}-layers`}
          onClick={() => setOpen((v) => !v)}
          className={`${BTN} relative rounded-full border border-border bg-card shadow-lg backdrop-blur-md ${open ? "ring-2 ring-accent" : ""}`}
        >
          <Layers className="h-5 w-5 text-accent" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-5 text-primary-foreground">
              {count}
            </span>
          )}
        </button>
      )}

      {(actions.length > 0 || fs.available) && (
        <div
          role="toolbar"
          aria-label="Map navigation"
          aria-orientation="vertical"
          className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg backdrop-blur-md"
        >
          {actions.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-label={a.label}
              title={a.label}
              aria-pressed={a.pressed}
              disabled={a.disabled}
              data-testid={`${testId}-${a.id}`}
              onClick={a.onClick}
              className={`${BTN} ${i > 0 ? "border-t border-border" : ""} ${a.pressed ? "bg-primary text-primary-foreground hover:bg-primary" : ""}`}
            >
              <a.icon className="h-5 w-5" />
            </button>
          ))}
          {fs.available && (
            <button
              type="button"
              aria-label={fs.active ? "Exit full screen" : "Full screen"}
              title={fs.active ? "Exit full screen" : "Full screen"}
              data-testid={`${testId}-fullscreen`}
              onClick={fs.toggle}
              className={`${BTN} ${actions.length ? "border-t border-border" : ""}`}
            >
              {fs.active ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          )}
        </div>
      )}

      {open && layers.length > 0 && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Map layers"
          data-testid={`${testId}-panel`}
          className={`absolute top-0 ${side === "right" ? "right-14" : "left-14"} max-h-[min(70vh,420px)] w-64 max-w-[calc(100vw-5rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3 text-sm text-card-foreground shadow-2xl backdrop-blur-md`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              Layers
            </span>
            <button
              type="button"
              aria-label="Close layers"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {layers.map((g) => (
            <fieldset key={g.id} className="mb-3 last:mb-0">
              <legend className="mb-1 text-xs font-medium text-muted-foreground">{g.title}</legend>
              <div className="flex flex-col gap-1">
                {g.options.map((o) => {
                  const on = g.selected.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role={g.kind === "single" ? "radio" : "checkbox"}
                      aria-checked={on}
                      disabled={o.disabled}
                      data-testid={`${testId}-layer-${g.id}-${o.id}`}
                      onClick={() =>
                        g.onChange(
                          nextLayerSelection(
                            g.kind,
                            g.options.map((x) => x.id),
                            g.selected,
                            o.id,
                          ),
                        )
                      }
                      className={`flex min-h-11 items-start gap-2 rounded-xl px-2 py-1.5 text-left transition disabled:opacity-40 ${on ? "bg-primary/10 text-foreground" : "hover:bg-muted"}`}
                    >
                      <span
                        aria-hidden
                        className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center border ${g.kind === "single" ? "rounded-full" : "rounded"} ${on ? "border-primary bg-primary" : "border-border bg-background"}`}
                      >
                        {on && (
                          <span
                            className={`h-1.5 w-1.5 bg-primary-foreground ${g.kind === "single" ? "rounded-full" : "rounded-sm"}`}
                          />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block">{o.label}</span>
                        {o.hint && (
                          <span className="block text-[11px] text-muted-foreground">{o.hint}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          {layerFootnote && (
            <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
              {layerFootnote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Fullscreen for a map container. Uses the browser API where it exists and
 * otherwise (iPhone Safari) pins the element over the page with CSS.
 */
function useFullscreen(target?: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  const native = typeof document !== "undefined" && fullscreenSupported(document);
  useEffect(() => {
    if (!target || !native) return;
    const sync = () => setActive(document.fullscreenElement === target.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [target, native]);
  const PSEUDO = [
    "!fixed",
    "!inset-0",
    "!z-[90]",
    "!m-0",
    "!h-[100dvh]",
    "!w-screen",
    "!max-w-none",
  ];
  const toggle = () => {
    const el = target?.current;
    if (!el) return;
    if (native) {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void el.requestFullscreen().catch(() => undefined);
      return;
    }
    const next = !active;
    PSEUDO.forEach((c) => el.classList.toggle(c, next));
    setActive(next);
    window.dispatchEvent(new Event("resize"));
  };
  return { available: !!target, active, toggle };
}

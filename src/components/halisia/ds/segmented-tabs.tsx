import { useCallback, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedTabItem {
  value: string;
  label: string;
  /** Marks the tab as an alert/risk context (red active state). */
  alert?: boolean;
}

export interface SegmentedTabsProps {
  items: SegmentedTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name for the tablist. */
  label: string;
  className?: string;
}

/**
 * SegmentedTabs — glass segmented control with full roving-tabindex keyboard
 * support (Arrow keys, Home/End). Use for view switching inside a panel.
 */
export function SegmentedTabs({
  items,
  value,
  onValueChange,
  label,
  className,
}: SegmentedTabsProps) {
  const groupId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const focusIndex = useCallback((index: number) => {
    const nodes = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    nodes?.[index]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const current = items.findIndex((i) => i.value === value);
      let next = -1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown")
        next = (current + 1) % items.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        next = (current - 1 + items.length) % items.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      if (next < 0) return;
      event.preventDefault();
      const item = items[next];
      if (!item) return;
      onValueChange(item.value);
      focusIndex(next);
    },
    [items, value, onValueChange, focusIndex],
  );

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("tabs-glass max-w-full flex-wrap", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            id={`${groupId}-${item.value}`}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "tab-item min-h-9",
              active && (item.alert ? "tab-item-active-alert" : "tab-item-active"),
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedTabs;

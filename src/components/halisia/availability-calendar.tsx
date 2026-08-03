import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, Trash2 } from "lucide-react";
import {
  WEEKDAYS,
  describeAvailability,
  describeViewings,
  isAvailableOn,
  monthGrid,
  newId,
  toIsoDate,
  windowFor,
  type AvailabilityWindow,
  type ViewingWindow,
} from "@/lib/rental-availability";

type Props = {
  availability: AvailabilityWindow[];
  viewings: ViewingWindow[];
  fallbackFrom?: string | null;
  editable?: boolean;
  onChange?: (next: { availability: AvailabilityWindow[]; viewings: ViewingWindow[] }) => void;
};

/**
 * Month calendar of available date ranges plus a weekly viewing-window editor.
 * Read-only for renters; editable for the landlord managing the vacancy.
 */
export function AvailabilityCalendar({
  availability,
  viewings,
  fallbackFrom = null,
  editable = false,
  onChange,
}: Props) {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const todayIso = toIsoDate(today);

  const emit = (a: AvailabilityWindow[], v: ViewingWindow[]) =>
    onChange?.({ availability: a, viewings: v });

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });

  return (
    <section
      data-testid="availability-calendar"
      className="rounded-2xl border border-white/10 bg-white/5 p-3.5"
      aria-label="Availability calendar"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <CalendarDays className="h-3 w-3" aria-hidden="true" /> Availability
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }))
            }
            className="rounded-full border border-white/10 p-1 hover:bg-white/10"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="min-w-[8.5rem] text-center text-xs font-medium">{monthLabel}</span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }))
            }
            className="rounded-full border border-white/10 p-1 hover:bg-white/10"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] text-accent">
        {describeAvailability(availability, fallbackFrom)}
      </p>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[9px] uppercase tracking-widest text-muted-foreground/70">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const free = isAvailableOn(c.iso, availability);
          const w = free ? windowFor(c.iso, availability) : null;
          return (
            <div
              key={c.iso}
              title={free ? (w?.note ?? `Available ${c.iso}`) : `Not available ${c.iso}`}
              className={`h-7 rounded-md border text-[10px] leading-7 ${
                !c.inMonth
                  ? "border-transparent text-muted-foreground/30"
                  : free
                    ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground"
              } ${c.iso === todayIso ? "ring-1 ring-accent" : ""}`}
            >
              {c.day}
            </div>
          );
        })}
      </div>

      {/* Availability ranges */}
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Date ranges
        </div>
        {availability.length === 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">No ranges set.</p>
        )}
        <ul className="mt-1.5 grid gap-1.5">
          {availability.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-2 text-[11px]">
              {editable ? (
                <>
                  <input
                    type="date"
                    aria-label="Available from"
                    value={w.start}
                    onChange={(e) =>
                      emit(
                        availability.map((x) =>
                          x.id === w.id ? { ...x, start: e.target.value } : x,
                        ),
                        viewings,
                      )
                    }
                    className="input !py-1 !text-[11px] w-[9.5rem]"
                  />
                  <span className="text-muted-foreground">→</span>
                  <input
                    type="date"
                    aria-label="Available until"
                    value={w.end ?? ""}
                    onChange={(e) =>
                      emit(
                        availability.map((x) =>
                          x.id === w.id ? { ...x, end: e.target.value || null } : x,
                        ),
                        viewings,
                      )
                    }
                    className="input !py-1 !text-[11px] w-[9.5rem]"
                  />
                  <input
                    aria-label="Range note"
                    placeholder="Note (optional)"
                    value={w.note ?? ""}
                    onChange={(e) =>
                      emit(
                        availability.map((x) =>
                          x.id === w.id ? { ...x, note: e.target.value } : x,
                        ),
                        viewings,
                      )
                    }
                    className="input !py-1 !text-[11px] flex-1 min-w-[8rem]"
                  />
                  <button
                    type="button"
                    aria-label="Remove range"
                    onClick={() =>
                      emit(
                        availability.filter((x) => x.id !== w.id),
                        viewings,
                      )
                    }
                    className="text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {w.start} → {w.end ?? "open ended"}
                  {w.note ? ` · ${w.note}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <button
            type="button"
            onClick={() => {
              const start = toIsoDate(new Date());
              emit([...availability, { id: newId(), start, end: null }], viewings);
            }}
            className="mt-2 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] text-accent"
          >
            <Plus className="h-3 w-3" aria-hidden="true" /> Add date range
          </button>
        )}
      </div>

      {/* Viewing windows */}
      <div className="mt-3">
        <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" /> Viewing windows
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{describeViewings(viewings)}</p>
        {editable && (
          <>
            <ul className="mt-1.5 grid gap-1.5">
              {viewings.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                  <select
                    aria-label="Viewing day"
                    value={v.weekday}
                    onChange={(e) =>
                      emit(
                        availability,
                        viewings.map((x) =>
                          x.id === v.id ? { ...x, weekday: Number(e.target.value) } : x,
                        ),
                      )
                    }
                    className="input !py-1 !text-[11px] w-24"
                  >
                    {WEEKDAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    aria-label="Viewing start time"
                    value={v.from}
                    onChange={(e) =>
                      emit(
                        availability,
                        viewings.map((x) => (x.id === v.id ? { ...x, from: e.target.value } : x)),
                      )
                    }
                    className="input !py-1 !text-[11px] w-28"
                  />
                  <input
                    type="time"
                    aria-label="Viewing end time"
                    value={v.to}
                    onChange={(e) =>
                      emit(
                        availability,
                        viewings.map((x) => (x.id === v.id ? { ...x, to: e.target.value } : x)),
                      )
                    }
                    className="input !py-1 !text-[11px] w-28"
                  />
                  <button
                    type="button"
                    aria-label="Remove viewing window"
                    onClick={() =>
                      emit(
                        availability,
                        viewings.filter((x) => x.id !== v.id),
                      )
                    }
                    className="text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                emit(availability, [
                  ...viewings,
                  { id: newId(), weekday: 6, from: "10:00", to: "13:00" },
                ])
              }
              className="mt-2 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] text-accent"
            >
              <Plus className="h-3 w-3" aria-hidden="true" /> Add viewing window
            </button>
          </>
        )}
      </div>
    </section>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarPlus, Check, Clock, Loader2, Trash2, X } from "lucide-react";
import {
  createSlot,
  deleteSlot,
  isPast,
  listRequestsForProperty,
  listSlots,
  requestSlot,
  setRequestStatus,
  slotLabel,
  slotSeatsLeft,
  updateSlot,
  type ViewingSlot,
} from "@/lib/viewing-slots";
import { useAuth } from "@/hooks/use-auth";

const STATUS_TONE: Record<string, string> = {
  requested: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  confirmed: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  declined: "border-red-400/40 bg-red-400/10 text-red-200",
  cancelled: "border-white/15 bg-white/5 text-muted-foreground",
};

function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Booking-style viewing workflow: landlords propose concrete time slots,
 * renters request one, and the landlord confirms or declines.
 */
export function ViewingBooking({
  propertyId,
  mode,
}: {
  propertyId: string;
  mode: "owner" | "renter";
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const slotsKey = ["viewing-slots", propertyId];
  const reqKey = ["viewing-requests", propertyId];
  const slotsQ = useQuery({ queryKey: slotsKey, queryFn: () => listSlots(propertyId) });
  const reqQ = useQuery({
    queryKey: reqKey,
    queryFn: () => listRequestsForProperty(propertyId),
  });

  const start = new Date(Date.now() + 86400_000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  const [from, setFrom] = useState(localInput(start));
  const [to, setTo] = useState(localInput(end));
  const [capacity, setCapacity] = useState(1);
  const [note, setNote] = useState("");
  const [pendingNote, setPendingNote] = useState<Record<string, string>>({});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: slotsKey });
    qc.invalidateQueries({ queryKey: reqKey });
  };

  const addM = useMutation({
    mutationFn: () =>
      createSlot({
        propertyId,
        startAt: new Date(from).toISOString(),
        endAt: new Date(to).toISOString(),
        capacity,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      setNote("");
      invalidate();
    },
  });
  const bookM = useMutation({
    mutationFn: (slot: ViewingSlot) =>
      requestSlot({ slot, notes: pendingNote[slot.id]?.trim() || null }),
    onSuccess: invalidate,
  });
  const statusM = useMutation({
    mutationFn: (v: { id: string; status: "confirmed" | "declined" | "cancelled" }) =>
      setRequestStatus(v.id, v.status),
    onSuccess: invalidate,
  });

  const slots = (slotsQ.data ?? []).filter((s) => mode === "owner" || !isPast(s));
  const requests = reqQ.data ?? [];
  const myRequestFor = (slotId: string) =>
    requests.find((r) => r.slot_id === slotId && r.buyer_id === user?.id) ?? null;

  return (
    <section
      data-testid="viewing-booking"
      className="rounded-2xl border border-white/10 bg-white/5 p-3.5"
      aria-label="Viewing bookings"
    >
      <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Clock className="h-3 w-3" aria-hidden="true" /> Viewing slots
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {mode === "owner"
          ? "Propose specific time slots. Renters request a slot and you confirm or decline."
          : "Pick a proposed slot and request confirmation from the landlord."}
      </p>

      {mode === "owner" && (
        <form
          className="mt-2.5 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addM.mutate();
          }}
        >
          <label className="grid gap-1 text-[10px] text-muted-foreground">
            Starts
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input !py-1 !text-[11px]"
            />
          </label>
          <label className="grid gap-1 text-[10px] text-muted-foreground">
            Ends
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input !py-1 !text-[11px]"
            />
          </label>
          <label className="grid gap-1 text-[10px] text-muted-foreground">
            Capacity
            <input
              type="number"
              min={1}
              max={20}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="input !py-1 !text-[11px] w-20"
            />
          </label>
          <input
            aria-label="Slot note"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input !py-1 !text-[11px] flex-1 min-w-[8rem]"
          />
          <button
            type="submit"
            data-testid="add-viewing-slot"
            disabled={addM.isPending}
            className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] text-accent disabled:opacity-50"
          >
            {addM.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <CalendarPlus className="h-3 w-3" aria-hidden="true" />
            )}
            Propose slot
          </button>
        </form>
      )}
      {addM.error && (
        <p className="mt-1.5 text-[10px] text-red-300">{(addM.error as Error).message}</p>
      )}

      {(slotsQ.isLoading || reqQ.isLoading) && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading slots…
        </div>
      )}
      {slotsQ.data && slots.length === 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {mode === "owner"
            ? "No slots proposed yet."
            : "The landlord has not proposed any viewing slots yet — use the contact details instead."}
        </p>
      )}

      <ul className="mt-2.5 grid gap-2">
        {slots.map((s) => {
          const seats = slotSeatsLeft(s, requests);
          const mine = myRequestFor(s.id);
          const slotRequests = requests.filter((r) => r.slot_id === s.id);
          const closed = s.status !== "open" || seats === 0 || isPast(s);
          return (
            <li
              key={s.id}
              data-testid="viewing-slot"
              className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium">{slotLabel(s)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {seats} of {s.capacity} place(s) left
                    {s.note ? ` · ${s.note}` : ""}
                    {isPast(s) ? " · past" : s.status !== "open" ? " · closed" : ""}
                  </div>
                </div>
                {mode === "owner" ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateSlot(s.id, { status: s.status === "open" ? "closed" : "open" }).then(
                          invalidate,
                        )
                      }
                      className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px]"
                    >
                      {s.status === "open" ? "Close" : "Reopen"}
                    </button>
                    <button
                      type="button"
                      aria-label="Delete slot"
                      onClick={() => {
                        if (confirm("Delete this slot?")) void deleteSlot(s.id).then(invalidate);
                      }}
                      className="text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ) : mine ? (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_TONE[mine.status] ?? STATUS_TONE["cancelled"]}`}
                  >
                    {mine.status}
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid="request-viewing"
                    disabled={closed || bookM.isPending}
                    onClick={() => bookM.mutate(s)}
                    className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[10px] text-accent disabled:opacity-40"
                  >
                    {closed ? "Unavailable" : "Request this slot"}
                  </button>
                )}
              </div>

              {mode === "renter" && !mine && !closed && (
                <input
                  aria-label="Message to the landlord"
                  placeholder="Optional message to the landlord"
                  value={pendingNote[s.id] ?? ""}
                  onChange={(e) => setPendingNote((m) => ({ ...m, [s.id]: e.target.value }))}
                  className="input !py-1 !text-[10px] mt-1.5 w-full"
                />
              )}

              {mode === "owner" && slotRequests.length > 0 && (
                <ul className="mt-2 grid gap-1.5">
                  {slotRequests.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[10px]"
                    >
                      <span className="min-w-0 text-muted-foreground">
                        Request{r.notes ? `: ${r.notes}` : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 ${STATUS_TONE[r.status] ?? STATUS_TONE["cancelled"]}`}
                        >
                          {r.status}
                        </span>
                        {r.status === "requested" && (
                          <>
                            <button
                              type="button"
                              onClick={() => statusM.mutate({ id: r.id, status: "confirmed" })}
                              className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
                            >
                              <Check className="h-3 w-3" aria-hidden="true" /> Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => statusM.mutate({ id: r.id, status: "declined" })}
                              className="inline-flex items-center gap-1 text-red-300 hover:underline"
                            >
                              <X className="h-3 w-3" aria-hidden="true" /> Decline
                            </button>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {bookM.error && (
        <p className="mt-1.5 text-[10px] text-red-300">{(bookM.error as Error).message}</p>
      )}
    </section>
  );
}

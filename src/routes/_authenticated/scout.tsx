import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  previewQuote,
  SCOUT_TASKS,
  type AccessLevel,
  type ChecklistChoice,
} from "@/lib/scout-pricing";

type Search = { ref?: string; county?: string; src?: string; lat?: number; lng?: number };

export const Route = createFileRoute("/_authenticated/scout")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
    county: typeof s.county === "string" ? s.county : undefined,
    src: typeof s.src === "string" ? s.src : undefined,
    lat: s.lat != null && !isNaN(Number(s.lat)) ? Number(s.lat) : undefined,
    lng: s.lng != null && !isNaN(Number(s.lng)) ? Number(s.lng) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Send a Scout — HALISIA" },
      { name: "description", content: "Book a vetted field scout to observe a plot in person." },
      { property: "og:title", content: "Send a Scout — HALISIA" },
      { property: "og:description", content: "Book a vetted field scout to observe a plot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScoutPage,
});

type Req = {
  id: string;
  title_reference: string | null;
  county: string | null;
  status: string;
  quote: { total_kes?: number };
  payment_reference: string | null;
  buyer_id: string;
  scout_id: string | null;
};

const DRAFT_KEY = "halisia-scout-draft";

function ScoutPage() {
  const s = Route.useSearch();
  const [uid, setUid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, ChecklistChoice>>({});
  const [access, setAccess] = useState<AccessLevel>("easy");
  const [travel, setTravel] = useState(0);
  const [lat, setLat] = useState(s.lat?.toString() ?? "");
  const [lng, setLng] = useState(s.lng?.toString() ?? "");
  const [instructions, setInstructions] = useState("");
  const [custom, setCustom] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [rows, setRows] = useState<Req[]>([]);
  const [busy, setBusy] = useState(false);

  // Preserve form progress on weak connections (server remains the record).
  useEffect(() => {
    const d = localStorage.getItem(DRAFT_KEY);
    if (d) {
      try {
        const v = JSON.parse(d);
        setChecklist(v.checklist ?? {});
        setInstructions(v.instructions ?? "");
        setCustom(v.custom ?? "");
      } catch {
        /* ignore */
      }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ checklist, instructions, custom }));
  }, [checklist, instructions, custom]);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    setUid(u.user?.id ?? null);
    if (u.user) {
      const { data: a } = await supabase.rpc("has_role", {
        _user_id: u.user.id,
        _role: "administrator",
      });
      setIsAdmin(Boolean(a));
    }
    const { data } = await supabase
      .from("scout_requests")
      .select("id,title_reference,county,status,quote,payment_reference,buyer_id,scout_id")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as unknown as Req[]);
  };
  useEffect(() => {
    void load();
  }, []);

  const q = previewQuote(checklist, access, travel);
  const hasCoords = lat !== "" && lng !== "";
  const locSource = !hasCoords
    ? "directions_only"
    : s.src === "manual_pin"
      ? "manual_pin"
      : s.src === "approximate_geocode" && lat === String(s.lat)
        ? "approximate_geocode"
        : "explicit_coordinates";

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("scout_create_request", {
      p_title_reference: s.ref ?? "",
      p_county: s.county ?? "",
      p_location_source: locSource,
      p_lat: hasCoords ? Number(lat) : (null as unknown as number),
      p_lng: hasCoords ? Number(lng) : (null as unknown as number),
      p_location_confirmed: confirmed,
      p_instructions: instructions,
      p_custom_concern: custom,
      p_checklist: checklist,
      p_access_level: access,
      p_travel_kes: travel,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    localStorage.removeItem(DRAFT_KEY);
    toast.success("Request created with a server-calculated quote");
    void load();
  };

  const act = async (id: string, action: string, payload: Record<string, unknown> = {}) => {
    const { error } = await supabase.rpc("scout_transition", {
      p_id: id,
      p_action: action,
      p_payload: payload as never,
    });
    if (error) toast.error(error.message);
    else void load();
  };

  const kes = (n: number) => `KES ${n.toLocaleString()}`;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-24">
      <Link to="/contributions" className="text-xs text-muted-foreground">
        ← Contributor dashboard
      </Link>
      <h1 className="mt-2 font-display text-3xl font-semibold">Send a Scout</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A person visits and records what they see and hear. This is field observation, not a
        survey, title search or ownership verification.
      </p>

      <section className="glass mt-6 grid gap-4 rounded-2xl p-4">
        <div className="text-xs">
          Reference: <b>{s.ref || "—"}</b> · County: <b>{s.county || "—"}</b>
        </div>
        {s.src === "approximate_geocode" && (
          <p className="text-xs text-amber-glow">
            These coordinates are an approximate area match, not the parcel. Correct them or add
            directions.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Latitude
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-transparent px-3 py-3"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="text-xs">
            Longitude
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-transparent px-3 py-3"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              inputMode="decimal"
            />
          </label>
        </div>
        <label className="text-xs">
          Directions / instructions for the scout
          <textarea
            className="mt-1 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Checklist (suggested pilot pricing)</legend>
          <div className="text-xs">Base visit — 8 photos + 1 short video · {kes(1000)}</div>
          {SCOUT_TASKS.map((t) => (
            <div key={t.code} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                {t.label} · {kes(t.kes)}
              </span>
              <select
                aria-label={t.label}
                className="min-h-12 rounded-xl border border-white/15 bg-transparent px-2"
                value={checklist[t.code] ?? "not"}
                onChange={(e) =>
                  setChecklist({ ...checklist, [t.code]: e.target.value as ChecklistChoice })
                }
              >
                <option value="check">Check this</option>
                <option value="unsure">Unsure — investigate</option>
                <option value="not">Not requested</option>
              </select>
            </div>
          ))}
          {(checklist.custom ?? "not") !== "not" && (
            <input
              placeholder="Describe your concern"
              className="rounded-xl border border-white/15 bg-transparent px-3 py-3"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Access (estimate, scout confirms)
            <select
              className="mt-1 min-h-12 w-full rounded-xl border border-white/15 bg-transparent px-2"
              value={access}
              onChange={(e) => setAccess(e.target.value as AccessLevel)}
            >
              <option value="easy">Easy (KES 0)</option>
              <option value="difficult">Difficult (KES 500)</option>
              <option value="remote">Remote (KES 1,500)</option>
            </select>
          </label>
          <label className="text-xs">
            Travel at cost (estimate, KES)
            <input
              type="number"
              min={0}
              className="mt-1 min-h-12 w-full rounded-xl border border-white/15 bg-transparent px-3"
              value={travel}
              onChange={(e) => setTravel(Number(e.target.value))}
            />
          </label>
        </div>

        <dl className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 p-3 text-sm">
          <dt>Scout work (base + activities)</dt>
          <dd className="text-right">{kes(q.scoutWorkKes)}</dd>
          <dt>Travel + access (estimates)</dt>
          <dd className="text-right">{kes(q.travelKes + q.accessKes)}</dd>
          <dt>Scout earnings</dt>
          <dd className="text-right">{kes(q.scoutEarningsKes)}</dd>
          <dt>HALISIA fee (15% of scout work)</dt>
          <dd className="text-right">{kes(q.platformFeeKes)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">{kes(q.totalKes)}</dd>
        </dl>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I confirm this is the place I want visited. I understand it is not a verified parcel
          location.
        </label>
        <button
          disabled={busy || !confirmed}
          onClick={submit}
          className="min-h-12 rounded-full bg-primary px-4 text-primary-foreground disabled:opacity-50"
        >
          Request quote
        </button>
        <p className="text-[11px] text-muted-foreground">
          Automatic Globpay checkout and payouts are not configured yet. You pay by M-Pesa or bank
          and enter the reference; an administrator verifies it manually before a scout is
          assigned.
        </p>
      </section>

      <section className="mt-8 grid gap-3">
        <h2 className="font-display text-xl">Requests & jobs</h2>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-4 text-sm">
            <div className="flex justify-between gap-2">
              <span>{r.title_reference || "Unreferenced plot"} · {r.county || "—"}</span>
              <span className="font-mono text-xs">{r.status}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Total {kes(Number(r.quote?.total_kes ?? 0))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {r.buyer_id === uid && r.status === "quoted" && (
                <Btn onClick={() => act(r.id, "accept_quote")}>Accept quote</Btn>
              )}
              {r.buyer_id === uid && r.status === "payment_pending" && (
                <Btn
                  onClick={() => {
                    const ref = prompt("Payment reference (e.g. M-Pesa code)");
                    if (ref) void act(r.id, "submit_payment_reference", { reference: ref });
                  }}
                >
                  {r.payment_reference ? "Update payment ref" : "Enter payment ref"}
                </Btn>
              )}
              {isAdmin && r.status === "payment_pending" && r.payment_reference && (
                <Btn onClick={() => act(r.id, "verify_payment")}>Verify payment</Btn>
              )}
              {r.status === "payment_verified" && r.buyer_id !== uid && !r.scout_id && (
                <Btn
                  onClick={() => {
                    const c = prompt('Conflict of interest disclosure (write "none" if none)');
                    if (c) void act(r.id, "claim", { conflict_disclosure: c });
                  }}
                >
                  Claim job
                </Btn>
              )}
              {r.scout_id === uid && r.status === "assigned" && (
                <Btn onClick={() => act(r.id, "start")}>Start visit</Btn>
              )}
              {isAdmin && r.status === "submitted" && (
                <>
                  <Btn onClick={() => act(r.id, "accept_report")}>Accept report</Btn>
                  <Btn
                    onClick={() => {
                      const n = prompt("Corrections needed");
                      if (n) void act(r.id, "request_corrections", { note: n });
                    }}
                  >
                    Request corrections
                  </Btn>
                </>
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="min-h-12 rounded-full border border-white/20 px-4 text-xs hover:bg-white/10"
    >
      {children}
    </button>
  );
}

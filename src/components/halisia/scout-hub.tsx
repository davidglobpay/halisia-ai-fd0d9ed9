import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Request = Database["public"]["Tables"]["scout_requests"]["Row"] & {
  paid_amount_kes?: number;
  refund_status?: string;
  refund_reference?: string;
  refund_amount_kes?: number;
};
type Evidence = Database["public"]["Tables"]["scout_evidence"]["Row"];
type Profile = Database["public"]["Tables"]["scout_profiles"]["Row"];
type Finding = {
  status: "observed" | "blocked";
  note?: string;
  reason?: string;
  contradicts_ai?: boolean;
};
type Quote = {
  total_kes?: number;
  scout_earnings_kes?: number;
  travel_kes?: number;
  access_kes?: number;
  platform_fee_kes?: number;
  scout_work_kes?: number;
  reason?: string;
  tasks?: { code: string; label: string; amount_kes: number }[];
};
const control =
  "mt-1 w-full min-h-11 rounded-xl border border-white/20 bg-card px-3 py-2 text-sm";
/**
 * A money figure, or an em dash when there is no figure to show.
 *
 * This used to coerce a missing value to zero, so "nothing has been paid" and
 * "this field is absent from the quote" both rendered as KES 0. On the
 * Verified received row those are very different things for a buyer to read,
 * and the one that is actually dangerous — no record at all — looked like the
 * reassuring one.
 */
const kes = (n: unknown) => {
  if (n == null || n === "") return "\u2014";
  const v = Number(n);
  return Number.isFinite(v) ? `KES ${v.toLocaleString("en-KE")}` : "\u2014";
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const asObject = (v: Json | null) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};
function Button({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-11 rounded-xl border border-accent/40 px-4 py-2 text-sm disabled:opacity-40 hover:bg-accent/10"
    >
      {children}
    </button>
  );
}

export function ScoutHub({
  uid,
  isAdmin,
  initialJob,
}: {
  uid: string;
  isAdmin: boolean;
  initialJob?: string;
}) {
  const qc = useQueryClient();
  const [job, setJob] = useState(initialJob ?? "");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["scout-hub", uid],
    queryFn: async () => {
      const [requests, profiles, settings, catalog] = await Promise.all([
        supabase
          .from("scout_requests")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("scout_profiles").select("*"),
        supabase.from("scout_service_settings").select("*").single(),
        supabase.from("scout_price_catalog").select("*").order("sort"),
      ]);
      for (const res of [requests, profiles, settings, catalog])
        if (res.error) throw new Error(res.error.message);
      return {
        requests: (requests.data ?? []) as Request[],
        profiles: profiles.data ?? [],
        settings: settings.data!,
        catalog: catalog.data ?? [],
      };
    },
    refetchInterval: 30000,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["scout-hub"] });
    void qc.invalidateQueries({ queryKey: ["scout-catalog"] });
    void qc.invalidateQueries({ queryKey: ["scout-settings"] });
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      refresh();
      toast.success("Saved");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  };
  if (query.isPending)
    return (
      <p className="mt-6" role="status">
        Loading scout service…
      </p>
    );
  if (query.error)
    return (
      <div role="alert" className="mt-6">
        <p>{query.error.message}</p>
        <Button onClick={() => void query.refetch()}>Retry</Button>
      </div>
    );
  const d = query.data!;
  const profile = d.profiles.find((p) => p.user_id === uid);
  const selected = d.requests.find((r) => r.id === job);
  return (
    <section className="mt-8 space-y-6" aria-label="Scout workspace">
      <details className="glass rounded-2xl p-4">
        <summary className="cursor-pointer text-lg">
          Register / manage your scout profile
        </summary>
        <ScoutRegistration uid={uid} profile={profile} save={run} busy={busy} />
      </details>
      {isAdmin && (
        <details className="glass rounded-2xl p-4">
          <summary className="cursor-pointer text-lg">
            Administration: scouts, prices and payment instructions
          </summary>
          <AdminSetup data={d} save={run} busy={busy} />
        </details>
      )}
      {!d.settings.payments_enabled && (
        <p className="rounded-xl border border-amber-400/40 p-4 text-sm">
          Quote-only mode. HALISIA has not configured payment instructions. Do
          not send money yet. Requests can still be saved for review.
        </p>
      )}
      <h2 className="text-xl font-semibold">
        Your requests and available jobs
      </h2>
      {d.requests.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No requests yet. Create a request above, or register as a scout to see
          eligible jobs after approval.
        </p>
      )}
      <div className="grid gap-3">
        {d.requests.map((r) => (
          <button
            type="button"
            key={r.id}
            onClick={() => setJob(r.id)}
            className={`rounded-2xl border p-4 text-left ${job === r.id ? "border-accent" : "border-white/15"}`}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <b>
                {r.title_reference || "Site visit"} ·{" "}
                {r.county || "County not specified"}
              </b>
              <span>{r.status.replaceAll("_", " ")}</span>
            </div>
            <p className="mt-1 text-sm">
              {kes((r.quote as Quote).total_kes)} ·{" "}
              {r.buyer_id === uid
                ? "Your request"
                : r.scout_id === uid
                  ? "Your assignment"
                  : "Available job"}
            </p>
          </button>
        ))}
      </div>
      {selected && (
        <ScoutJob
          key={selected.id}
          request={selected}
          uid={uid}
          admin={isAdmin}
          approved={profile?.status === "approved"}
          settings={d.settings}
          refresh={refresh}
        />
      )}
    </section>
  );
}

function ScoutRegistration({
  uid,
  profile,
  save,
  busy,
}: {
  uid: string;
  profile?: Profile;
  save: (a: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  const [name, setName] = useState(profile?.display_name ?? "");
  const [counties, setCounties] = useState(
    profile?.service_counties.join(", ") ?? "",
  );
  const [availability, setAvailability] = useState(profile?.availability ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save(async () => {
          const fields = {
            display_name: name.trim(),
            service_counties: counties
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean),
            availability,
            bio,
          };
          if (!fields.display_name || !fields.service_counties.length)
            throw new Error("Enter your name and at least one service county");
          const res = profile
            ? await supabase
                .from("scout_profiles")
                .update(fields)
                .eq("user_id", uid)
            : await supabase
                .from("scout_profiles")
                .insert({ ...fields, user_id: uid });
          if (res.error) throw new Error(res.error.message);
        });
      }}
    >
      <p className="text-sm">
        Approval: {profile?.status ?? "Not registered"}. Only approved scouts
        can take jobs. {profile?.reviewer_note}
      </p>
      <label className="block text-sm">
        Display name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={control}
        />
      </label>
      <label className="block text-sm">
        Service counties, separated by commas
        <input
          required
          placeholder="Kajiado, Machakos, Nairobi"
          value={counties}
          onChange={(e) => setCounties(e.target.value)}
          className={control}
        />
      </label>
      <label className="block text-sm">
        Availability
        <input
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          className={control}
        />
      </label>
      <label className="block text-sm">
        Experience and equipment
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={control}
        />
      </label>
      <button
        disabled={busy}
        className="min-h-11 rounded-xl bg-primary px-4 text-primary-foreground"
      >
        Save scout profile
      </button>
    </form>
  );
}

function AdminSetup({
  data,
  save,
  busy,
}: {
  data: {
    profiles: Profile[];
    settings: { payment_instructions: string; payments_enabled: boolean };
    catalog: Database["public"]["Tables"]["scout_price_catalog"]["Row"][];
  };
  save: (a: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  const [instructions, setInstructions] = useState(
    data.settings.payment_instructions,
  );
  const [enabled, setEnabled] = useState(data.settings.payments_enabled);
  return (
    <div className="mt-4 space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(async () => {
            const r = await supabase
              .from("scout_service_settings")
              .update({
                payment_instructions: instructions,
                payments_enabled: enabled,
                updated_at: new Date().toISOString(),
              })
              .eq("id", true);
            if (r.error) throw new Error(r.error.message);
          });
        }}
        className="space-y-3"
      >
        <label className="block text-sm">
          Actual payee and payment instructions
          <textarea
            required={enabled}
            minLength={enabled ? 15 : undefined}
            className={control}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Verified account name, bank/account or M-Pesa destination, reference instructions"
          />
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />{" "}
          Enable manual payments after verifying these instructions
        </label>
        <button disabled={busy} className="min-h-11 rounded-xl border px-4">
          Save payment settings
        </button>
      </form>
      <h3 className="font-semibold">Scout approvals</h3>
      {data.profiles.map((p) => (
        <div key={p.user_id} className="rounded-xl border border-white/15 p-3">
          <p>
            {p.display_name} · {p.status} · {p.service_counties.join(", ")}
          </p>
          <p className="text-sm">
            {p.bio} · {p.availability}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["approved", "suspended"].map((status) => (
              <Button
                key={status}
                disabled={busy}
                onClick={() => {
                  const note = window.prompt("Verification/review note");
                  if (!note?.trim()) return;
                  void save(async () => {
                    const r = await supabase
                      .from("scout_profiles")
                      .update({
                        status: status as "approved" | "suspended",
                        reviewer_note: note,
                      })
                      .eq("user_id", p.user_id);
                    if (r.error) throw new Error(r.error.message);
                  });
                }}
              >
                {status === "approved" ? "Approve scout" : "Suspend scout"}
              </Button>
            ))}
          </div>
        </div>
      ))}
      <h3 className="font-semibold">Pilot price catalog</h3>
      {data.catalog.map((p) => (
        <form
          key={p.code}
          className="flex flex-wrap items-center gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void save(async () => {
              const amount = Number(form.get("amount"));
              if (
                !Number.isFinite(amount) ||
                amount < 0 ||
                (p.kind === "fee" && amount > 100)
              )
                throw new Error("Invalid amount");
              const r = await supabase
                .from("scout_price_catalog")
                .update({ amount_kes: amount })
                .eq("code", p.code);
              if (r.error) throw new Error(r.error.message);
            });
          }}
        >
          <label className="flex-1">
            {p.label}
            <input
              name="amount"
              type="number"
              min="0"
              max={p.kind === "fee" ? 100 : 100000}
              required
              defaultValue={p.amount_kes}
              className={control}
            />
          </label>
          <button disabled={busy} className="min-h-11 rounded-xl border px-3">
            Update
          </button>
        </form>
      ))}
    </div>
  );
}

function ScoutJob({
  request: r,
  uid,
  admin,
  approved,
  settings,
  refresh,
}: {
  request: Request;
  uid: string;
  admin: boolean;
  approved: boolean;
  settings: { payment_instructions: string; payments_enabled: boolean };
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Record<string, Finding>>(
    asObject(r.task_results) as Record<string, Finding>,
  );
  const [summary, setSummary] = useState(r.scout_summary ?? "");
  const [exception, setException] = useState(
    r.evidence_exception_requested ?? "",
  );
  const [travel, setTravel] = useState(
    Number((r.quote as Quote).travel_kes ?? 0),
  );
  const [access, setAccess] = useState(r.access_level);
  const [reason, setReason] = useState("");
  const [payRef, setPayRef] = useState("");
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState("");
  const evidenceQ = useQuery({
    queryKey: ["scout-evidence", r.id],
    queryFn: async () => {
      const a = await supabase
        .from("scout_evidence")
        .select("*")
        .eq("request_id", r.id)
        .order("captured_at");
      if (a.error) throw new Error(a.error.message);
      return a.data ?? [];
    },
    enabled: uid === r.buyer_id || uid === r.scout_id || admin,
  });
  const evidence = evidenceQ.data ?? [];
  const quote = r.quote as Quote;
  const buyer = r.buyer_id === uid;
  const scout = r.scout_id === uid;
  const editable =
    scout &&
    approved &&
    ["in_progress", "corrections_requested"].includes(r.status);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await f();
      refresh();
      await evidenceQ.refetch();
      toast.success("Saved");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const act = async (action: string, payload: Record<string, unknown> = {}) => {
    const res = await supabase.rpc("scout_transition", {
      p_id: r.id,
      p_action: action,
      p_payload: payload as Json,
    });
    if (res.error) throw new Error(res.error.message);
  };
  const promptAct = (action: string, label: string, key = "reference") => {
    const value = window.prompt(label);
    if (value?.trim()) void run(() => act(action, { [key]: value }));
  };
  const tasks = [
    { code: "base", label: "Site overview" },
    ...(quote.tasks ?? []),
  ];
  return (
    <article
      className="glass space-y-4 rounded-2xl p-4 sm:p-6"
      aria-label="Selected scout request"
    >
      <h3 className="text-xl font-semibold">
        {r.title_reference || "Site visit"} · {r.status.replaceAll("_", " ")}
      </h3>
      <p className="break-all text-sm">Request {r.id}</p>
      <p className="text-sm">
        Visit location:{" "}
        {r.lat != null ? `${r.lat}, ${r.lng}` : "Directions only"} ·{" "}
        {r.location_source}. {r.instructions}
      </p>
      <p className="text-sm">Custom concern: {r.custom_concern || "None"}</p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt>Scout work</dt>
        <dd>{kes(quote.scout_work_kes)}</dd>
        <dt>Travel / access</dt>
        <dd>
          {kes(Number(quote.travel_kes ?? 0) + Number(quote.access_kes ?? 0))}
        </dd>
        <dt>HALISIA fee</dt>
        <dd>{kes(quote.platform_fee_kes)}</dd>
        <dt>Total</dt>
        <dd>{kes(quote.total_kes)}</dd>
        <dt>Verified received</dt>
        <dd>{kes(r.paid_amount_kes)}</dd>
        <dt>Amount still due</dt>
        <dd>
          {kes(
            Math.max(
              0,
              Number(quote.total_kes ?? 0) - Number(r.paid_amount_kes ?? 0),
            ),
          )}
        </dd>
        <dt>Scout earnings</dt>
        <dd>{kes(quote.scout_earnings_kes)}</dd>
        <dt>Payout / refund</dt>
        <dd>
          {r.payout_status} / {r.refund_status ?? "none"}
        </dd>
      </dl>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/50 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {r.reviewer_note && (
        <p className="text-sm">Reviewer: {r.reviewer_note}</p>
      )}
      {buyer && r.status === "quoted" && (
        <Button
          disabled={busy || !settings.payments_enabled}
          onClick={() => void run(() => act("accept_quote"))}
        >
          Accept quote
        </Button>
      )}
      {buyer && r.status === "payment_pending" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              act("submit_payment_reference", { reference: payRef }),
            );
          }}
        >
          <p className="whitespace-pre-wrap text-sm">
            {settings.payment_instructions}
          </p>
          <p className="text-sm">
            Pay the outstanding amount above. Payment is verified manually;
            entering a reference does not confirm payment.
          </p>
          <label className="block text-sm">
            Payment reference
            <input
              required
              maxLength={80}
              className={control}
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !settings.payments_enabled}
            className="min-h-11 rounded-xl border px-4"
          >
            Submit reference
          </button>
        </form>
      )}
      {admin && r.status === "payment_pending" && r.payment_reference && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              act("verify_payment", { amount_kes: Number(amount) }),
            );
          }}
          className="space-y-2"
        >
          <p className="text-sm">
            Verify receipt {r.payment_reference} against the actual account
            statement.
          </p>
          <label className="block text-sm">
            Actual newly received amount (KES)
            <input
              required
              type="number"
              min="1"
              max="1000000"
              className={control}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button disabled={busy} className="min-h-11 rounded-xl border px-4">
            Record verified receipt
          </button>
        </form>
      )}
      {approved && !buyer && !r.scout_id && r.status === "payment_verified" && (
        <Button
          disabled={busy}
          onClick={() =>
            promptAct(
              "claim",
              "Declare your relationship to the seller/buyer, or write none",
              "conflict_disclosure",
            )
          }
        >
          Accept scout assignment
        </Button>
      )}
      {scout && r.status === "assigned" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() => void run(() => act("start"))}
            >
              Start site visit
            </Button>
            <Button
              disabled={busy}
              onClick={() => void run(() => act("release"))}
            >
              Release assignment
            </Button>
          </div>
          <details>
            <summary>Confirm travel and access costs</summary>
            <label className="block text-sm">
              Travel at cost (KES)
              <input
                type="number"
                min="0"
                max="100000"
                className={control}
                value={travel}
                onChange={(e) => setTravel(Number(e.target.value))}
              />
            </label>
            <label className="block text-sm">
              Access
              <select
                className={control}
                value={access}
                onChange={(e) => setAccess(e.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="difficult">Difficult</option>
                <option value="remote">Remote</option>
              </select>
            </label>
            <label className="block text-sm">
              Reason
              <textarea
                className={control}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Button
              disabled={busy || reason.trim().length < 5}
              onClick={() =>
                void run(() =>
                  act("propose_requote", {
                    travel_kes: travel,
                    access_level: access,
                    reason,
                  }),
                )
              }
            >
              Send revised quote to buyer
            </Button>
          </details>
        </div>
      )}
      {buyer && r.status === "requote_pending" && (
        <div className="space-y-2">
          <p>
            Revised total: {kes((r.pending_quote as Quote)?.total_kes)}.{" "}
            {(r.pending_quote as Quote)?.reason}
          </p>
          <Button
            disabled={busy}
            onClick={() => void run(() => act("accept_requote"))}
          >
            Accept revised quote
          </Button>
          <Button
            disabled={busy}
            onClick={() => void run(() => act("decline_requote"))}
          >
            Keep original quote
          </Button>
        </div>
      )}
      {editable && (
        <div className="space-y-4">
          <h4 className="font-semibold">Record the site findings</h4>
          <p className="text-sm">
            Save your findings before submitting. Report what you observed and
            what remains unknown. Saving revised findings resets any evidence
            exception for fresh review.
          </p>
          {tasks.map((t) => {
            const value = results[t.code] ?? {
              status: "observed" as const,
              note: "",
            };
            return (
              <fieldset
                key={t.code}
                className="rounded-xl border border-white/15 p-3"
              >
                <legend className="px-2 text-sm">{t.label}</legend>
                <label className="block text-sm">
                  Outcome
                  <select
                    className={control}
                    value={value.status}
                    onChange={(e) =>
                      setResults({
                        ...results,
                        [t.code]: {
                          ...value,
                          status: e.target.value as "observed" | "blocked",
                        },
                      })
                    }
                  >
                    <option value="observed">Observed / investigated</option>
                    <option value="blocked">Blocked / could not verify</option>
                  </select>
                </label>
                <label className="block text-sm">
                  {value.status === "blocked"
                    ? "Reason it could not be checked"
                    : "Finding and source"}
                  <textarea
                    className={control}
                    value={
                      value.status === "blocked"
                        ? (value.reason ?? "")
                        : (value.note ?? "")
                    }
                    onChange={(e) =>
                      setResults({
                        ...results,
                        [t.code]: {
                          ...value,
                          [value.status === "blocked" ? "reason" : "note"]:
                            e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="mt-2 flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(value.contradicts_ai)}
                    onChange={(e) =>
                      setResults({
                        ...results,
                        [t.code]: {
                          ...value,
                          contradicts_ai: e.target.checked,
                        },
                      })
                    }
                  />
                  This finding disagrees with the AI report; explain the
                  difference above
                </label>
              </fieldset>
            );
          })}
          <label className="block text-sm">
            Overall site analysis
            <textarea
              maxLength={4000}
              className={control}
              rows={5}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Evidence exception request, if unsafe/inaccessible
            <textarea
              className={control}
              value={exception}
              onChange={(e) => setException(e.target.value)}
            />
          </label>
          <Button
            disabled={busy}
            onClick={() =>
              void run(() =>
                act("save_results", {
                  task_results: results,
                  summary,
                  exception,
                }),
              )
            }
          >
            Save findings
          </Button>
          <EvidenceUpload
            request={r}
            uid={uid}
            tasks={tasks}
            onSaved={() => {
              void evidenceQ.refetch();
            }}
          />
          <p className="text-sm">
            Base evidence:{" "}
            {
              evidence.filter(
                (e) =>
                  e.task_code === "base" && e.mime_type?.startsWith("image/"),
              ).length
            }
            /8 photos;{" "}
            {
              evidence.filter(
                (e) =>
                  e.task_code === "base" && e.mime_type?.startsWith("video/"),
              ).length
            }
            /1 video. Exception:{" "}
            {r.evidence_exception_approved ? "Approved" : "Not approved"}.
          </p>
          <Button disabled={busy} onClick={() => void run(() => act("submit"))}>
            Submit saved report for review
          </Button>
        </div>
      )}
      {admin &&
        r.evidence_exception_requested &&
        ["in_progress", "corrections_requested"].includes(r.status) && (
          <Button
            disabled={busy}
            onClick={() =>
              promptAct(
                "approve_exception",
                "Explain why this evidence exception is acceptable",
                "note",
              )
            }
          >
            Review and approve exception
          </Button>
        )}
      {admin && r.status === "submitted" && (
        <div className="space-y-2">
          <label className="block text-sm">
            Independent review note
            <textarea
              className={control}
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || review.trim().length < 5}
              onClick={() =>
                void run(() => act("accept_report", { note: review }))
              }
            >
              Accept reviewed report
            </Button>
            <Button
              disabled={busy || review.trim().length < 5}
              onClick={() =>
                void run(() => act("request_corrections", { note: review }))
              }
            >
              Request corrections
            </Button>
          </div>
        </div>
      )}
      {(buyer || scout || admin) && (
        <>
          <h4 className="font-semibold">
            {r.status === "completed"
              ? "Reviewed site report"
              : "Draft / unreviewed site report"}
          </h4>
          <p className="whitespace-pre-wrap text-sm">
            {r.scout_summary || "No report submitted yet."}
          </p>
          {Object.entries(asObject(r.task_results)).map(([code, v]) => {
            const f = v as Finding;
            return (
              <div key={code} className="text-sm">
                <b>
                  {code}: {f.status}
                </b>
                <p>{f.status === "blocked" ? f.reason : f.note}</p>
                {f.contradicts_ai && (
                  <p className="text-amber-300">
                    Ground finding differs from the AI interpretation.
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-sm text-muted-foreground">
            This report records observations and attributed testimony, not
            ownership, a licensed survey or a guarantee of safety.
          </p>
          <Button
            disabled={busy}
            onClick={() => void run(() => downloadScoutReport(r, evidence))}
          >
            Download {r.status === "completed" ? "reviewed" : "draft"} PDF
          </Button>
        </>
      )}
      {evidenceQ.error && (
        <p role="alert">
          Evidence could not load.{" "}
          <Button onClick={() => void evidenceQ.refetch()}>
            Retry evidence
          </Button>
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {evidence.map((e) => (
          <MediaCard
            key={e.id}
            evidence={e}
            removable={editable}
            onRemove={() =>
              void run(async () => {
                const a = await supabase
                  .from("scout_evidence")
                  .delete()
                  .eq("id", e.id);
                if (a.error) throw new Error(a.error.message);
                if (e.storage_path) {
                  const b = await supabase.storage
                    .from("scout-evidence")
                    .remove([e.storage_path]);
                  if (b.error) throw new Error(b.error.message);
                }
              })
            }
          />
        ))}
      </div>
      {admin && r.status === "completed" && r.payout_status === "pending" && (
        <Button
          disabled={busy}
          onClick={() =>
            promptAct(
              "mark_payout_paid",
              `After sending ${kes(quote.scout_earnings_kes)} to the scout, enter the transfer reference`,
            )
          }
        >
          Record actual scout payout
        </Button>
      )}
      {admin && r.refund_status === "pending" && (
        <Button
          disabled={busy}
          onClick={() =>
            promptAct(
              "mark_refund_paid",
              `After refunding ${kes(r.refund_amount_kes)}, enter the transfer reference`,
            )
          }
        >
          Record actual refund
        </Button>
      )}
      {((buyer && ["quoted", "payment_pending"].includes(r.status)) ||
        (admin && !["completed", "cancelled"].includes(r.status))) && (
        <Button
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Cancel this request? Verified payments will be flagged for refund review.",
              )
            )
              void run(() => act("cancel"));
          }}
        >
          Cancel request
        </Button>
      )}
      <JobTimeline id={r.id} />
    </article>
  );
}

function EvidenceUpload({
  request,
  uid,
  tasks,
  onSaved,
}: {
  request: Request;
  uid: string;
  tasks: { code: string; label: string }[];
  onSaved: () => void;
}) {
  const [task, setTask] = useState("base");
  const [kind, setKind] = useState("observation");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [captured, setCaptured] = useState("");
  const [gps, setGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const key = `halisia-scout-evidence:${uid}:${request.id}`;
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(key) ?? "null");
      if (d) {
        setNote(d.note ?? "");
        setTask(d.task ?? "base");
        setCaptured(d.captured ?? "");
      }
    } catch {
      /* optional draft */
    }
  }, [key]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ note, task, captured }));
    } catch {
      /* private browsing */
    }
  }, [key, note, task, captured]);
  const upload = async () => {
    setBusy(true);
    setError("");
    let remaining = [...files];
    try {
      if (kind === "testimony" && !consent)
        throw new Error("Confirm informed interview consent");
      if (!note.trim()) throw new Error("Describe the evidence and source");
      if (files.length && !captured)
        throw new Error("Enter the date and time the media was captured");
      const time = captured
        ? new Date(captured).toISOString()
        : new Date().toISOString();
      if (new Date(time).getTime() > Date.now() + 600000)
        throw new Error("Capture time cannot be in the future");
      const work = files.length ? files : [null];
      for (const file of work) {
        let path: string | null = null;
        if (file) {
          if (
            ![
              "image/jpeg",
              "image/png",
              "image/webp",
              "video/mp4",
              "video/webm",
              "video/quicktime",
            ].includes(file.type) ||
            file.size > 52428800 ||
            file.size === 0
          )
            throw new Error(
              `${file.name}: use JPEG, PNG, WebP, MP4, WebM or MOV up to 50 MB`,
            );
          path = `${request.id}/${crypto.randomUUID()}.${
            file.name
              .split(".")
              .pop()
              ?.replace(/[^a-zA-Z0-9]/g, "") || "media"
          }`;
          const u = await supabase.storage
            .from("scout-evidence")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (u.error) throw new Error(u.error.message);
        }
        const res = await supabase
          .from("scout_evidence")
          .insert({
            request_id: request.id,
            scout_id: uid,
            task_code: task,
            evidence_kind: kind,
            note:
              (gps
                ? "Device GPS was recorded at upload, not verified media capture location. "
                : "") + note.trim(),
            storage_path: path,
            mime_type: file?.type ?? null,
            size_bytes: file?.size ?? null,
            captured_at: time,
            lat: gps?.lat ?? null,
            lng: gps?.lng ?? null,
            accuracy_m: gps?.accuracy ?? null,
            location_source: gps ? "device_gps" : "none",
            interview_consent: consent,
          });
        if (res.error) {
          if (path)
            await supabase.storage.from("scout-evidence").remove([path]);
          throw new Error(res.error.message);
        }
        if (file) {
          remaining = remaining.filter((f) => f !== file);
          setFiles(remaining);
        }
        onSaved();
      }
      setNote("");
      setFiles([]);
      setConsent(false);
      toast.success("Evidence saved privately");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <fieldset className="space-y-3 rounded-xl border border-accent/30 p-4">
      <legend className="px-2">Add private evidence</legend>
      <label className="block text-sm">
        Checklist item
        <select
          className={control}
          value={task}
          onChange={(e) => setTask(e.target.value)}
        >
          {tasks.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Source type
        <select
          className={control}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="observation">Direct observation</option>
          <option value="testimony">Local testimony</option>
          <option value="inference">Scout interpretation / inference</option>
        </select>
      </label>
      <label className="block text-sm">
        Description and source
        <textarea
          className={control}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What does this show? For testimony, record the person's role, date and consent; avoid personal IDs or private contact details."
        />
      </label>
      {kind === "testimony" && (
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          The interviewee consented to collection and sharing with this buyer
          and HALISIA reviewers
        </label>
      )}
      <label className="block text-sm">
        Photos / short videos (50 MB per file)
        <input
          multiple
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className={control}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </label>
      <p className="text-sm">
        {files.length} files pending. Failed files remain selected for retry;
        after closing this page you must reselect files.
      </p>
      <label className="block text-sm">
        Actual capture date and time (your local time)
        <input
          type="datetime-local"
          className={control}
          value={captured}
          onChange={(e) => setCaptured(e.target.value)}
        />
      </label>
      <Button
        disabled={busy}
        onClick={() => {
          if (!navigator.geolocation) {
            setError(
              "GPS is unavailable; evidence will be labelled without GPS",
            );
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (p) =>
              setGps({
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                accuracy: p.coords.accuracy,
              }),
            (e) => setError(e.message),
            { enableHighAccuracy: true, timeout: 15000 },
          );
        }}
      >
        Record current device GPS
      </Button>
      <p className="text-sm">
        {gps
          ? `Current device location ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}; accuracy ±${Math.round(gps.accuracy)} m. This is upload-session location, not proof of media capture location.`
          : "No device GPS recorded. Location will be labelled unavailable."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <Button disabled={busy} onClick={() => void upload()}>
        {busy ? "Uploading…" : "Save evidence / retry pending files"}
      </Button>
    </fieldset>
  );
}

function MediaCard({
  evidence: e,
  removable,
  onRemove,
}: {
  evidence: Evidence;
  removable: boolean;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const open = async () => {
    if (!e.storage_path) return;
    const r = await supabase.storage
      .from("scout-evidence")
      .createSignedUrl(e.storage_path, 300);
    if (r.error) setError(r.error.message);
    else {
      setUrl(r.data.signedUrl);
      setError("");
    }
  };
  return (
    <div className="space-y-2 rounded-xl border border-white/15 p-3 text-sm">
      <b>
        {e.task_code} · {e.evidence_kind}
      </b>
      <p className="whitespace-pre-wrap">{e.note}</p>
      <p>Captured: {new Date(e.captured_at).toLocaleString()}</p>
      <p>
        Location: {e.location_source};{" "}
        {e.lat != null
          ? `${e.lat}, ${e.lng} ±${e.accuracy_m ?? "unknown"} m`
          : "not recorded"}
      </p>
      {url &&
        (e.mime_type?.startsWith("video/") ? (
          <video
            controls
            preload="metadata"
            src={url}
            className="w-full rounded-xl"
          />
        ) : (
          <img
            src={url}
            alt={e.note || "Scout site evidence"}
            className="w-full rounded-xl"
          />
        ))}
      {e.storage_path && (
        <Button onClick={() => void open()}>
          {url ? "Refresh private media access" : "Open private photo / video"}
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
      {removable && <Button onClick={onRemove}>Remove evidence</Button>}
    </div>
  );
}

function JobTimeline({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["scout-timeline", id],
    queryFn: async () => {
      const r = await supabase
        .from("scout_request_events")
        .select("*")
        .eq("request_id", id)
        .order("created_at");
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    },
    refetchInterval: 30000,
  });
  return (
    <details>
      <summary>Activity history</summary>
      {q.data?.map((e) => (
        <p key={e.id} className="mt-2 text-sm">
          {new Date(e.created_at).toLocaleString()} ·{" "}
          {e.event.replaceAll("_", " ")}
        </p>
      ))}
    </details>
  );
}

async function downloadScoutReport(r: Request, evidence: Evidence[]) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  let y = 20;
  const line = (text: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(bold ? 13 : 10);
    const lines = pdf.splitTextToSize(text, 175);
    for (const l of lines) {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(l, 18, y);
      y += 6;
    }
    y += 3;
  };
  line("HALISIA - Ground due diligence", true);
  line(
    r.status === "completed" ? "REVIEWED REPORT" : "DRAFT - NOT REVIEWED",
    true,
  );
  line(
    `Reference: ${r.title_reference || r.id}; County: ${r.county || "Not provided"}`,
  );
  line(
    `Location source: ${r.location_source}; ${r.lat ?? "Unknown"}, ${r.lng ?? "Unknown"}`,
  );
  line(`Site summary: ${r.scout_summary || "No findings yet"}`);
  line(`Review note: ${r.reviewer_note || "Not reviewed"}`);
  for (const [code, val] of Object.entries(asObject(r.task_results))) {
    const f = val as Finding;
    line(`${code}: ${f.status}`, true);
    line(f.note || f.reason || "Unanswered");
    if (f.contradicts_ai)
      line(
        "Ground finding disagrees with AI interpretation; consult the reviewed evidence.",
      );
  }
  line("Evidence register", true);
  for (const e of evidence) {
    line(
      `${e.task_code} / ${e.evidence_kind} / ${new Date(e.captured_at).toISOString()}`,
    );
    line(e.note || "Media evidence");
    line(
      `Evidence ID: ${e.id}. Location: ${e.location_source}; ${e.lat ?? "Unknown"}, ${e.lng ?? "Unknown"}; accuracy ${e.accuracy_m ?? "Unknown"} m.`,
    );
    if (
      e.storage_path &&
      ["image/jpeg", "image/png"].includes(e.mime_type ?? "")
    ) {
      const signed = await supabase.storage
        .from("scout-evidence")
        .createSignedUrl(e.storage_path, 60);
      if (signed.data) {
        try {
          const res = await fetch(signed.data.signedUrl);
          if (!res.ok) throw new Error("Image unavailable");
          const buf = await res.arrayBuffer();
          if (y > 200) {
            pdf.addPage();
            y = 20;
          }
          const props = pdf.getImageProperties(new Uint8Array(buf));
          const w = Math.min(150, props.width);
          const h = Math.min(65, (w * props.height) / props.width);
          pdf.addImage(
            new Uint8Array(buf),
            e.mime_type === "image/png" ? "PNG" : "JPEG",
            18,
            y,
            (h * props.width) / props.height,
            h,
          );
          y += h + 8;
        } catch {
          line(
            "Image could not be embedded; view its private original in the scout workspace.",
          );
        }
      }
    }
  }
  line(
    "This report records direct observations, consented testimony and labelled interpretation. It does not establish ownership, surveyed boundaries, professional valuation or safety.",
  );
  line(
    `Private media, including videos and WebP images, remains available to participants in the HALISIA scout workspace. Request ID: ${r.id}`,
  );
  pdf.save(`HALISIA_Scout_${r.id}.pdf`);
}

export function ReviewedScoutFindings({ reference }: { reference: string }) {
  const q = useQuery({
    queryKey: ["reviewed-scout-findings", reference],
    enabled: Boolean(reference.trim()),
    queryFn: async () => {
      const auth = await supabase.auth.getUser();
      if (!auth.data.user) return [];
      const r = await supabase.rpc("my_reviewed_scout_findings", {
        p_reference: reference,
      });
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    },
  });
  if (!q.data?.length) return null;
  return (
    <section className="glass mt-5 space-y-3 rounded-2xl p-4">
      <h2 className="font-semibold">Reviewed ground findings</h2>
      <p className="text-sm">
        Private reports linked to this title reference. Ground findings
        supplement the AI; ownership and surveyed boundaries remain unverified.
      </p>
      {q.data.map((r) => (
        <div key={r.request_id}>
          <p className="text-sm">
            Reviewed{" "}
            {r.completed_at
              ? new Date(r.completed_at).toLocaleDateString()
              : "date unavailable"}
          </p>
          <p className="whitespace-pre-wrap text-sm">{r.scout_summary}</p>
          {Object.entries(asObject(r.task_results)).map(([code, v]) => {
            const f = v as Finding;
            return (
              <p key={code} className="mt-1 text-sm">
                <b>{code}:</b> {f.note || f.reason || "Unanswered"}
                {f.contradicts_ai && " — differs from AI interpretation"}
              </p>
            );
          })}
          <a
            className="mt-2 inline-block text-sm text-accent underline"
            href={`/scout?job=${encodeURIComponent(r.request_id)}`}
          >
            Open private evidence and full report
          </a>
        </div>
      ))}
    </section>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  adminRpc,
  ADMIN_RESOURCES,
  ACCOUNT_RESOURCES,
  type AdminStatus,
  type AdminPage,
  type AdminRow,
} from "@/lib/admin";
import { AdminSecurity } from "@/components/halisia/admin-security";
import { ScoutHub } from "@/components/halisia/scout-hub";
import { ROLE_CATALOG } from "@/lib/roles";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Master Admin — HALISIA" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminPageView,
});

function AdminPageView() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [resource, setResource] = useState("accounts");
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const [account, setAccount] = useState("");
  const [selected, setSelected] = useState<AdminRow | null>(null);
  const [action, setAction] = useState("");
  const [target, setTarget] = useState("");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [scout, setScout] = useState(false);
  const [profileEdit, setProfileEdit] = useState<Record<string, string>>({});
  const [fileLink, setFileLink] = useState("");
  const status = useQuery({
    queryKey: ["admin-status", user?.id],
    enabled: !!user,
    queryFn: () => adminRpc<AdminStatus>("halisia_admin_status"),
    refetchInterval: 30000,
  });
  const ready = status.data?.ready === true;
  const overview = useQuery({
    queryKey: ["admin-overview", user?.id],
    enabled: ready,
    queryFn: () => adminRpc<AdminRow>("halisia_admin_overview"),
    refetchInterval: 30000,
  });
  const rows = useQuery({
    queryKey: ["admin-rows", user?.id, resource, offset, account],
    enabled: ready,
    queryFn: () =>
      adminRpc<AdminPage>("halisia_admin_read", {
        p_table: resource,
        p_offset: offset,
        p_user: account || null,
      }),
    refetchInterval: 30000,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-status"] });
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    void qc.invalidateQueries({ queryKey: ["admin-rows"] });
    void qc.invalidateQueries({ queryKey: ["my-roles"] });
  };
  const choose = (r: string) => {
    setResource(r);
    setOffset(0);
    setSelected(null);
    setFilter("");
    setAction("");
    setScout(false);
    setFileLink("");
    if (!ACCOUNT_RESOURCES.includes(r)) setAccount("");
  };
  const prepare = (a: string, row: AdminRow, v = "") => {
    setSelected(row);
    setAction(a);
    setTarget(String(row.id ?? row.key ?? row.email ?? ""));
    setValue(v);
    setReason("");
    if (a === "update_profile")
      setProfileEdit(
        Object.fromEntries(
          ["display_name", "county", "phone", "headline"].map((k) => [k, String(row[k] ?? "")]),
        ),
      );
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminRpc("halisia_admin_action", {
        p_action: action,
        p_target: target,
        p_value: action === "update_profile" ? JSON.stringify(profileEdit) : value,
        p_reason: reason,
      });
      if (action === "document_access" && selected?.storage_path) {
        const signed = await supabase.storage
          .from(value === "vault_documents" ? "finance-vault" : "scout-evidence")
          .createSignedUrl(String(selected.storage_path), 300);
        if (signed.error) throw signed.error;
        setFileLink(signed.data.signedUrl);
      }
      toast.success("Administrator change saved and audited");
      setAction("");
      setReason("");
      setSelected(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };
  if (loading || (status.isPending && user))
    return <main className="px-4 pt-24">Checking administrator access…</main>;
  if (!user)
    return (
      <main className="mx-auto max-w-3xl px-4 pt-24">
        <h1 className="text-3xl font-semibold">HALISIA master admin</h1>
        <p className="mt-3">
          Sign in with an authorized email. Confirm the email before setting up your authenticator.
        </p>
        <Link
          to="/auth"
          search={{ redirect: "/admin" }}
          className="mt-5 inline-block rounded-full bg-primary px-5 py-3 text-primary-foreground"
        >
          Sign in / register
        </Link>
      </main>
    );
  if (status.error)
    return (
      <main className="px-4 pt-24" role="alert">
        Access check failed.{" "}
        <button onClick={() => void status.refetch()} className="underline">
          Retry
        </button>
      </main>
    );
  if (!status.data?.eligible)
    return (
      <main className="mx-auto max-w-3xl px-4 pt-24">
        <h1 className="text-2xl font-semibold">Administrator access restricted</h1>
        <p className="mt-3">
          This confirmed account is not an enabled administrator. Ask an authorized administrator to
          review the exact email address.
        </p>
        <Link to="/account" className="mt-4 inline-block underline">
          My account
        </Link>
      </main>
    );
  const visible = (rows.data?.rows ?? []).filter((r) =>
    JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()),
  );
  const headline = (r: AdminRow) =>
    String(
      r.email ??
        r.title ??
        r.display_name ??
        r.provider ??
        r.key ??
        r.name ??
        r.action ??
        r.id ??
        "Record",
    );
  return (
    <main className="relative mx-auto max-w-7xl px-4 pt-24 pb-24">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">HALISIA master admin</h1>
          <p className="text-sm text-muted-foreground">
            {user.email} · {ready ? "MFA verified" : "MFA verification required"}
          </p>
        </div>
        {ready && (
          <button onClick={refresh} className="min-h-11 rounded-xl border px-4">
            Refresh all
          </button>
        )}
      </header>
      <AdminSecurity key={user.id} ready={ready} onVerified={refresh} />
      {ready && (
        <>
          <section
            aria-label="Live platform overview"
            className="my-5 grid grid-cols-2 gap-3 md:grid-cols-4"
          >
            {overview.data &&
              Object.entries(overview.data)
                .filter(([k]) => k !== "captured_at")
                .map(([k, v]) => (
                  <div key={k} className="glass rounded-xl p-4">
                    <p className="text-xs capitalize text-muted-foreground">
                      {k.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xl font-semibold">
                      {typeof v === "boolean" ? (v ? "Enabled" : "Disabled") : String(v)}
                    </p>
                  </div>
                ))}
            {overview.error && (
              <p role="alert">
                Overview unavailable.{" "}
                <button onClick={() => void overview.refetch()} className="underline">
                  Retry
                </button>
              </p>
            )}
          </section>
          <p className="mb-4 text-xs text-muted-foreground">
            Database snapshot refreshes every 30 seconds. Recorded receipts are not independently
            reconciled revenue. Empty tables show actual zero records; health panels cover
            instrumented providers.
          </p>
          <nav aria-label="Administrator workspaces" className="mb-5 flex flex-wrap gap-2">
            <button onClick={() => choose("accounts")} className="rounded-full border px-4 py-2">
              Accounts
            </button>
            <button onClick={() => choose("properties")} className="rounded-full border px-4 py-2">
              Listings
            </button>
            <button
              onClick={() => choose("professional_profiles")}
              className="rounded-full border px-4 py-2"
            >
              Professionals
            </button>
            <button
              onClick={() => choose("contributions")}
              className="rounded-full border px-4 py-2"
            >
              Reviews
            </button>
            <button
              onClick={() => {
                setScout(true);
                setSelected(null);
                setAction("");
              }}
              className="rounded-full border px-4 py-2"
            >
              Scout control room
            </button>
            <button
              onClick={() => choose("marketplace_transactions")}
              className="rounded-full border px-4 py-2"
            >
              Finance
            </button>
            <button
              onClick={() => choose("news_provider_health")}
              className="rounded-full border px-4 py-2"
            >
              Operations
            </button>
            <button
              onClick={() => choose("admin_allowed_emails")}
              className="rounded-full border px-4 py-2"
            >
              Admin access
            </button>
            <button
              onClick={() => choose("admin_audit_events")}
              className="rounded-full border px-4 py-2"
            >
              Audit trail
            </button>
            <Link to="/pulse/admin" className="rounded-full border px-4 py-2">
              Pulse controls
            </Link>
            <Link to="/system-status" className="rounded-full border px-4 py-2">
              Release checks
            </Link>
            <Link to="/pricing" className="rounded-full border px-4 py-2">
              Public prices
            </Link>
          </nav>
          {scout ? (
            <ScoutHub uid={user.id} isAdmin={true} />
          ) : (
            <section className="glass rounded-2xl p-4 sm:p-6">
              <div className="flex flex-wrap gap-3">
                <label className="text-sm">
                  Resource
                  <select
                    value={resource}
                    onChange={(e) => choose(e.target.value)}
                    className="ml-2 max-w-full rounded-xl border bg-background p-3"
                  >
                    {ADMIN_RESOURCES.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Filter this page
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="ml-2 rounded-xl border bg-background p-3"
                    placeholder="Email, name, county, status…"
                  />
                </label>
                {account && (
                  <button
                    onClick={() => {
                      setAccount("");
                      setOffset(0);
                    }}
                    className="rounded-xl border px-3"
                  >
                    Clear account filter
                  </button>
                )}
              </div>
              {account && (
                <p className="mt-3 break-all text-xs">
                  Reviewing account {account}. Choose a supported resource to see this account's
                  records.
                </p>
              )}
              {resource === "admin_allowed_emails" && (
                <button
                  onClick={() => {
                    setAction("admin_email");
                    setTarget("");
                    setValue("enable");
                    setReason("");
                  }}
                  className="mt-4 rounded-xl bg-primary px-4 py-3 text-primary-foreground"
                >
                  Authorize a complete email address
                </button>
              )}
              {rows.isPending ? (
                <p className="mt-4">Loading records…</p>
              ) : rows.error ? (
                <p role="alert" className="mt-4">
                  Records could not load.{" "}
                  <button onClick={() => void rows.refetch()} className="underline">
                    Retry
                  </button>
                </p>
              ) : (
                <>
                  <p className="my-4 text-sm">
                    {rows.data?.total ?? 0} records · page {Math.floor(offset / 50) + 1}
                  </p>
                  {!visible.length && (
                    <p className="py-5 text-sm text-muted-foreground">
                      No records on this page match your filter.
                    </p>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {visible.map((r, i) => (
                      <article
                        key={String(r.id ?? r.email ?? r.key ?? i)}
                        className="min-w-0 rounded-xl border bg-background/70 p-4"
                      >
                        <h2 className="break-words font-semibold">{headline(r)}</h2>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {String(
                            r.status ??
                              r.verification_status ??
                              (r.suspended
                                ? "App access suspended"
                                : r.enabled !== undefined
                                  ? r.enabled
                                    ? "Enabled"
                                    : "Disabled"
                                  : ""),
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.roles
                            ? JSON.stringify(r.roles)
                            : String(r.county ?? r.created_at ?? "")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => setSelected(r)}
                            className="min-h-11 rounded-xl border px-3 text-sm"
                          >
                            View record
                          </button>
                          {resource === "accounts" && (
                            <>
                              <button
                                onClick={() => prepare("update_profile", r)}
                                className="rounded-xl border px-3 text-sm"
                              >
                                Edit account profile
                              </button>
                              <button
                                onClick={() => {
                                  setAccount(String(r.id));
                                  setOffset(0);
                                  setSelected(r);
                                }}
                                className="rounded-xl border px-3 text-sm"
                              >
                                Review account activity
                              </button>
                              <button
                                onClick={() => prepare(r.suspended ? "restore" : "suspend", r)}
                                className="rounded-xl border px-3 text-sm"
                              >
                                {r.suspended ? "Restore access" : "Suspend app access"}
                              </button>
                              <button
                                onClick={() => prepare("grant_role", r, "explorer")}
                                className="rounded-xl border px-3 text-sm"
                              >
                                Manage roles
                              </button>
                            </>
                          )}
                          {["vault_documents", "scout_evidence"].includes(resource) &&
                            !!r.storage_path && (
                              <button
                                onClick={() => prepare("document_access", r, resource)}
                                className="rounded-xl border px-3 text-sm"
                              >
                                Review private file
                              </button>
                            )}
                          {resource === "properties" && (
                            <button
                              onClick={() => prepare("listing_status", r, "draft")}
                              className="rounded-xl border px-3 text-sm"
                            >
                              Moderate listing
                            </button>
                          )}
                          {resource === "contributions" && (
                            <button
                              onClick={() => prepare("contribution_review", r, "pending")}
                              className="rounded-xl border px-3 text-sm"
                            >
                              Review contribution
                            </button>
                          )}
                          {resource === "professional_profiles" && (
                            <button
                              onClick={() => prepare("professional_review", r, "pending")}
                              className="rounded-xl border px-3 text-sm"
                            >
                              Review credentials
                            </button>
                          )}
                          {resource === "marketplace_feature_flags" && (
                            <button
                              onClick={() =>
                                prepare("feature_flag", r, r.enabled ? "false" : "true")
                              }
                              className="rounded-xl border px-3 text-sm"
                            >
                              Change setting
                            </button>
                          )}
                          {resource === "admin_allowed_emails" && (
                            <button
                              onClick={() =>
                                prepare("admin_email", r, r.enabled ? "disable" : "enable")
                              }
                              className="rounded-xl border px-3 text-sm"
                            >
                              {r.enabled ? "Revoke admin access" : "Enable admin access"}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      disabled={offset === 0}
                      onClick={() => {
                        setOffset(Math.max(0, offset - 50));
                        setSelected(null);
                      }}
                      className="min-h-11 rounded-xl border px-4 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      disabled={offset + 50 >= (rows.data?.total ?? 0)}
                      onClick={() => {
                        setOffset(offset + 50);
                        setSelected(null);
                      }}
                      className="min-h-11 rounded-xl border px-4 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          {fileLink && (
            <section className="glass mt-5 rounded-2xl p-5">
              <a href={fileLink} target="_blank" rel="noopener noreferrer" className="underline">
                Open reviewed private file · link expires in 5 minutes
              </a>
              <button onClick={() => setFileLink("")} className="ml-4 underline">
                Hide link
              </button>
            </section>
          )}
          {selected && (
            <section className="glass mt-5 rounded-2xl p-5" aria-label="Selected record">
              <div className="flex justify-between">
                <h2 className="font-semibold">Record detail</h2>
                <button onClick={() => setSelected(null)} className="underline">
                  Close detail
                </button>
              </div>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </section>
          )}
          {action && (
            <form
              onSubmit={submit}
              className="glass mt-5 grid gap-3 rounded-2xl p-5"
              aria-label="Administrator change"
            >
              <h2 className="font-semibold">Confirm administrator change</h2>
              <p className="text-sm">
                Action: {action.replaceAll("_", " ")}. Every saved change requires a reason and
                records its before and after values.
              </p>
              {action === "update_profile" &&
                ["display_name", "county", "phone", "headline"].map((k) => (
                  <label key={k} className="capitalize">
                    {k.replaceAll("_", " ")}
                    <input
                      maxLength={512}
                      value={profileEdit[k] ?? ""}
                      onChange={(e) => setProfileEdit({ ...profileEdit, [k]: e.target.value })}
                      className="mt-1 block w-full rounded-xl border bg-background p-3"
                    />
                  </label>
                ))}
              {action === "admin_email" && (
                <label>
                  Complete email
                  <input
                    type="email"
                    required
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="mt-1 block w-full rounded-xl border bg-background p-3"
                  />
                </label>
              )}
              {(action === "grant_role" || action === "revoke_role") && (
                <>
                  <label>
                    Role action
                    <select
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                      className="ml-2 rounded-xl border bg-background p-3"
                    >
                      <option value="grant_role">Grant role</option>
                      <option value="revoke_role">Revoke role</option>
                    </select>
                  </label>
                  <label>
                    Role
                    <select
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="ml-2 rounded-xl border bg-background p-3"
                    >
                      {ROLE_CATALOG.filter((r) => r.value !== "administrator").map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {[
                "listing_status",
                "contribution_review",
                "professional_review",
                "feature_flag",
                "admin_email",
              ].includes(action) && (
                <label>
                  New setting
                  <select
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="ml-2 rounded-xl border bg-background p-3"
                  >
                    {(action === "listing_status"
                      ? ["draft", "published", "sold", "rented", "archived"]
                      : action === "contribution_review"
                        ? ["pending", "accepted", "rejected"]
                        : action === "professional_review"
                          ? ["pending", "verified", "unverified"]
                          : action === "admin_email"
                            ? ["enable", "disable"]
                            : ["true", "false"]
                    ).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Reason
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 block w-full rounded-xl border bg-background p-3"
                />
              </label>
              <div className="flex gap-3">
                <button
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-primary px-4 text-primary-foreground"
                >
                  Save audited change
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAction("")}
                  className="min-h-11 rounded-xl border px-4"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </main>
  );
}

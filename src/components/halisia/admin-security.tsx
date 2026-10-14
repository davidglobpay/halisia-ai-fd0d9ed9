import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AdminSecurity({ onVerified, ready }: { onVerified: () => void; ready: boolean }) {
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void supabase.auth.mfa.listFactors().then((r) => {
      if (r.error) return toast.error(r.error.message);
      setFactor(r.data.totp[0]?.id ?? "");
    });
  }, []);
  const enroll = async () => {
    setBusy(true);
    try {
      const existing = await supabase.auth.mfa.listFactors();
      if (existing.error) throw existing.error;
      for (const f of existing.data.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )) {
        const removed = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (removed.error) throw removed.error;
      }
      const r = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "HALISIA administrator",
      });
      if (r.error) throw r.error;
      setFactor(r.data.id);
      setQr(r.data.totp.qr_code);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Authenticator setup failed");
    } finally {
      setBusy(false);
    }
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!/^\d{6}$/.test(code)) throw new Error("Enter the six-digit authenticator code");
      const r = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (r.error) throw r.error;
      setCode("");
      setQr("");
      onVerified();
      toast.success("Administrator MFA verified");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };
  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!ready) throw new Error("Verify MFA first");
      if (password.length < 12 || password.length > 72)
        throw new Error("Use a password of 12–72 characters");
      if (password !== confirmation) throw new Error("Passwords do not match");
      const { data: u, error: ue } = await supabase.auth.getUser();
      if (ue || !u.user?.email) throw new Error("Sign in again");
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== "aal2")
        throw new Error("Verify MFA first");
      const r = await supabase.auth.updateUser({ password });
      if (r.error) throw r.error;
      setPassword("");
      setConfirmation("");
      toast.success("Password updated for this account");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Password update failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="glass rounded-2xl p-5" aria-label="Administrator security">
      <h2 className="text-xl font-semibold">Administrator security</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Email confirmation and an authenticator code protect all administrator tools. Each approved
        email signs in with its own account.
      </p>
      {!ready && (
        <div className="mt-4">
          {!factor && (
            <button
              disabled={busy}
              onClick={enroll}
              className="min-h-11 rounded-xl bg-primary px-4 text-primary-foreground"
            >
              Set up authenticator
            </button>
          )}
          {qr && (
            <>
              <p className="mt-3 text-sm">Scan in your authenticator app. Keep this QR private.</p>
              <img
                src={qr}
                alt="Private authenticator enrollment QR"
                className="mt-2 h-52 w-52 bg-white p-2"
              />
            </>
          )}
          {factor && (
            <form onSubmit={verify} className="mt-3 flex flex-wrap gap-2">
              <label className="text-sm">
                Authenticator code
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="ml-2 rounded-xl border bg-background p-3"
                />
              </label>
              <button
                disabled={busy}
                className="min-h-11 rounded-xl bg-primary px-4 text-primary-foreground"
              >
                Verify MFA
              </button>
            </form>
          )}
        </div>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium">
          Set or change my account password
        </summary>
        <p className="my-3 text-xs text-muted-foreground">
          Enter your chosen password here, never in chat. This updates only the signed-in account,
          not every administrator account. If your authentication provider requests recovery
          verification, use the sign-in page password recovery flow.
        </p>
        <form onSubmit={updatePassword} className="grid max-w-md gap-3">
          <label className="text-sm">
            New password
            <input
              required
              type="password"
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-xl border bg-background p-3"
            />
          </label>
          <label className="text-sm">
            Confirm password
            <input
              required
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="mt-1 block w-full rounded-xl border bg-background p-3"
            />
          </label>
          <button
            disabled={busy || !ready}
            className="min-h-11 rounded-xl border px-4 disabled:opacity-50"
          >
            Save my password
          </button>
        </form>
      </details>
    </section>
  );
}

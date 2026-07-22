import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password · HALISIA AI" },
      { name: "description", content: "Set a new password for your HALISIA AI account." },
      { property: "og:title", content: "Reset password · HALISIA AI" },
      { property: "og:description", content: "Set a new password for your HALISIA AI account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pw = z.string().min(8, "At least 8 characters").max(72).safeParse(password);
    if (!pw.success) return setMsg({ tone: "err", text: pw.error.issues[0].message });
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg({ tone: "ok", text: "Password updated. Redirecting…" });
      setTimeout(() => navigate({ to: "/saved" }), 900);
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Failed to update password" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <Link to="/" search={{ compare: "" }} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to HALISIA
        </Link>
        <div className="glass-strong rounded-3xl border border-white/10 p-6 sm:p-8">
          <h1 className="text-2xl font-display font-semibold text-foreground">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready ? "Enter a new password (min 8 characters)." : "Waiting for reset link to activate…"}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3" noValidate>
            <label className="block">
              <span className="text-xs text-muted-foreground">New password</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 focus-within:ring-2 focus-within:ring-accent/60">
                <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={!ready}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent outline-none py-2.5 text-sm disabled:opacity-50"
                />
              </div>
            </label>
            {msg && (
              <div role="status" aria-live="polite" className={`rounded-lg px-3 py-2 text-xs ${msg.tone === "ok" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-200" : "bg-red-500/10 border border-red-500/30 text-red-200"}`}>
                {msg.text}
              </div>
            )}
            <button type="submit" disabled={!ready || submitting} className="w-full h-11 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Update password
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
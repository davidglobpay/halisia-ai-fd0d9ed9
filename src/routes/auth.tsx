import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, Mail, Lock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  head: () => ({
    meta: [
      { title: "Sign in · HALISIA AI" },
      {
        name: "description",
        content:
          "Sign in or create an account to save Kenya land intelligence, favorites, and reports.",
      },
      { property: "og:title", content: "Sign in · HALISIA AI" },
      {
        property: "og:description",
        content: "Save locations, county profiles, and AI dossiers across sessions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "At least 8 characters").max(72);

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { redirect: redirectTo } = Route.useSearch();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // Only allow same-origin relative paths as a post sign-in destination.
  const safeNext =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/dashboard";

  useEffect(() => {
    if (session) navigate({ to: safeNext, replace: true });
  }, [session, navigate, pathname, safeNext]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const emailR = emailSchema.safeParse(email);
    if (!emailR.success) return setMsg({ tone: "err", text: emailR.error.issues[0].message });
    if (mode !== "forgot") {
      const pw = passwordSchema.safeParse(password);
      if (!pw.success) return setMsg({ tone: "err", text: pw.error.issues[0].message });
    }
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: emailR.data, password });
        if (error) throw error;
        navigate({ to: safeNext, replace: true });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: emailR.data,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMsg({ tone: "ok", text: "Check your email to confirm your account." });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(emailR.data, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMsg({ tone: "ok", text: "Password reset email sent. Check your inbox." });
      }
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setMsg(null);
    setSubmitting(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth${
          safeNext ? `?redirect=${encodeURIComponent(safeNext)}` : ""
        }`,
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: safeNext, replace: true });
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Google sign-in failed" });
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <Link
          to="/"
          search={{ compare: "" }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to HALISIA
        </Link>
        <div className="glass-strong rounded-3xl border border-white/10 p-6 sm:p-8">
          <h1 className="text-2xl font-display font-semibold text-foreground">
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Reset password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Save locations, counties, and AI dossiers across sessions."
              : mode === "signup"
                ? "Start saving Kenya land intelligence to your account."
                : "We'll email you a link to set a new password."}
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="mt-6 w-full h-11 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.4c-.24 1.4-1.68 4.1-5.4 4.1a6.2 6.2 0 1 1 0-12.4c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4 9.6-9.7 0-.7-.1-1.2-.2-1.7H12z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="flex-1 h-px bg-white/10" /> or email{" "}
            <span className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <label className="block">
              <span className="text-xs text-muted-foreground">Email</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 focus-within:ring-2 focus-within:ring-accent/60">
                <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent outline-none py-2.5 text-sm"
                />
              </div>
            </label>
            {mode !== "forgot" && (
              <label className="block">
                <span className="text-xs text-muted-foreground">Password</span>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 focus-within:ring-2 focus-within:ring-accent/60">
                  <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 bg-transparent outline-none py-2.5 text-sm"
                  />
                </div>
              </label>
            )}

            {msg && (
              <div
                role="status"
                aria-live="polite"
                className={`rounded-lg px-3 py-2 text-xs ${
                  msg.tone === "ok"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-200"
                    : "bg-red-500/10 border border-red-500/30 text-red-200"
                }`}
              >
                {msg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            {mode !== "signin" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setMsg(null);
                }}
                className="hover:text-foreground underline underline-offset-4"
              >
                Have an account? Sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setMsg(null);
                }}
                className="hover:text-foreground underline underline-offset-4"
              >
                New here? Create account
              </button>
            )}
            {mode !== "forgot" && (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setMsg(null);
                }}
                className="hover:text-foreground underline underline-offset-4"
              >
                Forgot password?
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

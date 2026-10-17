import { Link, useRouterState } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

/** True when an error came from a signed-in-only server function rejecting the request. */
export function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /unauthori[sz]ed|invalid token|jwt expired|401/i.test(msg);
}

/**
 * Calm banner shown to signed-out visitors on public pages whose location
 * lookups require an account. Preserves the full current URL (path + search,
 * including the selected location) as the post-sign-in destination.
 * Sign-in is free; this is never a payment step.
 */
export function SignInPrompt({
  feature = "location lookups",
  expired = false,
  className = "",
}: {
  feature?: string;
  expired?: boolean;
  className?: string;
}) {
  const { session, loading } = useAuth();
  const href = useRouterState({ select: (s) => s.location.href });
  if (loading || (session && !expired)) return null;
  return (
    <div
      role="region"
      aria-label="Sign in required"
      data-testid="sign-in-prompt"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card px-4 py-3 ${className}`}
    >
      <p className="text-sm text-foreground min-w-0">
        {expired
          ? "Your session has expired. Sign in again to continue."
          : `Sign in free to continue — ${feature} need an account.`}
      </p>
      <Link
        to="/auth"
        search={{ redirect: href }}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Sign in free to continue
      </Link>
    </div>
  );
}

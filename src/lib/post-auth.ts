/** Session-storage key holding the same-origin path to return to after OAuth. */
export const POST_AUTH_KEY = "halisia:post-auth-redirect";

/** Read and clear the stored destination; returns null when unset or unsafe. */
export function takePostAuthRedirect(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const value = sessionStorage.getItem(POST_AUTH_KEY);
  sessionStorage.removeItem(POST_AUTH_KEY);
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

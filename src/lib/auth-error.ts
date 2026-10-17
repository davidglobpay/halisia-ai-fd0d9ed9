/** True when an error came from a signed-in-only server function rejecting the request. */
export function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /unauthori[sz]ed|invalid token|jwt expired|401/i.test(msg);
}

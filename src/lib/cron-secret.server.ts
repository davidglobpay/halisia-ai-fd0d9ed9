/**
 * Constant-time comparison of a provided secret with the expected one.
 *
 * Both values are hashed with SHA-256 (Web Crypto, available in Workers and
 * Node) so the comparison always runs over 32 bytes whatever the input
 * lengths, and the byte loop never exits early. An unset or empty expected
 * secret never matches.
 */
export async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  if (!expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

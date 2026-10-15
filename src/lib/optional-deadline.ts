/** Bound optional report inputs without manufacturing a replacement reading. */
export async function optionalDeadline<T>(input: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      input,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Optional report input timed out")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

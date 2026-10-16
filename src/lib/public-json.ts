/** A slow or oversized provider must fail as unavailable, never manufacture data. */
export async function fetchPublicJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
  maxBytes = 8 * 1024 * 1024,
): Promise<T> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("Public provider byte limit must be a positive integer");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let rejectAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => reject(new Error("Public provider deadline exceeded"));
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
  });
  try {
    const response = await Promise.race([
      fetch(url, { ...init, signal: controller.signal }),
      aborted,
    ]);
    if (!response.ok) throw new Error(`Public provider returned HTTP ${response.status}`);
    const declaredBytes = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw new Error("Public provider response exceeds byte limit");
    }
    if (!response.body) throw new Error("Public provider response has no body");
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let bytes = 0;
    while (true) {
      const part = await Promise.race([reader.read(), aborted]);
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxBytes) throw new Error("Public provider response exceeds byte limit");
      chunks.push(decoder.decode(part.value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join("")) as T;
  } finally {
    clearTimeout(timer);
    if (rejectAbort) controller.signal.removeEventListener("abort", rejectAbort);
    void reader?.cancel().catch(() => undefined);
    controller.abort();
  }
}

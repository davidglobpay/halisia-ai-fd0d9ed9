/**
 * Getting a generated file onto the user's device, reliably, on phones too.
 *
 * Browsers only treat a download as user-initiated while the tap that
 * started it is still "fresh" (Chrome: about five seconds). Most HALISIA
 * exports fetch maps, imagery and data first, so by the time the file is
 * ready that window has closed. Chrome on Android then allows the first such
 * download in a tab and blocks or silently queues the rest as "automatic
 * downloads", which is why a second export appeared to do nothing.
 *
 * Every export therefore saves immediately only while the tap is still fresh.
 * Once it is not, the file goes to a "ready" panel whose Save and Share
 * buttons are real taps that browsers always honour. No background download
 * is attempted then: on Android each one counts towards Chrome's "multiple
 * automatic downloads" block, which after the first export stopped later
 * downloads from the site altogether.
 */

export type ReadyFile = {
  url: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  blob: Blob;
};

type Listener = (file: ReadyFile | null) => void;

let current: ReadyFile | null = null;
const listeners = new Set<Listener>();

/** Minimal shape of the browser's user-activation state. */
type ActivationLike = { userActivation?: { isActive?: boolean } } | undefined;

/**
 * True only when the browser reports that the triggering tap is still fresh.
 * Browsers without the API (or server-side code) get the safe answer: false,
 * which shows the panel.
 */
export function tapStillFresh(nav: ActivationLike): boolean {
  return nav?.userActivation?.isActive === true;
}

export function getReadyFile(): ReadyFile | null {
  return current;
}

export function subscribeReadyFile(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  for (const fn of listeners) fn(current);
}

/** Replace the file offered by the panel, releasing the previous one. */
export function publishReadyFile(blob: Blob, filename: string): ReadyFile | null {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
  if (current) URL.revokeObjectURL(current.url);
  current = {
    url: URL.createObjectURL(blob),
    filename,
    sizeBytes: blob.size,
    mimeType: blob.type || "application/octet-stream",
    blob,
  };
  emit();
  return current;
}

export function clearReadyFile(): void {
  if (current) URL.revokeObjectURL(current.url);
  current = null;
  emit();
}

/** Human file size: "604 KB", "1.2 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function currentNavigator(): ActivationLike {
  return typeof navigator === "undefined" ? undefined : (navigator as ActivationLike);
}

/** Start a download from a blob with an anchor. Keeps the URL alive long
 * enough for slow phones to finish reading it. */
function anchorDownload(blob: Blob, filename: string): void {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** A jsPDF-like document: anything that can save itself and produce a blob. */
export type SavableDoc = {
  save: (filename: string) => unknown;
  output: (type: "blob") => Blob;
};

/**
 * Save a generated PDF: straight away while the user's tap is still fresh,
 * otherwise through the "ready" panel's Save button.
 */
export function deliverPdf(doc: SavableDoc, filename: string): void {
  if (tapStillFresh(currentNavigator())) doc.save(filename);
  else publishReadyFile(doc.output("blob"), filename);
}

/** Same as deliverPdf, for files built as a Blob (Word, CSV, text). */
export function deliverBlob(blob: Blob, filename: string): void {
  if (tapStillFresh(currentNavigator())) anchorDownload(blob, filename);
  else publishReadyFile(blob, filename);
}

import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import {
  clearReadyFile,
  formatFileSize,
  getReadyFile,
  subscribeReadyFile,
  type ReadyFile,
} from "@/lib/pdf-delivery";

/**
 * Offers the last generated file with real-tap Save and Share buttons.
 * Shown only when an export finished after the browser stopped treating the
 * original tap as user-initiated (see src/lib/pdf-delivery.ts).
 */
export function FileReadyPanel() {
  const [file, setFile] = useState<ReadyFile | null>(() => getReadyFile());
  const [shareError, setShareError] = useState("");

  useEffect(() => subscribeReadyFile(setFile), []);
  useEffect(() => setShareError(""), [file]);

  if (!file) return null;

  const shareFile =
    typeof File !== "undefined"
      ? new File([file.blob], file.filename, { type: file.mimeType })
      : null;
  const canShare =
    !!shareFile &&
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [shareFile] });
  const size = formatFileSize(file.sizeBytes);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="file-ready-panel"
      className="fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-xl sm:inset-x-auto sm:right-6"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Your file is ready</p>
          <p className="truncate text-xs text-muted-foreground" title={file.filename}>
            {file.filename}
            {size ? ` · ${size}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            If the download did not start, tap Save.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={clearReadyFile}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={file.url}
          download={file.filename}
          data-testid="file-ready-save"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Download className="h-4 w-4" /> Save
        </a>
        {canShare && shareFile && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.share({ files: [shareFile], title: file.filename });
              } catch (error) {
                // Closing the share sheet is not an error worth showing.
                if (error instanceof DOMException && error.name === "AbortError") return;
                setShareError("Sharing is not available here. Use Save instead.");
              }
            }}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-semibold"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        )}
      </div>
      {shareError && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {shareError}
        </p>
      )}
    </div>
  );
}

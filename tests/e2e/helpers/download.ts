import type { Download, Page } from "@playwright/test";

/**
 * Waits for a generated file the way a person gets it. Exports that finish
 * while the click is still fresh download straight away (and the "Download
 * started" panel appears as a backup); slower ones appear in the "Your PDF is
 * ready" panel (src/lib/pdf-delivery.ts), whose Save button this taps. Call
 * it before the click that starts the export, like page.waitForEvent("download").
 * A panel left over from an earlier export is ignored: only a panel offering
 * a new file counts.
 */
export function waitForDownload(page: Page, opts: { timeout?: number } = {}): Promise<Download> {
  const timeout = opts.timeout ?? 45_000;
  const save = page.getByTestId("file-ready-save");
  const before = save
    .isVisible()
    .then((v) => (v ? save.getAttribute("href") : null))
    .catch(() => null);
  return new Promise<Download>((resolve, reject) => {
    let settled = false;
    let failures = 0;
    const win = (d: Download) => {
      if (settled) return;
      settled = true;
      resolve(d);
    };
    const lose = (error: unknown) => {
      failures += 1;
      if (!settled && failures === 2) {
        settled = true;
        reject(error);
      }
    };
    page.waitForEvent("download", { timeout }).then(win, lose);
    before
      .then((old) =>
        page.waitForFunction(
          (prev) => {
            const a = document.querySelector('[data-testid="file-ready-save"]');
            return !!a && a.getAttribute("href") !== prev;
          },
          old,
          { timeout },
        ),
      )
      .then(async () => {
        // A started download normally arrives on its own; give it a moment.
        for (let i = 0; i < 10 && !settled; i++) await page.waitForTimeout(500);
        if (settled) return;
        const [d] = await Promise.all([
          page.waitForEvent("download", { timeout: 15_000 }),
          save.click(),
        ]);
        win(d);
      })
      .catch(lose);
  });
}

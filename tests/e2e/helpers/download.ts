import type { Download, Page } from "@playwright/test";

/**
 * Waits for a generated file the way a person gets it. Exports that finish
 * while the click is still fresh download straight away; slower ones appear
 * in the "Your PDF is ready" panel (src/lib/pdf-delivery.ts), whose Save
 * button this taps. Call it before the click that starts the export, like
 * page.waitForEvent("download"). Assumes no earlier file is still offered in
 * the panel on this page.
 */
export function waitForDownload(page: Page, opts: { timeout?: number } = {}): Promise<Download> {
  const timeout = opts.timeout ?? 45_000;
  const save = page.getByTestId("file-ready-save");
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
    save
      .waitFor({ state: "visible", timeout })
      .then(async () => {
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

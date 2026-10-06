import { expect, test } from "@playwright/test";

type RuntimeSnapshot = {
  url: string;
  readyState: DocumentReadyState;
  bodyChildren: number;
  scriptSources: string[];
  moduleScripts: number;
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: string[];
  compareButton?: {
    before: string | null;
    after: string | null;
  };
};

test("reports client hydration and runtime failures", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "unknown failure"}`,
    );
  });

  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2_000);

  const snapshot: RuntimeSnapshot = await page.evaluate(() => ({
    url: window.location.href,
    readyState: document.readyState,
    bodyChildren: document.body.childElementCount,
    scriptSources: Array.from(document.scripts)
      .map((script) => script.src)
      .filter(Boolean),
    moduleScripts: document.querySelectorAll('script[type="module"]').length,
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
  }));

  const compareButton = page.getByRole("button", {
    name: /Nairobi.*comparison/i,
  });

  try {
    await expect(compareButton).toHaveCount(1);
    const before = await compareButton.getAttribute("aria-pressed");
    await compareButton.click();
    await expect(compareButton).toHaveAttribute(
      "aria-pressed",
      before === "true" ? "false" : "true",
    );
    const after = await compareButton.getAttribute("aria-pressed");
    snapshot.compareButton = { before, after };
    expect(pageErrors, "Client should not throw runtime errors").toEqual([]);
  } finally {
    snapshot.pageErrors = pageErrors;
    snapshot.consoleErrors = consoleErrors;
    snapshot.failedRequests = failedRequests;

    // Emit even when interaction fails, so diagnosis survives artifact-quota failures.
    console.log(`[runtime-diagnostics] ${JSON.stringify(snapshot)}`);
  }

  expect(snapshot.bodyChildren, "Document shell should render body content").toBeGreaterThan(0);
});

import { expect, test } from "@playwright/test";

type RuntimeSnapshot = {
  url: string;
  readyState: DocumentReadyState;
  rootChildren: number;
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
    rootChildren: document.querySelector("#root")?.childElementCount ?? -1,
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

  if ((await compareButton.count()) > 0) {
    const before = await compareButton.first().getAttribute("aria-pressed");
    await compareButton.first().click();
    await page.waitForTimeout(250);
    const after = await compareButton.first().getAttribute("aria-pressed");
    snapshot.compareButton = { before, after };
  }

  snapshot.pageErrors = pageErrors;
  snapshot.consoleErrors = consoleErrors;
  snapshot.failedRequests = failedRequests;

  // This line is intentionally emitted to stdout so the diagnosis survives
  // GitHub artifact-quota failures.
  console.log(`[runtime-diagnostics] ${JSON.stringify(snapshot)}`);

  expect(snapshot.rootChildren, "React root should render at least one child").toBeGreaterThan(0);
});

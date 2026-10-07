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

  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2_000);

  const snapshot: RuntimeSnapshot = await page.evaluate(() => ({
    url: window.location.href,
    readyState: document.readyState,
    rootChildren: document.body.childElementCount,
    scriptSources: Array.from(document.scripts)
      .map((script) => script.src)
      .filter(Boolean),
    moduleScripts: document.querySelectorAll('script[type="module"]').length,
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
  }));

  const compareButton = page
    .getByRole("button", { name: /Nairobi.*comparison/i })
    .or(page.getByRole("checkbox", { name: /Nairobi.*comparison/i }))
    .first();

  try {
    await expect(compareButton).toBeEnabled();
    const role = await compareButton.getAttribute("role");
    const type = await compareButton.getAttribute("type");
    const attribute = role === "checkbox" || type === "checkbox" ? "aria-checked" : "aria-pressed";
    const before = await compareButton.getAttribute(attribute);
    await compareButton.click();
    if (type === "checkbox") await expect(compareButton).toBeChecked();
    else await expect(compareButton).toHaveAttribute(attribute, "true");
    snapshot.compareButton = { before, after: await compareButton.getAttribute(attribute) };
  } finally {
    snapshot.pageErrors = pageErrors;
    snapshot.consoleErrors = consoleErrors;
    snapshot.failedRequests = failedRequests;
    console.log(`[runtime-diagnostics] ${JSON.stringify(snapshot)}`);
  }

  snapshot.pageErrors = pageErrors;
  snapshot.consoleErrors = consoleErrors;
  snapshot.failedRequests = failedRequests;

  // This line is intentionally emitted to stdout so the diagnosis survives
  // GitHub artifact-quota failures.
  console.log(`[runtime-diagnostics] ${JSON.stringify(snapshot)}`);

  expect(pageErrors, "No uncaught browser errors").toEqual([]);
  expect(snapshot.rootChildren, "Document body should render content").toBeGreaterThan(0);
});

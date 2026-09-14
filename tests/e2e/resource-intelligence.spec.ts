import { expect, test } from "@playwright/test";

test.describe("Resource Intelligence M0-A", () => {
  test("renders the evidence-first foundation without fabricating sector readiness", async ({ page }) => {
    await page.goto("/resource-intelligence");

    await expect(page.getByTestId("resource-intelligence-status")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resource Intelligence" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "LAND" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "LIMAR" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "MADINI" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ENERGY" })).toBeVisible();

    await expect(page.getByText("Model output cannot self-promote beyond INFERRED.")).toBeVisible();
    await expect(page.getByText("Regulator verification requires a regulator-class source.")).toBeVisible();
    await expect(
      page.getByText("Insufficient evidence cannot publish a numeric readiness score."),
    ).toBeVisible();

    // M0-A must not claim LIMAR/MADINI/ENERGY are live sector engines yet.
    await expect(page.getByText("Foundation only")).toHaveCount(3);
  });

  test("is discoverable from system status", async ({ page }) => {
    await page.goto("/system-status");
    const card = page.getByRole("heading", { name: "Resource Intelligence" });
    await expect(card).toBeVisible();
    await page.getByRole("link", { name: "Open test surface" }).last().click();
    await expect(page).toHaveURL(/\/resource-intelligence$/);
  });
});

import { expect, test } from "@playwright/test";

test("the Day 1 composer explains the browser-side trust boundary", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Keep the key/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start a sealed note" })).toBeVisible();
  await expect(page.getByText("Plaintext and keys stay in your browser", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Seal this draft" })).toBeEnabled();
});

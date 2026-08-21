import { expect, test } from "@playwright/test";

test("the Day 2 composer explains the browser-side trust boundary", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Create a private share" })).toBeVisible();
  await expect(
    page.getByText("Your browser encrypts this before it leaves the page.", { exact: false }).first()
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create share" })).toBeEnabled();
});

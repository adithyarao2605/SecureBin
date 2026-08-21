import { expect, test } from "@playwright/test";

test("the Day 2 composer explains the browser-side trust boundary and defaults to dark theme", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Create a private share" })).toBeVisible();
  await expect(
    page.getByText("Your browser encrypts this before it leaves the page.", { exact: false }).first()
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create share" })).toBeEnabled();

  // Dark mode is default
  const rootClass = await page.locator("html").getAttribute("class");
  expect(rootClass).toContain("dark");
});

test("the user can toggle between dark and light theme", async ({ page }) => {
  await page.goto("/");

  const toggleBtn = page.getByRole("button", { name: /switch to light theme|switch to dark theme/i });
  await expect(toggleBtn).toBeVisible();

  // Click to switch to light theme
  await toggleBtn.click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  // Click to switch back to dark theme
  await toggleBtn.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("the user can select custom expiration duration", async ({ page }) => {
  await page.goto("/");

  const expirySelect = page.getByLabel("Expires after");
  await expirySelect.selectOption("custom");

  const durationInput = page.getByLabel("Duration");
  await expect(durationInput).toBeVisible();
  await durationInput.fill("48");

  const unitSelect = page.getByLabel("Unit");
  await expect(unitSelect).toBeVisible();
  await unitSelect.selectOption("hours");

  // Evidence rail updates with custom expiry
  await expect(page.getByLabel("Evidence rail")).toBeVisible();
});

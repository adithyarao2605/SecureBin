import { expect, test } from "@playwright/test";

test("landing page presents the three-tab navigation and create-share CTA", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Share sensitive information/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "New share", exact: true })).toHaveAttribute("href", "/new");
  await expect(page.getByRole("link", { name: "My shares", exact: true })).toHaveAttribute("href", "/new#history");
  await expect(page.getByRole("link", { name: "How it works", exact: true })).toHaveAttribute("href", "/new#how-it-works");
  await expect(page.getByRole("link", { name: "Create share", exact: true })).toHaveAttribute("href", "/new");
  await expect(page.getByText("New Secure Share")).toBeVisible();
});

test("landing actions reach real destinations", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "New share", exact: true }).click();
  await expect(page).toHaveURL(/\/new$/u);
  await page.goBack();

  await page.getByRole("link", { name: "My shares", exact: true }).click();
  await expect(page).toHaveURL(/\/new#history$/u);
  await expect(page.getByRole("tab", { name: "My shares" })).toHaveAttribute("aria-selected", "true");
  await page.goBack();

  await page.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/\/new#how-it-works$/u);
  await expect(page.getByRole("heading", { name: /a share should reveal as little as possible/i })).toBeVisible();
  await page.goBack();

  await page.locator(".landing-hero").getByRole("link", { name: "Self-Hosting", exact: true }).click();
  await expect(page).toHaveURL(/\/#self-hosting$/u);
  await expect(page.getByRole("heading", { name: /Run SecureBin on your terms/i })).toBeVisible();
});

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

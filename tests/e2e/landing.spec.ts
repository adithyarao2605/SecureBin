import { expect, test } from "@playwright/test";

test("landing page presents the technical shell and real create action", async ({ page }) => {
  await page.goto("/");

  const primaryNav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(page.getByRole("heading", { name: /Share sensitive information/i })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Features", exact: true })).toHaveAttribute("href", "#features");
  await expect(primaryNav.getByRole("link", { name: "Security", exact: true })).toHaveAttribute("href", "#security");
  const selfHostLink = primaryNav.getByRole("link", { name: "Self-Host", exact: true });
  await expect(selfHostLink).toHaveAttribute("href", /\/self_hosting\.md$/u);
  await expect(selfHostLink).toHaveAttribute("target", "_blank");
  await expect(primaryNav.getByRole("link", { name: "Docs", exact: true })).toHaveAttribute("href", "/new#how-it-works");
  await expect(page.locator(".landing-hero").getByRole("link", { name: /Create secure share/i })).toHaveAttribute("href", "/new");
  await expect(page.getByText("Paste sensitive credentials, API keys, or notes here...", { exact: true })).toBeVisible();
});

test("landing actions reach real destinations", async ({ page }) => {
  await page.goto("/");
  const primaryNav = page.getByRole("navigation", { name: "Primary navigation" });

  await page.locator(".landing-hero").getByRole("link", { name: /Create secure share/i }).click();
  await expect(page).toHaveURL(/\/new$/u);
  await page.goBack();

  await primaryNav.getByRole("link", { name: "Docs", exact: true }).click();
  await expect(page).toHaveURL(/\/new#how-it-works$/u);
  await expect(page.getByRole("heading", { name: /a share should reveal as little as possible/i })).toBeVisible();
  await page.goBack();

  await page.locator(".landing-hero").getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/\/#security$/u);
  await expect(page.getByRole("heading", { name: "Encryption stays local" })).toBeVisible();
});

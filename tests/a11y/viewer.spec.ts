import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the ready viewer has no critical accessibility violations", async ({ page }) => {
  const publicId = "A".repeat(22);
  const linkSecret = "A".repeat(43);

  await page.route(/\/api\/shares\/[^/]+\/status$/u, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "active",
        availableAt: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
        maxReveals: null,
        remainingReveals: null,
        passwordRequired: false,
        unlockRequired: false
      })
    });
  });

  await page.goto(`/s/${publicId}#${linkSecret}`);
  await expect(page.getByRole("button", { name: "Reveal" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});

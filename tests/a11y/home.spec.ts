import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the composer has no critical accessibility violations", async ({ page }) => {
  await page.goto("/new");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});

test("the landing page has no critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});

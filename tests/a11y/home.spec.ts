import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the landing composer has no critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});

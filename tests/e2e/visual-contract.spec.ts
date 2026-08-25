import { expect, test } from "@playwright/test";

async function capture(page: import("@playwright/test").Page, testInfo: import("@playwright/test").TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true, animations: "disabled" });
}

test("major public and application views retain the quiet-proof visual contract", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Share sensitive information/u })).toBeVisible();
  const darkTokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return [style.getPropertyValue("--linen").trim(), style.getPropertyValue("--ink").trim(), style.getPropertyValue("--mineral").trim()];
  });
  expect(darkTokens).toEqual(["#000000", "#f4f4f4", "#79b8b0"]);
  await capture(page, testInfo, "landing-dark-desktop");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightTokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return [style.getPropertyValue("--linen").trim(), style.getPropertyValue("--ink").trim(), style.getPropertyValue("--mineral").trim()];
  });
  expect(lightTokens).toEqual(["#f4f0e8", "#17242d", "#2f7071"]);
  await capture(page, testInfo, "landing-light-desktop");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.goto("/new");
  await expect(page.getByRole("heading", { name: "Create a private share" })).toBeVisible();
  await capture(page, testInfo, "new-create-desktop");

  await page.getByRole("tab", { name: /My shares/u }).click();
  await expect(page.getByRole("heading", { name: "No shares created yet" })).toBeVisible();
  await capture(page, testInfo, "new-history-empty-desktop");

  await page.getByRole("tab", { name: "How it works" }).click();
  await expect(page.getByRole("heading", { name: /a share should reveal as little as possible/iu })).toBeVisible();
  await capture(page, testInfo, "new-how-it-works-desktop");

  await page.getByRole("button", { name: "Open parcel" }).click();
  await expect(page.getByRole("heading", { name: "Open a .securebin parcel" })).toBeVisible();
  await capture(page, testInfo, "new-parcel-empty-desktop");
});

test("320 and 390 pixel layouts, reduced motion, and recipient empty states are deliberate", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Share sensitive information/u })).toBeVisible();
  await capture(page, testInfo, "landing-light-320-reduced-motion");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/new");
  await expect(page.getByRole("heading", { name: "Create a private share" })).toBeVisible();
  await capture(page, testInfo, "new-create-390-status-strip");

  await page.goto("/s/AQEBAQEBAQEBAQEBAQEBAQ");
  await expect(page.getByText(/missing its decryption key/u)).toBeVisible();
  await capture(page, testInfo, "viewer-incomplete-390");
});

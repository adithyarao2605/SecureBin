import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("the factor gate has no critical accessibility violations", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/new");
  await page.getByLabel("Note content").fill("A11y factor-gate probe note.");
  await page.getByRole("button", { name: /Add password or second channel/u }).click();
  await page.getByLabel("Password (optional)").fill("a11y-probe-password");
  await page.getByLabel("Confirm password").fill("a11y-probe-password");
  await page.getByRole("checkbox", { name: /separate unlock code/iu }).check();
  await page.getByRole("button", { name: "Create share" }).click();
  const shareLink = await page.getByRole("textbox", { name: "Share link" }).inputValue();

  await page.goto(shareLink);
  await expect(page.getByLabel("Password")).toBeVisible({ timeout: 20_000 });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});

test("the fully opened share has no critical accessibility violations", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/new");
  await page.getByLabel("Note content").fill("A11y opened-view probe note.");
  await page.setInputFiles("#file-attachment-input", {
    name: "probe.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_BASE64, "base64"),
  });
  await expect(page.getByText("probe.png")).toBeVisible();
  await page.getByRole("button", { name: "Create share" }).click();
  const shareLinkInput = page.getByRole("textbox", { name: "Share link" });
  await expect(shareLinkInput).toBeVisible({ timeout: 30_000 });

  await page.goto(await shareLinkInput.inputValue());
  const revealButton = page.getByRole("button", { name: "Reveal" });
  await expect(revealButton).toBeVisible({ timeout: 20_000 });
  await revealButton.click();

  await expect(page.getByText("A11y opened-view probe note.")).toBeVisible({ timeout: 20_000 });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});

test("the discussion thread has no critical accessibility violations", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/new");
  await page.getByLabel("Note content").fill("A11y discussion probe note.");
  await page.getByRole("checkbox", { name: /Enable encrypted discussion/i }).check();
  await page.getByRole("button", { name: "Create share" }).click();
  const shareLinkInput = page.getByRole("textbox", { name: "Share link" });
  await expect(shareLinkInput).toBeVisible({ timeout: 30_000 });

  await page.goto(await shareLinkInput.inputValue());
  const revealButton = page.getByRole("button", { name: "Reveal" });
  await expect(revealButton).toBeVisible({ timeout: 20_000 });
  await revealButton.click();

  const thread = page.getByLabel("Encrypted discussion");
  await expect(thread).toBeVisible({ timeout: 20_000 });
  await thread.getByPlaceholder("Write a reply…").fill("A11y probe reply");
  await thread.getByRole("button", { name: "Post" }).click();
  await expect(thread.getByText("A11y probe reply")).toBeVisible({ timeout: 15_000 });

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});

import { expect, test, type Page } from "@playwright/test";

// Reveal window contract on the real backend: the sender caps the span
// between the first and last ciphertext release. After the window closes,
// fresh recipients hit the uniform unavailable path while the sender's own
// retry token would still work inside its lease.
// Requires `pnpm supabase:start`.

const NOTE = "Late recipients see nothing after the window closes.";

async function revealFully(scope: Page): Promise<void> {
  const revealButton = scope.getByRole("button", { name: "Reveal" });
  await expect(revealButton).toBeVisible({ timeout: 20_000 });
  await revealButton.click();
  const confirm = scope.getByRole("button", { name: "Yes, reveal now" });
  await expect(confirm).toBeVisible({ timeout: 20_000 });
  await confirm.click();
}

test("closes further releases after the chosen window elapses", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/new");
  await page.getByLabel("Note content").fill(NOTE);
  await page.getByText("Customize policy", { exact: true }).click();
  await page
    .getByRole("group", { name: "How many times can the ciphertext be released?" })
    .getByText("3 reveals")
    .click();
  await page.getByLabel("Release window after the first opening").selectOption("10s");
  await page.getByRole("button", { name: "Create share" }).click();

  const shareLinkInput = page.getByRole("textbox", { name: "Share link" });
  await expect(shareLinkInput).toBeVisible({ timeout: 30_000 });
  const shareHref = await shareLinkInput.inputValue();

  // First opening starts the window.
  await page.goto(shareHref);
  await revealFully(page);
  await expect(page.getByText(NOTE)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Release window ·/u)).toBeVisible();
  await expect(page.getByText(/Closes at/iu)).toBeVisible();
  await expect(page.getByText(/cannot erase copies\s+a recipient has already saved/iu)).toBeVisible();

  // A second tab inside the window still releases.
  const earlyPage = await page.context().newPage();
  await earlyPage.goto(shareHref);
  await revealFully(earlyPage);
  await expect(earlyPage.getByText(NOTE)).toBeVisible({ timeout: 20_000 });
  await earlyPage.close();

  // After the window closes, a fresh recipient is uniformly unavailable.
  await page.waitForTimeout(10_500);
  await expect(page.getByText(NOTE)).not.toBeVisible();
  await expect(page.getByText(/This release window closed/iu)).toBeVisible();
  const latePage = await page.context().newPage();
  await latePage.goto(shareHref);
  await expect(
    latePage.getByText("This share is no longer available. Ask the sender for a new link.")
  ).toBeVisible({ timeout: 20_000 });
  await latePage.close();
});

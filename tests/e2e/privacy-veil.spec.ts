import { expect, test } from "@playwright/test";

// Privacy veil (Day 6 §3): decrypted content is veiled by default on the
// opened view; showing it is a purely local action (no network traffic), and
// Esc re-hides. Requires `pnpm supabase:start`.

const NOTE = "Privacy veil probe: only this browser can read me.";

test("veils decrypted content locally and never calls the server to re-show", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/new");
  await page.getByLabel("Note content").fill(NOTE);
  await page.getByRole("button", { name: "Create share" }).click();
  const shareLinkInput = page.getByRole("textbox", { name: "Share link" });
  await expect(shareLinkInput).toBeVisible({ timeout: 30_000 });

  let apiCallsAfterOpen = 0;
  let opened = false;
  page.on("request", (request) => {
    if (!opened || !new URL(request.url()).pathname.startsWith("/api/")) return;
    apiCallsAfterOpen += 1;
  });

  await page.goto(await shareLinkInput.inputValue());
  const revealButton = page.getByRole("button", { name: "Reveal" });
  await expect(revealButton).toBeVisible({ timeout: 20_000 });
  await revealButton.click();

  const veilRegion = page.locator(".privacy-veil");
  await expect(veilRegion).toBeVisible({ timeout: 20_000 });
  // Opened state reached: from here on, veil toggles must be offline.
  await expect(page.getByRole("button", { name: "Hide decrypted content" })).toBeVisible();
  opened = true;

  expect(await veilRegion.getAttribute("data-veiled")).toBe("false");
  await expect(page.getByText(NOTE)).toBeAttached();

  await page.getByRole("button", { name: "Hide decrypted content" }).click();
  expect(await veilRegion.getAttribute("data-veiled")).toBe("true");

  await page.keyboard.press("Escape");
  expect(await veilRegion.getAttribute("data-veiled")).toBe("true");

  // Showing again stays fully local.
  await page.getByRole("button", { name: "Show decrypted content" }).click();
  expect(await veilRegion.getAttribute("data-veiled")).toBe("false");
  expect(apiCallsAfterOpen).toBe(0);
});

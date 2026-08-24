import { expect, test } from "@playwright/test";

// Real-backend protection round trip: password + two-channel unlock.
// Asserts the password and unlock code NEVER cross the network, and that the
// viewer demands factors before any reveal authorization happens.

const NOTE = "Protected share: link alone must not be enough.";
const PASSWORD = "correct-horse-battery";

test("creates a password + unlock protected share and reveals with both factors", async ({ page }) => {
  test.setTimeout(60_000);

  const bodies: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") bodies.push(request.postData() ?? "");
  });

  await page.goto("/new");
  await page.getByLabel("Note content").fill(NOTE);
  await page.getByRole("button", { name: /Add password or second channel/u }).click();

  await page.getByLabel("Password (optional)").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("checkbox", { name: /separate unlock code/iu }).check();
  await page.getByRole("button", { name: "Create share" }).click();

  const unlockBox = page.getByText(/Second-channel unlock code/u);
  await expect(unlockBox).toBeVisible({ timeout: 30_000 });
  const code = (await page.locator(".unlock-code").textContent())?.trim() ?? "";
  expect(code.length).toBeGreaterThanOrEqual(27);

  // ZK assertions: neither factor ever appears in any request body.
  const allBodies = bodies.join("\n");
  expect(allBodies).not.toContain(PASSWORD);
  expect(allBodies).not.toContain(code.replace(/-/g, ""));

  const shareLink = await page.getByRole("textbox", { name: "Share link" }).inputValue();
  await page.goto(shareLink);

  // Factor gate blocks before reveal; Reveal button is absent until satisfied.
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByLabel(/Unlock code/iu)).toBeVisible();
  expect(await page.getByRole("button", { name: /^Reveal$/u }).count()).toBe(0);

  // A wrong password fails locally after authorization (client-only factors
  // cannot be verified server-side without breaking zero-knowledge); the gate
  // reopens so the recipient can correct it.
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByLabel(/Unlock code/iu).fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Reveal" }).click();
  await expect(page.getByText(/Could not decrypt with the supplied local factors/iu).first()).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();

  // Correct factors succeed.
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Reveal" }).click();
  await expect(page.getByText(NOTE)).toBeVisible({ timeout: 30_000 });
});

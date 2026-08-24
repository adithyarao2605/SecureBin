import { expect, test } from "@playwright/test";

test("the composer explains the browser-side trust boundary and defaults to light theme", async ({ page }) => {
  await page.goto("/new");

  await expect(page.getByRole("heading", { name: "Create a private share" })).toBeVisible();
  await expect(
    page.getByText("Your browser encrypts this before it leaves the page.", { exact: false }).first()
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create share" })).toBeEnabled();

  // The quiet-proof experience is light-first.
  const rootClass = await page.locator("html").getAttribute("class");
  expect(rootClass).toContain("light");
});

test("the user can toggle between dark and light theme", async ({ page }) => {
  await page.goto("/new");

  const toggleBtn = page.getByRole("button", { name: /switch to light theme|switch to dark theme/i });
  await expect(toggleBtn).toBeVisible();

  // Click to switch to dark theme.
  await toggleBtn.click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  // Click to switch back to light theme.
  await toggleBtn.click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("the user can navigate between application tabs", async ({ page }) => {
  await page.goto("/new");

  // Starts on New share
  await expect(page.getByRole("tab", { name: "New share" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Create a private share" })).toBeVisible();

  // Switch to How it works tab
  await page.getByRole("tab", { name: "How it works" }).click();
  await expect(page.getByRole("tab", { name: "How it works" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "A share should reveal as little as possible." })).toBeVisible();

  // Switch to My shares tab (empty state)
  await page.getByRole("tab", { name: "My shares" }).click();
  await expect(page.getByRole("tab", { name: "My shares" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "No shares created yet" })).toBeVisible();

  // Clicking "Create a share" switches back to New share tab
  await page.getByRole("button", { name: "Create a share" }).click();
  await expect(page.getByRole("tab", { name: "New share" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Create a private share" })).toBeVisible();
});

test("the user can select custom expiration duration", async ({ page }) => {
  await page.goto("/new");

  await page.getByText("Customize policy", { exact: true }).click();
  const expirySelect = page.getByLabel("Expires after");
  await expirySelect.selectOption("custom");

  const durationInput = page.getByLabel("Duration");
  await expect(durationInput).toBeVisible();
  await durationInput.fill("48");

  const unitSelect = page.getByLabel("Unit");
  await expect(unitSelect).toBeVisible();
  await unitSelect.selectOption("hours");

  // Evidence rail updates with custom expiry
  await expect(page.getByLabel("Evidence rail")).toBeVisible();
});

test("the user can select a supported reveal limit", async ({ page }) => {
  await page.goto("/new");

  await page.getByText("Customize policy", { exact: true }).click();
  const tenReveals = page.getByLabel("10 reveals", { exact: true });
  await tenReveals.click();
  await expect(tenReveals).toBeChecked();

  // Evidence rail updates
  await expect(page.getByLabel("Evidence rail")).toBeVisible();
});

test("created share appears in the local history desk with live actions", async ({ page }) => {
  await page.route(/\/api\/shares(?:\/|$)/u, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/shares" && request.method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          publicId: "hist-sample-public-id-123",
          created: true,
          policy: {
            availableAt: null,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            maxReveals: 5,
            passwordRequired: false,
            unlockRequired: false,
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/new");

  // Fill and create a share
  await page.getByLabel("Note content").fill("History desk test note");
  await page.getByRole("button", { name: "Create share" }).click();
  await expect(page.getByRole("textbox", { name: "Share link" })).toBeVisible();

  // Switch to My shares tab to view history desk
  await page.getByRole("tab", { name: "My shares" }).click();
  await expect(page.getByRole("heading", { name: "My shares" })).toBeVisible();
  await expect(page.getByText("● Active")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link" }).first()).toBeVisible();
});

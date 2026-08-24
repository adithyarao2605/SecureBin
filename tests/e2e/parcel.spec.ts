import { expect, test } from "@playwright/test";

// .securebin parcels: export a portable encrypted bundle at create
// time, then restore it fully offline — every /api and Storage request is
// blocked during import to prove no round-trip exists.

const NOTE = "Parcel offline probe: decrypt me without a server.";

test("exports a parcel at creation and restores it offline", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/new");
  await page.getByLabel("Note content").fill(NOTE);
  await page.getByRole("button", { name: "Create share" }).click();
  const shareLinkInput = page.getByRole("textbox", { name: "Share link" });
  await expect(shareLinkInput).toBeVisible({ timeout: 30_000 });

  // Export the parcel offered on the result card.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .securebin parcel" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.securebin$/u);
  const parcelPath = await download.path();
  expect(parcelPath).toBeTruthy();

  const shareUrl = await shareLinkInput.inputValue();
  const fragmentKey = new URL(shareUrl).hash.slice(1);

  // Restore it in a fresh page where ALL network access fails closed.
  const offline = await page.context().newPage();
  await offline.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/storage/")) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await offline.goto("/new");
  await offline.getByRole("button", { name: "Open parcel" }).click();
  await expect(offline.getByRole("heading", { name: "Open a .securebin parcel" })).toBeVisible();
  await offline.setInputFiles("#parcel-file-input", {
    name: "probe.securebin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from((await import("node:fs")).readFileSync(parcelPath!)),
  });

  await expect(offline.getByText(/SBPX v1 · sealed content/u)).toBeVisible({ timeout: 15_000 });
  await offline.getByLabel("Fragment key (the text after # in the share link)").fill(fragmentKey);
  await offline.getByRole("button", { name: "Decrypt offline" }).click();

  await expect(offline.getByText(NOTE)).toBeVisible({ timeout: 20_000 });

  // A wrong key fails closed without network help.
  const wrongKey = offline.getByRole("button", { name: "Restore another parcel" });
  await wrongKey.click();
  await offline.setInputFiles("#parcel-file-input", {
    name: "probe.securebin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from((await import("node:fs")).readFileSync(parcelPath!)),
  });
  await expect(offline.getByText(/SBPX v1 · sealed content/u)).toBeVisible({ timeout: 15_000 });
  await offline
    .getByLabel("Fragment key (the text after # in the share link)")
    .fill("A".repeat(43));
  await offline.getByRole("button", { name: "Decrypt offline" }).click();
  await expect(
    offline.getByText(/Could not decrypt with the supplied local factors/iu)
  ).toBeVisible({ timeout: 20_000 });
});

import { expect, test } from "@playwright/test";

// Real-backend attachment round trip: exercises the browser CSP connect-src
// allowance, the staged upload reservation, the direct Storage PUT, share
// creation with size verification, and the signed-download + local decrypt
// path. Requires `pnpm supabase:start` (the webServer dev build loads .env).

const NOTE = "Attachment round trip: the note and the file must both survive.";
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("creates a share with an encrypted attachment and reveals both", async ({ page }) => {
  test.setTimeout(60_000);

  const capturedBodies: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/shares") {
      capturedBodies.push(request.postData() ?? "");
    }
  });
  page.on("requestfailed", (request) => {
    console.log(`[diag] FAILED ${request.method()} ${request.url()} :: ${request.failure()?.errorText}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`[diag] console.error: ${message.text().slice(0, 300)}`);
  });

  await page.goto("/");
  await page.getByLabel("Note content").fill(NOTE);

  await page.setInputFiles("#file-attachment-input", {
    name: "probe.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_BASE64, "base64"),
  });
  await expect(page.getByText("probe.png")).toBeVisible();

  await page.getByRole("button", { name: "Create share" }).click();
  const shareLinkInput = page.getByRole("textbox", { name: "Share link" });
  await expect(shareLinkInput).toBeVisible({ timeout: 30_000 });

  // Zero-knowledge: the plaintext filename must never cross the network.
  expect(capturedBodies.every((body) => !body.includes("probe.png"))).toBe(true);
  const createBody = capturedBodies.find((body) => body.includes("fileEnvelope"));
  expect(createBody).toBeTruthy();
  const parsed = JSON.parse(createBody ?? "{}") as { fileCiphertextSize?: unknown };
  expect(typeof parsed.fileCiphertextSize).toBe("number");
  expect(parsed.fileCiphertextSize).toBeGreaterThan(16);

  const shareHref = await shareLinkInput.inputValue();
  await page.goto(shareHref);

  const revealButton = page.getByRole("button", { name: "Reveal" });
  await expect(revealButton).toBeVisible();
  await revealButton.click();

  await expect(page.getByText(NOTE)).toBeVisible();
  const attachmentCard = page.getByLabel("Decrypted file attachment");
  await expect(attachmentCard).toBeVisible();
  await expect(attachmentCard.getByRole("heading", { name: /📎 probe\.png/u })).toBeVisible();

  // Magic-byte detection drives an inline image preview via a blob URL.
  const preview = attachmentCard.locator("img.attachment-image-preview");
  await expect(preview).toBeVisible();
  expect(await preview.getAttribute("src")).toMatch(/^blob:/u);

  const downloadButton = attachmentCard.getByRole("link", { name: /Download probe\.png/u });
  await expect(downloadButton).toBeVisible();
});

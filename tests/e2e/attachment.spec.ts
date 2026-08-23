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
    if (request.method() !== "POST") return;
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/shares" || pathname === "/api/uploads") {
      capturedBodies.push(request.postData() ?? "");
    }
  });
  page.on("requestfailed", (request) => {
    console.log(`[diag] FAILED ${request.method()} ${request.url()} :: ${request.failure()?.errorText}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`[diag] console.error: ${message.text().slice(0, 300)}`);
  });

  await page.goto("/new");
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

  const reservationBody = capturedBodies.find((body) => body.includes("fileEnvelope"));
  expect(reservationBody, "reservation request was not intercepted").toBeTruthy();
  expect(reservationBody).toBeTruthy();
  const reservation = JSON.parse(reservationBody ?? "{}") as {
    expectedCiphertextSize?: unknown;
    attachmentSlot?: unknown;
  };
  expect(reservation.attachmentSlot).toBe(0);
  expect(reservation.expectedCiphertextSize).toBeGreaterThan(16);

  // The create request itself carries no attachment material at all.
  const createBody = capturedBodies.find((body) => !body.includes("fileEnvelope"));
  expect(createBody, "create request was not intercepted").toBeTruthy();
  expect(JSON.parse(createBody ?? "{}")).not.toHaveProperty("fileEnvelope");

  const shareHref = await shareLinkInput.inputValue();
  await page.goto(shareHref);

  const revealButton = page.getByRole("button", { name: "Reveal" });
  await expect(revealButton).toBeVisible({ timeout: 20_000 });
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

test("accepts drag-dropped multi-file uploads and downloads them as one ZIP", async ({ page }) => {
  test.setTimeout(90_000);

  const capturedSlots: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST" || new URL(request.url()).pathname !== "/api/uploads") return;
    try {
      capturedSlots.push((JSON.parse(request.postData() ?? "{}") as { attachmentSlot?: unknown }).attachmentSlot);
    } catch {
      // ignore non-JSON probes
    }
  });

  await page.goto("/new");
  await page.getByLabel("Note content").fill("Multi-file round trip through drag and drop.");

  const files = [
    { name: "alpha.png", mime: "image/png", b64: PNG_BASE64 },
    { name: "beta.txt", mime: "text/plain", b64: Buffer.from("beta plaintext body").toString("base64") },
    { name: "gamma.md", mime: "text/markdown", b64: Buffer.from("# gamma\nbody").toString("base64") },
  ];
  const dropZone = page.locator(".file-attachment-section");
  for (const file of files) {
    await dropZone.evaluate(
      (element, { name, mime, b64 }) => {
        const bytes = Uint8Array.from(atob(b64), (character) => character.charCodeAt(0));
        const transfer = new DataTransfer();
        transfer.items.add(new File([bytes], name, { type: mime }));
        element.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true }));
      },
      file
    );
  }
  for (const file of files) {
    await expect(page.getByText(file.name)).toBeVisible();
  }

  await page.getByRole("button", { name: "Create share" }).click();
  const shareLinkInput = page.getByRole("textbox", { name: "Share link" });
  await expect(shareLinkInput).toBeVisible({ timeout: 30_000 });

  // Each staged file must reserve its own slot — this is the server-side
  // multi-file contract (slot forwarded to the reservation RPC).
  expect(capturedSlots.sort()).toEqual([0, 1, 2]);

  const shareHref = await shareLinkInput.inputValue();
  await page.goto(shareHref);
  const revealButton = page.getByRole("button", { name: "Reveal" });
  await expect(revealButton).toBeVisible({ timeout: 20_000 });
  await revealButton.click();

  for (const file of files) {
    await expect(page.getByLabel("Decrypted file attachment").getByRole("heading", { name: new RegExp(file.name, "u") })).toBeVisible();
  }

  const zipButton = page.getByRole("button", { name: /Download all \(ZIP\)/u });
  await expect(zipButton).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await zipButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/u);
});

import { expect, test } from "@playwright/test";

const NOTE = "Day 2 browser-sealed note: only the intended recipient should read this.";
const BASE64URL = /^[A-Za-z0-9_-]+$/u;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonRecord(value: string): JsonRecord {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) throw new Error("Expected a JSON object.");
  return parsed;
}

function expectBase64Url(value: unknown, byteLength: number) {
  expect(typeof value).toBe("string");
  if (typeof value !== "string") return;
  expect(value).toMatch(BASE64URL);
  const expectedLength = Math.ceil(byteLength / 3) * 4 - (byteLength % 3 === 1 ? 2 : byteLength % 3 === 2 ? 1 : 0);
  expect(value.length).toBe(expectedLength);
}

function expectContentEnvelope(value: unknown) {
  expect(isRecord(value)).toBe(true);
  if (!isRecord(value)) return;

  expect(Object.keys(value).sort()).toEqual([
    "algorithm",
    "ciphertext",
    "factorMask",
    "hkdfSalt",
    "kdf",
    "kdfParameters",
    "nonce",
    "objectType",
    "passwordSalt",
    "version",
  ]);
  expect(value.version).toBe(2);
  expect(value.objectType).toBe("content");
  expect(value.algorithm).toBe("AES-256-GCM");
  expect(value.kdf).toBe("none");
  expect(value.kdfParameters).toEqual({});
  expect(value.factorMask).toBe("link");
  expect(value.passwordSalt).toBeNull();
  expectBase64Url(value.nonce, 12);
  expectBase64Url(value.hkdfSalt, 16);
  expect(typeof value.ciphertext).toBe("string");
  if (typeof value.ciphertext === "string") {
    expect(value.ciphertext).toMatch(BASE64URL);
    expect(value.ciphertext.length).toBeGreaterThanOrEqual(22);
  }
}

test("seals a note locally, sends ciphertext-only data, and decrypts it in the viewer", async ({ page }) => {
  const observedRequests: Array<{ url: string; body: string }> = [];
  const capture: { createBody: JsonRecord | null; envelope: unknown } = { createBody: null, envelope: null };

  page.on("request", (request) => {
    observedRequests.push({ url: request.url(), body: request.postData() ?? "" });
  });

  await page.route(/\/api\/shares(?:\/|$)/u, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/shares" && request.method() === "POST") {
      capture.createBody = parseJsonRecord(request.postData() ?? "");
      capture.envelope = capture.createBody.contentEnvelope;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ publicId: capture.createBody.publicId }),
      });
      return;
    }

    if (pathname.endsWith("/status") && request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          status: "active",
          availableAt: null,
          expiresAt: "2099-01-01T00:00:00.000Z",
          maxReveals: null,
          remainingReveals: null,
          passwordRequired: false,
          unlockRequired: false,
        }),
      });
      return;
    }

    if (pathname.endsWith("/reveal") && request.method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          status: "authorized",
          contentEnvelope: capture.envelope,
          files: [],
          retryExpiresAt: "2099-01-01T00:05:00.000Z",
          releaseWindowEndsAt: null,
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/new");
  await page.getByLabel("Note content").fill(NOTE);
  await page.getByRole("button", { name: "Create share" }).click();

  const shareLinkInput = page.getByRole("textbox", { name: "Share link" });
  await expect(shareLinkInput).toBeVisible();

  const createBody = capture.createBody;
  expect(createBody, "create request was not intercepted").not.toBeNull();
  if (!createBody) throw new Error("unreachable: create body asserted above");
  expect(createBody).not.toHaveProperty("deleteCapability");
  expect(createBody).not.toHaveProperty("idempotencyKey");
  expect(createBody).not.toHaveProperty("linkSecret");
  expect(createBody).not.toHaveProperty("plaintext");
  expect(JSON.stringify(createBody)).not.toContain(NOTE);
  expect(typeof createBody.publicId).toBe("string");
  expectBase64Url(createBody.publicId, 16);
  expectBase64Url(createBody.deleteTokenHash, 32);
  expectBase64Url(createBody.idempotencyKeyHash, 32);
  expectContentEnvelope(createBody.contentEnvelope);

  const shareHref = await shareLinkInput.inputValue();
  expect(shareHref).not.toBeNull();
  const shareUrl = new URL(shareHref);
  const publicId = shareUrl.pathname.split("/").at(-1);
  const linkSecret = shareUrl.hash.slice(1);
  expect(publicId).toBe(createBody.publicId);
  expect(linkSecret).toMatch(BASE64URL);
  expect(linkSecret).toHaveLength(43);
  expect(shareUrl.hash).toBe(`#${linkSecret}`);

  await page.goto(shareHref);
  await expect(page.getByText("Ready to reveal").first()).toBeVisible();
  const revealButton = page.getByRole("button", { name: "Reveal" });
  await expect(revealButton).toBeVisible();
  await revealButton.click();
  await expect(page.getByText(NOTE)).toBeVisible();

  expect(new URL(page.url()).hash).toBe(`#${linkSecret}`);
  expect(observedRequests.every(({ url, body }) => !url.includes(linkSecret) && !body.includes(linkSecret))).toBe(true);
  expect(observedRequests.every(({ url, body }) => !url.includes(NOTE) && !body.includes(NOTE))).toBe(true);
  expect(observedRequests.every(({ url, body }) => !url.includes("deleteCapability") && !body.includes("deleteCapability"))).toBe(true);
  expect(observedRequests.every(({ url, body }) => !url.includes("idempotencyKey") && !body.includes('"idempotencyKey":'))).toBe(true);
});

test("the composer remains usable from the keyboard on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/new");

  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeEnabled();
  const textarea = page.getByLabel("Note content");
  await textarea.focus();
  await expect(textarea).toBeFocused();
  await textarea.pressSequentially("Keyboard check");
  await expect(textarea).toHaveValue("Keyboard check");

  const createButton = page.getByRole("button", { name: "Create share" });
  await createButton.focus();
  await expect(createButton).toBeFocused();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true);
});

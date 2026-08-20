import { describe, expect, it } from "vitest";
import { base64UrlToBytes, bytesToArrayBuffer, bytesToBase64Url, utf8Encode } from "../../lib/crypto/encoding";
import { openContent, sealContent } from "../../lib/crypto/content";
import { canonicalAad, CONTENT_HKDF_LABEL, EnvelopeValidationError, MAX_CONTENT_BYTES, newContentEnvelope, validateContentEnvelope } from "../../lib/crypto/envelope";

async function sealGoldenVector(): Promise<ReturnType<typeof newContentEnvelope>> {
  const publicIdBytes = new Uint8Array(16).fill(0x11);
  const linkSecretBytes = new Uint8Array(32).fill(0x22);
  const nonce = new Uint8Array(12).fill(0x33);
  const hkdfSalt = new Uint8Array(16).fill(0x44);
  const publicId = bytesToBase64Url(publicIdBytes);
  const linkSecretKey = await crypto.subtle.importKey("raw", bytesToArrayBuffer(linkSecretBytes), "HKDF", false, ["deriveKey"]);
  const contentKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: bytesToArrayBuffer(hkdfSalt), info: bytesToArrayBuffer(utf8Encode(CONTENT_HKDF_LABEL)) },
    linkSecretKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const shape = newContentEnvelope(nonce, hkdfSalt, new Uint8Array(16));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bytesToArrayBuffer(nonce), additionalData: bytesToArrayBuffer(canonicalAad(publicId, shape)) },
    contentKey,
    bytesToArrayBuffer(utf8Encode("golden vector"))
  ));
  return newContentEnvelope(nonce, hkdfSalt, ciphertext);
}

describe("SecureBin v1 browser content crypto", () => {
  it("round-trips UTF-8 text with independent IDs and fresh envelope values", async () => {
    const first = await sealContent("A note with café and こんにちは.");
    const second = await sealContent("A note with café and こんにちは.");

    await expect(openContent(first.envelope, first.publicId, first.linkSecret)).resolves.toBe("A note with café and こんにちは.");
    expect(first.publicId).not.toBe(second.publicId);
    expect(first.linkSecret).not.toBe(second.linkSecret);
    expect(first.envelope.nonce).not.toBe(second.envelope.nonce);
    expect(first.envelope.hkdfSalt).not.toBe(second.envelope.hkdfSalt);
  });

  it("does not open with a different fragment secret", async () => {
    const sealed = await sealContent("Only the matching fragment can open this.");
    const wrongSecret = bytesToBase64Url(new Uint8Array(32).fill(7));
    await expect(openContent(sealed.envelope, sealed.publicId, wrongSecret)).rejects.toMatchObject({ code: "wrong_key" });
  });

  it("rejects tampering and unknown envelope fields before decryption", async () => {
    const sealed = await sealContent("Authenticated text");
    const tamperedCiphertext = `${sealed.envelope.ciphertext.startsWith("A") ? "B" : "A"}${sealed.envelope.ciphertext.slice(1)}`;
    await expect(openContent({ ...sealed.envelope, ciphertext: tamperedCiphertext }, sealed.publicId, sealed.linkSecret)).rejects.toMatchObject({ code: "wrong_key" });
    expect(() => validateContentEnvelope({ ...sealed.envelope, unsupported: true })).toThrow(EnvelopeValidationError);
  });

  it("rejects noncanonical base64url padding bits", () => {
    expect(() => base64UrlToBytes("Zh")).toThrow();
    expect(bytesToBase64Url(base64UrlToBytes("Zg"))).toBe("Zg");
  });

  it("binds the public ID, object type, algorithm, KDF, and factor mask into fixed-order AAD", () => {
    const publicId = bytesToBase64Url(new Uint8Array(16).fill(1));
    const aad = canonicalAad(publicId, {
      version: 1,
      objectType: "content",
      algorithm: "AES-256-GCM",
      kdf: "none",
      kdfParameters: {},
      factorMask: "link"
    });
    expect(new TextDecoder().decode(aad)).toBe(JSON.stringify(["securebin", 1, publicId, "content", "AES-256-GCM", "none", "{}", "link"]));
  });

  it("matches the locked v1 link/content golden vector", async () => {
    const envelope = await sealGoldenVector();
    expect(envelope).toEqual({
      version: 1,
      objectType: "content",
      algorithm: "AES-256-GCM",
      nonce: "MzMzMzMzMzMzMzMz",
      hkdfSalt: "RERERERERERERERERERERA",
      passwordSalt: null,
      kdf: "none",
      kdfParameters: {},
      factorMask: "link",
      ciphertext: "0JTiqnlQ9k8q5GuExNrVabO8qMGv3Hr-OaWLaUQ"
    });
  });

  it("enforces the 512 KiB UTF-8 plaintext limit", async () => {
    const tooLarge = "é".repeat(Math.floor(MAX_CONTENT_BYTES / 2) + 1);
    expect(utf8Encode(tooLarge).length).toBeGreaterThan(MAX_CONTENT_BYTES);
    await expect(sealContent(tooLarge)).rejects.toMatchObject({ code: "content_too_large" });
  });
});

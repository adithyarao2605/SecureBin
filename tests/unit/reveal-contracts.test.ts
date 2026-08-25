import { describe, expect, it } from "vitest";

import { parseReveal } from "../../app/s/[publicId]/viewer-contracts";

const contentEnvelope = {
  version: 1,
  objectType: "content",
  algorithm: "AES-256-GCM",
  nonce: "AAAAAAAAAAAAAAAA",
  hkdfSalt: "AAAAAAAAAAAAAAAAAAAAAA",
  passwordSalt: null,
  kdf: "none",
  kdfParameters: {},
  factorMask: "link",
  ciphertext: "AAAAAAAAAAAAAAAAAAAAAA",
};

const fileEnvelope = {
  version: 2,
  objectType: "file",
  algorithm: "AES-256-GCM",
  nonce: "AAAAAAAAAAAAAAAA",
  hkdfSalt: "AAAAAAAAAAAAAAAAAAAAAA",
  passwordSalt: null,
  kdf: "none",
  kdfParameters: {},
  factorMask: "link",
};

function revealWithFiles(files: unknown[]) {
  return {
    status: "authorized",
    contentEnvelope,
    files,
    retryExpiresAt: "2099-01-01T00:05:00.000Z",
    releaseWindowEndsAt: null,
  };
}

function validFile(slot = 0) {
  return {
    slot,
    envelope: fileEnvelope,
    ciphertextSize: 16,
    downloadUrl: "https://example.com/storage/object.bin?token=opaque",
  };
}

describe("recipient reveal contract", () => {
  it("accepts bounded attachment metadata and canonicalizes timestamps", () => {
    expect(parseReveal(revealWithFiles([validFile()]))).toMatchObject({
      retryExpiresAt: "2099-01-01T00:05:00.000Z",
      files: [{ slot: 0, ciphertextSize: 16 }],
    });
  });

  it.each([
    ["a duplicate slot", [validFile(0), validFile(0)]],
    ["an out-of-range slot", [validFile(5)]],
    ["an oversized ciphertext", [{ ...validFile(), ciphertextSize: 10_486_423 }]],
    ["a non-http download URL", [{ ...validFile(), downloadUrl: "javascript:alert(1)" }]],
    ["an invalid release timestamp", [{ ...validFile() }]],
  ])("rejects %s", (label, files) => {
    const payload: Record<string, unknown> = revealWithFiles(files);
    if (label === "an invalid release timestamp") payload.releaseWindowEndsAt = "not-a-date";
    expect(() => parseReveal(payload)).toThrow();
  });
});

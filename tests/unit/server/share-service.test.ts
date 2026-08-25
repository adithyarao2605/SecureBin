import { describe, expect, it, vi } from "vitest";

import { ShareServiceError, createShareService } from "../../../lib/server/share-service";
import type { RpcClient } from "../../../lib/server/supabase-rpc";
import type { SecureStorage } from "../../../lib/server/storage";

const publicId = "AQEBAQEBAQEBAQEBAQEBAQ";
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

function baseRevealRow(attachments: unknown[]) {
  return {
    status: "authorized",
    share_id: "11111111-1111-4111-8111-111111111111",
    content_envelope: contentEnvelope,
    attachments,
    reveal_count: 1,
    max_reveals: 3,
    retry_expires_at: "2099-01-01T00:05:00.000Z",
    window_ends_at: null,
  };
}

function attachment(slot = 0) {
  return {
    slot,
    objectPath: "objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bin",
    envelope: fileEnvelope,
    ciphertextSize: 16,
  };
}

function dependencies(row: Record<string, unknown>, downloadUrl = "https://example.com/download") {
  const rpc: RpcClient = {
    call: vi.fn(async () => [row]),
  };
  const storage: SecureStorage = {
    createSignedUpload: vi.fn(),
    createSignedDownload: vi.fn(async () => downloadUrl),
    inspectSize: vi.fn(),
    remove: vi.fn(),
  };
  return { rpc, storage, service: createShareService(rpc, storage) };
}

describe("share reveal response validation", () => {
  it("returns a valid attachment with a signed HTTP(S) URL", async () => {
    const { service } = dependencies(baseRevealRow([attachment()]));
    await expect(service.reveal(publicId, "request-token")).resolves.toMatchObject({
      status: "authorized",
      files: [{ slot: 0, ciphertextSize: 16, downloadUrl: "https://example.com/download" }],
    });
  });

  it.each([
    ["an out-of-range slot", [attachment(5)], "https://example.com/download"],
    ["a duplicate slot", [attachment(0), attachment(0)], "https://example.com/download"],
    ["an invalid storage path", [{ ...attachment(), objectPath: "objects/not-owned.bin" }], "https://example.com/download"],
    ["an oversized ciphertext", [{ ...attachment(), ciphertextSize: 10_486_423 }], "https://example.com/download"],
    ["an unsafe signed URL", [attachment()], "javascript:alert(1)"],
  ])("rejects %s before exposing the attachment", async (_label, attachments, downloadUrl) => {
    const { service, storage } = dependencies(baseRevealRow(attachments), downloadUrl);
    await expect(service.reveal(publicId, "request-token")).rejects.toMatchObject({
      name: ShareServiceError.name,
      kind: "dependency",
    });
    if (_label !== "an unsafe signed URL") expect(storage.createSignedDownload).not.toHaveBeenCalled();
  });
});

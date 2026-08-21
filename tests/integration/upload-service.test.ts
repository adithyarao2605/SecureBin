import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createUploadService } from "@/lib/server/upload-service";
import { createShareService } from "@/lib/server/share-service";
import { createRpcClient } from "@/lib/server/supabase-rpc";
import { createSecureStorage } from "@/lib/server/storage";
import type { Envelope } from "@/lib/shares/contracts";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "*REMOVED*<local-CLI-constant>";

const rpc = createRpcClient({
  supabaseUrl,
  serviceRoleKey,
  rateLimitHmacKey: "test-rate-limit-key",
});
const storage = createSecureStorage({
  supabaseUrl,
  serviceRoleKey,
  rateLimitHmacKey: "test-rate-limit-key",
});

const uploadService = createUploadService(rpc, storage);
const shareService = createShareService(rpc);

function randomPublicId(): string {
  return randomBytes(16).toString("base64url");
}

function randomDigest(): string {
  return randomBytes(32).toString("base64url");
}

function validFileEnvelope(): Envelope & { readonly objectType: "file"; readonly ciphertext?: never } {
  return {
    version: 1,
    objectType: "file",
    algorithm: "AES-256-GCM",
    nonce: randomBytes(12).toString("base64url"),
    hkdfSalt: randomBytes(16).toString("base64url"),
    passwordSalt: null,
    kdf: "none",
    kdfParameters: {},
    factorMask: "link",
  };
}

describe("upload service integration", () => {
  it("creates upload reservation with signed upload URL and handles identical retries", async () => {
    const publicId = randomPublicId();
    const idempotencyKeyHash = randomDigest();
    const fileEnvelope = validFileEnvelope();
    const expectedCiphertextSize = 2048;

    const res1 = await uploadService.createReservation({
      publicId,
      idempotencyKeyHash,
      fileEnvelope,
      expectedCiphertextSize,
    });

    expect(res1.uploadUrl).toBeDefined();
    expect(res1.expiresAt).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/);

    // Identical retry returns valid signed upload operation
    const res2 = await uploadService.createReservation({
      publicId,
      idempotencyKeyHash,
      fileEnvelope,
      expectedCiphertextSize,
    });

    expect(res2.uploadUrl).toBeDefined();
    expect(res2.expiresAt).toBe(res1.expiresAt);
  });

  it("throws conflict error when reserving with conflicting payload on same tuple", async () => {
    const publicId = randomPublicId();
    const idempotencyKeyHash = randomDigest();
    const fileEnvelope = validFileEnvelope();

    await uploadService.createReservation({
      publicId,
      idempotencyKeyHash,
      fileEnvelope,
      expectedCiphertextSize: 1024,
    });

    // Conflicting expectedCiphertextSize
    await expect(uploadService.createReservation({
      publicId,
      idempotencyKeyHash,
      fileEnvelope,
      expectedCiphertextSize: 4096,
    })).rejects.toMatchObject({
      name: "UploadServiceError",
      kind: "conflict",
    });
  });
});

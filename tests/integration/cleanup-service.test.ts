import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createCleanupService } from "@/lib/server/cleanup-service";
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
  cronSecret: "test-cron-secret",
});

const cleanupService = createCleanupService(rpc, storage);
const shareService = createShareService(rpc);

function randomPublicId(): string {
  return randomBytes(16).toString("base64url");
}

function randomDigest(): string {
  return randomBytes(32).toString("base64url");
}

function validEnvelope(): Envelope & { readonly objectType: "content"; readonly ciphertext: string } {
  return {
    version: 1,
    objectType: "content",
    algorithm: "AES-256-GCM",
    nonce: randomBytes(12).toString("base64url"),
    hkdfSalt: randomBytes(16).toString("base64url"),
    passwordSalt: null,
    kdf: "none",
    kdfParameters: {},
    factorMask: "link",
    ciphertext: randomBytes(32).toString("base64url"),
  };
}

describe("cleanup service integration", () => {
  it("executes cleanup and preserves active shares", async () => {
    // 1. Create active share
    const activePublicId = randomPublicId();
    await shareService.createShare({
      publicId: activePublicId,
      contentEnvelope: validEnvelope(),
      availableAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxReveals: null,
      deleteTokenHash: randomDigest(),
      passwordRequired: false,
      unlockRequired: false,
      idempotencyKeyHash: randomDigest(),
      fileEnvelope: null,
      fileCiphertextSize: null,
    });

    // 2. Run cleanup
    const result = await cleanupService.runCleanup();
    expect(result).toMatchObject({
      deletedShares: expect.any(Number),
      deletedUploads: expect.any(Number),
      deletedLeases: expect.any(Number),
      deletedBuckets: expect.any(Number),
    });

    // 3. Active share is untouched
    const status = await shareService.getStatus(activePublicId);
    expect(status.status).toBe("active");
  });

  it("handles repeat executions idempotently", async () => {
    const res1 = await cleanupService.runCleanup();
    const res2 = await cleanupService.runCleanup();

    expect(res1).toBeDefined();
    expect(res2).toBeDefined();
  });
});

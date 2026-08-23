import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createShareService } from "@/lib/server/share-service";
import { sha256Base64Url } from "@/lib/server/hashing";
import { createRpcClient } from "@/lib/server/supabase-rpc";
import { createSecureStorage } from "@/lib/server/storage";
import type { Envelope } from "@/lib/shares/contracts";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rateLimitHmacKey = process.env.RATE_LIMIT_HMAC_KEY;
const cronSecret = process.env.CRON_SECRET;

if (!supabaseUrl || !serviceRoleKey || !rateLimitHmacKey || !cronSecret) {
  throw new Error("Missing required environment variables for integration test");
}

const rpc = createRpcClient({
  supabaseUrl,
  serviceRoleKey,
  rateLimitHmacKey,
});
const storage = createSecureStorage({
  supabaseUrl,
  serviceRoleKey,
  rateLimitHmacKey,
  cronSecret,
});
const service = createShareService(rpc, storage);

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

describe("reveal concurrency and race conditions", () => {
  it("enforces exact 1 authorization among 20 concurrent reveal attempts on burn note", async () => {
    const publicId = randomPublicId();
    const contentEnvelope = validEnvelope();
    const deleteTokenHash = randomDigest();
    const idempotencyKeyHash = randomDigest();

    const created = await service.createShare({
      publicId,
      contentEnvelope,
      availableAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxReveals: 1,
      deleteTokenHash,
      passwordRequired: false,
      unlockRequired: false,
      idempotencyKeyHash,
    });
    expect(created).toEqual({ publicId, created: true });

    // Generate 20 distinct raw reveal tokens
    const tokens = Array.from({ length: 20 }, () => randomBytes(32).toString("base64url"));

    // Launch 20 concurrent reveal requests
    const results = await Promise.allSettled(tokens.map((token) => service.reveal(publicId, token)));

    const authorizedTokens: string[] = [];
    let unavailableCount = 0;

    results.forEach((res, index) => {
      if (res.status !== "fulfilled") {
        throw new Error(`Unexpected reveal rejection: ${res.reason}`);
      }
      const val = res.value;
      if (val.status === "authorized") {
        authorizedTokens.push(tokens[index]);
      } else if (val.status === "unavailable") {
        unavailableCount++;
      } else {
        throw new Error(`Unexpected reveal status: ${JSON.stringify(val)}`);
      }
    });

    expect(authorizedTokens.length).toBe(1);
    expect(unavailableCount).toBe(19);

    // Winner retrying same token returns authorized without incrementing count
    const winningToken = authorizedTokens[0];
    const retryResult = await service.reveal(publicId, winningToken);
    expect(retryResult.status).toBe("authorized");

    // Status shows exhausted (0 remaining reveals)
    const status = await service.getStatus(publicId);
    expect(status.status).toBe("unavailable");
  });

  it("enforces exact 3 authorizations among 20 concurrent reveals on limit=3 share", async () => {
    const publicId = randomPublicId();
    const contentEnvelope = validEnvelope();
    const deleteTokenHash = randomDigest();
    const idempotencyKeyHash = randomDigest();

    await service.createShare({
      publicId,
      contentEnvelope,
      availableAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxReveals: 3,
      deleteTokenHash,
      passwordRequired: false,
      unlockRequired: false,
      idempotencyKeyHash,
    });

    const tokens = Array.from({ length: 20 }, () => randomBytes(32).toString("base64url"));
    const results = await Promise.allSettled(tokens.map((token) => service.reveal(publicId, token)));

    const authorizedTokens: string[] = [];
    let unavailableCount = 0;

    results.forEach((res, index) => {
      if (res.status !== "fulfilled") {
        throw new Error(`Unexpected reveal rejection: ${res.reason}`);
      }
      const val = res.value;
      if (val.status === "authorized") {
        authorizedTokens.push(tokens[index]);
      } else if (val.status === "unavailable") {
        unavailableCount++;
      } else {
        throw new Error(`Unexpected reveal status: ${JSON.stringify(val)}`);
      }
    });

    expect(authorizedTokens.length).toBe(3);
    expect(unavailableCount).toBe(17);

    // Retrying all 3 winners returns authorized
    for (const token of authorizedTokens) {
      const retryResult = await service.reveal(publicId, token);
      expect(retryResult.status).toBe("authorized");
    }

    // Status is now unavailable / exhausted
    const status = await service.getStatus(publicId);
    expect(status.status).toBe("unavailable");
  });

  it("enforces exact 7 authorizations among 20 concurrent reveals on a custom limit=7 share", async () => {
    const publicId = randomPublicId();
    const contentEnvelope = validEnvelope();
    const deleteTokenHash = randomDigest();
    const idempotencyKeyHash = randomDigest();

    await service.createShare({
      publicId,
      contentEnvelope,
      availableAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxReveals: 7,
      deleteTokenHash,
      passwordRequired: false,
      unlockRequired: false,
      idempotencyKeyHash,
    });

    const tokens = Array.from({ length: 20 }, () => randomBytes(32).toString("base64url"));
    const results = await Promise.allSettled(tokens.map((token) => service.reveal(publicId, token)));

    let authorized = 0;
    let unavailable = 0;
    for (const res of results) {
      if (res.status !== "fulfilled") throw new Error(`Unexpected rejection: ${res.reason}`);
      if (res.value.status === "authorized") authorized += 1;
      else if (res.value.status === "unavailable") unavailable += 1;
      else throw new Error(`Unexpected status: ${res.value.status}`);
    }
    expect(authorized).toBe(7);
    expect(unavailable).toBe(13);

    const status = await service.getStatus(publicId);
    expect(status.status).toBe("unavailable");
  });

  it("treats a Never-expiry share as active past any expiry and still revocable", async () => {
    const publicId = randomPublicId();
    const rawDeleteCapability = randomBytes(32).toString("base64url");
    const deleteTokenHash = sha256Base64Url(rawDeleteCapability);
    const idempotencyKeyHash = randomDigest();

    await service.createShare({
      publicId,
      contentEnvelope: validEnvelope(),
      availableAt: null,
      expiresAt: null,
      maxReveals: null,
      deleteTokenHash,
      passwordRequired: false,
      unlockRequired: false,
      idempotencyKeyHash,
    });

    const status = await service.getStatus(publicId);
    expect(status.status).toBe("active");
    if (status.status === "active") expect(status.expiresAt).toBeNull();

    const reveal = await service.reveal(publicId, randomBytes(32).toString("base64url"));
    expect(reveal.status).toBe("authorized");

    const revoked = await service.revoke(publicId, rawDeleteCapability);
    expect(revoked).toBe(true);
    const afterRevoke = await service.getStatus(publicId);
    expect(afterRevoke.status).toBe("unavailable");
  });

  it("handles race between concurrent reveal and revoke safely", async () => {
    const publicId = randomPublicId();
    const contentEnvelope = validEnvelope();
    const rawDeleteCapability = randomBytes(32).toString("base64url");
    const deleteTokenHash = sha256Base64Url(rawDeleteCapability);
    const idempotencyKeyHash = randomDigest();

    await service.createShare({
      publicId,
      contentEnvelope,
      availableAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxReveals: 1,
      deleteTokenHash,
      passwordRequired: false,
      unlockRequired: false,
      idempotencyKeyHash,
    });

    const revealToken = randomBytes(32).toString("base64url");

    // Prove this fixture uses the same UTF-8 capability digest semantics as
    // production before racing the valid capability.
    expect(await service.revoke(publicId, randomBytes(32).toString("base64url"))).toBe(false);

    // Launch reveal and revoke concurrently
    const [revealRes, revokeRes] = await Promise.allSettled([
      service.reveal(publicId, revealToken),
      service.revoke(publicId, rawDeleteCapability),
    ]);

    if (revealRes.status !== "fulfilled" || revokeRes.status !== "fulfilled") {
      throw new Error("reveal/revoke race unexpectedly rejected");
    }
    expect(revokeRes.value).toBe(true);
    expect(["authorized", "unavailable"]).toContain(revealRes.value.status);

    // Post-condition: status must be unavailable
    const status = await service.getStatus(publicId);
    expect(status.status).toBe("unavailable");
  });

  it("rejects reveals for scheduled shares before availableAt", async () => {
    const publicId = randomPublicId();
    const contentEnvelope = validEnvelope();
    const deleteTokenHash = randomDigest();
    const idempotencyKeyHash = randomDigest();

    await service.createShare({
      publicId,
      contentEnvelope,
      availableAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxReveals: null,
      deleteTokenHash,
      passwordRequired: false,
      unlockRequired: false,
      idempotencyKeyHash,
    });

    const revealRes = await service.reveal(publicId, randomBytes(32).toString("base64url"));
    expect(revealRes.status).toBe("unavailable");

    const status = await service.getStatus(publicId);
    expect(status.status).toBe("scheduled");
  });
});

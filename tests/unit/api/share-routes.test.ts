import { describe, expect, it, vi } from "vitest";

import {
  createGetStatusHandler,
  createPostRevealHandler,
  createPostShareHandler,
  type ShareRouteDependencies,
} from "@/lib/server/share-routes";
import { parseCreateShareInput } from "@/lib/shares/contracts";
import type { ShareService } from "@/lib/server/share-service";

const publicId = "abcdefghijklmnopqrstug";
const digest = "a".repeat(43);
const envelope = {
  version: 1,
  objectType: "content" as const,
  algorithm: "AES-256-GCM" as const,
  nonce: "abcdefghijklmnop",
  hkdfSalt: "abcdefghijklmnopqrstug",
  passwordSalt: null,
  kdf: "none" as const,
  kdfParameters: {},
  factorMask: "link" as const,
  ciphertext: "AAAAAAAAAAAAAAAAAAAAAA",
} as const;

function dependencies(service: Partial<ShareService> = {}): ShareRouteDependencies {
  return {
    rateLimitHmacKey: "test-only-key",
    service: {
      consumeRateLimit: vi.fn(async () => true),
      createShare: vi.fn(async () => ({ publicId, created: true })),
      getStatus: vi.fn(async () => ({
        status: "active" as const,
        availableAt: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
        passwordRequired: false,
        unlockRequired: false,
        maxReveals: null,
        remainingReveals: null,
      })),
      reveal: vi.fn(async () => ({ status: "authorized" as const, contentEnvelope: envelope, retryExpiresAt: "2099-01-01T00:05:00.000Z" })),
      revoke: vi.fn(async () => true),
      ...service,
    },
  };
}

describe("share route contracts", () => {
  it("rejects unknown create fields before calling the service", async () => {
    const deps = dependencies();
    const handler = createPostShareHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares", {
      method: "POST",
      body: JSON.stringify({
        publicId,
        contentEnvelope: envelope,
        policy: {
          availableAt: null,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          maxReveals: null,
        },
        deleteTokenHash: digest,
        idempotencyKeyHash: digest,
        passwordRequired: false,
        unlockRequired: false,
        plaintext: "must-not-be-accepted",
      }),
    }));
    expect(response.status).toBe(400);
    expect(deps.service.createShare).not.toHaveBeenCalled();
  });

  it("returns no-store status metadata and never ciphertext", async () => {
    const deps = dependencies();
    const handler = createGetStatusHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares"), { params: Promise.resolve({ publicId }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "active",
      availableAt: null,
      expiresAt: "2099-01-01T00:00:00.000Z",
      passwordRequired: false,
      unlockRequired: false,
      maxReveals: null,
      remainingReveals: null,
    });
  });

  it("requires the exact reveal token shape", async () => {
    const deps = dependencies();
    const handler = createPostRevealHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares", {
      method: "POST",
      body: JSON.stringify({ requestToken: digest, extra: true }),
    }), { params: Promise.resolve({ publicId }) });
    expect(response.status).toBe(400);
    expect(deps.service.reveal).not.toHaveBeenCalled();
  });

  it("rejects ciphertext shorter than the authenticated-encryption tag", () => {
    const input = {
      publicId,
      contentEnvelope: { ...envelope, ciphertext: "AAAAAAAAAAAAAAAAAAAA" },
      policy: {
        availableAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        maxReveals: null,
      },
      deleteTokenHash: digest,
      idempotencyKeyHash: digest,
      passwordRequired: false,
      unlockRequired: false,
    };
    expect(parseCreateShareInput(input)).toBeNull();
  });

  it("rejects noncanonical padded-bit encodings", () => {
    const input = {
      publicId,
      contentEnvelope: { ...envelope, hkdfSalt: "abcdefghijklmnopqrstuv" },
      policy: {
        availableAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        maxReveals: null,
      },
      deleteTokenHash: digest,
      idempotencyKeyHash: digest,
      passwordRequired: false,
      unlockRequired: false,
    };
    expect(parseCreateShareInput(input)).toBeNull();
  });
});

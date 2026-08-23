import { describe, expect, it, vi } from "vitest";

import {
  createDeleteShareHandler,
  createGetStatusHandler,
  createPostRevealHandler,
  createPostShareHandler,
  type ShareRouteDependencies,
} from "@/lib/server/share-routes";
import {
  isMaxReveals,
  parseCreateShareInput,
  parseStatus,
  VALID_MAX_REVEALS,
} from "@/lib/shares/contracts";
import { ShareServiceError, type ShareService } from "@/lib/server/share-service";

const publicId = "AQEBAQEBAQEBAQEBAQEBAQ";
const digest = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";
const envelope = {
  version: 1,
  objectType: "content" as const,
  algorithm: "AES-256-GCM" as const,
  nonce: "AQEBAQEBAQEBAQEB",
  hkdfSalt: "AQEBAQEBAQEBAQEBAQEBAQ",
  passwordSalt: null,
  kdf: "none" as const,
  kdfParameters: {},
  factorMask: "link" as const,
  ciphertext: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
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

function validPayload(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    publicId,
    contentEnvelope: envelope,
    policy: {
      availableAt: null,
      expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      maxReveals: null,
    },
    deleteTokenHash: digest,
    idempotencyKeyHash: digest,
    passwordRequired: false,
    unlockRequired: false,
    ...overrides,
  };
}

describe("share policy and contract freezing", () => {
  const fixedNow = 1_700_000_000_000;

  it("accepts valid MaxReveals values and rejects invalid ones", () => {
    const validMaxReveals = [...VALID_MAX_REVEALS];
    for (const valid of validMaxReveals) {
      expect(isMaxReveals(valid)).toBe(true);
      const input = validPayload({ policy: { availableAt: null, expiresAt: new Date(fixedNow + 86400000).toISOString(), maxReveals: valid } });
      const parsed = parseCreateShareInput(input, fixedNow);
      expect(parsed).not.toBeNull();
      expect(parsed?.maxReveals).toBe(valid);
    }

    const invalidMaxReveals = [0, 101, 102, -1, -5, 1.5, 3.14, "1", "3", "5", "10", "burn", true, false, {}, []];
    for (const invalid of invalidMaxReveals) {
      expect(isMaxReveals(invalid)).toBe(false);
      const input = validPayload({ policy: { availableAt: null, expiresAt: new Date(fixedNow + 86400000).toISOString(), maxReveals: invalid } });
      expect(parseCreateShareInput(input, fixedNow)).toBeNull();
    }
  });

  it("validates expiry bounds strictly with a controllable clock", () => {
    const pastInput = validPayload({ policy: { availableAt: null, expiresAt: new Date(fixedNow - 1000).toISOString(), maxReveals: null } });
    expect(parseCreateShareInput(pastInput, fixedNow)).toBeNull();

    const nowInput = validPayload({ policy: { availableAt: null, expiresAt: new Date(fixedNow).toISOString(), maxReveals: null } });
    expect(parseCreateShareInput(nowInput, fixedNow)).toBeNull();

    const max30DaysInput = validPayload({ policy: { availableAt: null, expiresAt: new Date(fixedNow + 30 * 86400000).toISOString(), maxReveals: null } });
    expect(parseCreateShareInput(max30DaysInput, fixedNow)).not.toBeNull();

    const beyond30DaysInput = validPayload({ policy: { availableAt: null, expiresAt: new Date(fixedNow + 30 * 86400000 + 1000).toISOString(), maxReveals: null } });
    expect(parseCreateShareInput(beyond30DaysInput, fixedNow)).toBeNull();

    const invalidDateInput = validPayload({ policy: { availableAt: null, expiresAt: "not-a-date", maxReveals: null } });
    expect(parseCreateShareInput(invalidDateInput, fixedNow)).toBeNull();
  });

  it("validates scheduled availability against expiry and clock drift", () => {
    const expiry = new Date(fixedNow + 24 * 3600 * 1000).toISOString();

    const validScheduled = validPayload({ policy: { availableAt: new Date(fixedNow + 3600 * 1000).toISOString(), expiresAt: expiry, maxReveals: null } });
    expect(parseCreateShareInput(validScheduled, fixedNow)).not.toBeNull();

    const pastAvailable = validPayload({ policy: { availableAt: new Date(fixedNow - 5000).toISOString(), expiresAt: expiry, maxReveals: null } });
    const parsedPast = parseCreateShareInput(pastAvailable, fixedNow);
    expect(parsedPast).not.toBeNull();
    expect(parsedPast?.availableAt).toBe(new Date(fixedNow - 5000).toISOString());

    const equalExpiry = validPayload({ policy: { availableAt: expiry, expiresAt: expiry, maxReveals: null } });
    expect(parseCreateShareInput(equalExpiry, fixedNow)).toBeNull();

    const afterExpiry = validPayload({ policy: { availableAt: new Date(fixedNow + 25 * 3600 * 1000).toISOString(), expiresAt: expiry, maxReveals: null } });
    expect(parseCreateShareInput(afterExpiry, fixedNow)).toBeNull();
  });

  it("rejects an unparseable scheduled availability instead of silently clearing it", () => {
    const expiry = new Date(fixedNow + 24 * 3600 * 1000).toISOString();
    const malformedAvailable = validPayload({ policy: { availableAt: "not-a-date", expiresAt: expiry, maxReveals: null } });
    expect(parseCreateShareInput(malformedAvailable, fixedNow)).toBeNull();
  });

  it("parses database status rows for active, scheduled, unavailable, limited, and unlimited shares", () => {
    expect(parseStatus({
      status: "active",
      available_at: null,
      expires_at: "2099-01-01T00:00:00.000Z",
      password_required: false,
      unlock_required: false,
      max_reveals: null,
      remaining_reveals: null,
    })).toEqual({
      status: "active",
      availableAt: null,
      expiresAt: "2099-01-01T00:00:00.000Z",
      passwordRequired: false,
      unlockRequired: false,
      maxReveals: null,
      remainingReveals: null,
    });

    expect(parseStatus({
      status: "scheduled",
      available_at: "2026-08-25T12:00:00+00:00",
      expires_at: "2026-08-30T12:00:00+00:00",
      password_required: true,
      unlock_required: false,
      max_reveals: 5,
      remaining_reveals: 4,
    })).toEqual({
      status: "scheduled",
      availableAt: "2026-08-25T12:00:00.000Z",
      expiresAt: "2026-08-30T12:00:00.000Z",
      passwordRequired: true,
      unlockRequired: false,
      maxReveals: 5,
      remainingReveals: 4,
    });

    expect(parseStatus({ status: "unavailable" })).toEqual({ status: "unavailable" });
    // Day 5: custom limits like 7 are now valid.
    expect(parseStatus({
      status: "active",
      available_at: null,
      expires_at: "2099-01-01T00:00:00.000Z",
      password_required: false,
      unlock_required: false,
      max_reveals: 7,
      remaining_reveals: 7,
    })).toMatchObject({ maxReveals: 7, remainingReveals: 7 });
    // Never expiry parses to null.
    expect(parseStatus({
      status: "active",
      available_at: null,
      expires_at: null,
      password_required: false,
      unlock_required: false,
      max_reveals: null,
      remaining_reveals: null,
    })).toMatchObject({ expiresAt: null });
    expect(parseStatus({
      status: "active",
      available_at: null,
      expires_at: "2099-01-01T00:00:00.000Z",
      password_required: false,
      unlock_required: false,
      max_reveals: 3,
      remaining_reveals: 4,
    })).toBeNull();
    expect(parseStatus({
      status: "active",
      available_at: null,
      expires_at: "2099-01-01T00:00:00.000Z",
      password_required: false,
      unlock_required: false,
      max_reveals: 101,
      remaining_reveals: 101,
    })).toBeNull();
    expect(parseStatus({ status: "unknown" })).toBeNull();
  });
});

describe("share route handlers", () => {
  it("rejects unsupported reveal limits before calling the create RPC", async () => {
    for (const maxReveals of [0, 101]) {
      const deps = dependencies();
      const handler = createPostShareHandler(deps);
      const response = await handler(new Request("http://localhost/api/shares", {
        method: "POST",
        body: JSON.stringify(validPayload({
          policy: {
            availableAt: null,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            maxReveals,
          },
        })),
      }));
      expect(response.status).toBe(400);
      expect(deps.service.createShare).not.toHaveBeenCalled();
    }
  });

  it("rejects unknown create fields before calling the service", async () => {
    const deps = dependencies();
    const handler = createPostShareHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares", {
      method: "POST",
      body: JSON.stringify(validPayload({ plaintext: "must-not-be-accepted" })),
    }));
    expect(response.status).toBe(400);
    expect(deps.service.createShare).not.toHaveBeenCalled();
  });

  it("maps client-class database rejections to 400 instead of 503", async () => {
    const deps = dependencies({
      createShare: vi.fn(async () => {
        throw new ShareServiceError("invalid");
      }),
    });
    const handler = createPostShareHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares", {
      method: "POST",
      body: JSON.stringify(validPayload({
        policy: { availableAt: null, expiresAt: new Date(Date.now() + 86400000).toISOString(), maxReveals: 3 },
      })),
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_request");
  });

  it("returns 201 with policy and publicId on valid create", async () => {
    const deps = dependencies();
    const handler = createPostShareHandler(deps);
    const payload = validPayload({ policy: { availableAt: null, expiresAt: new Date(Date.now() + 86400000).toISOString(), maxReveals: 3 } });
    const response = await handler(new Request("http://localhost/api/shares", {
      method: "POST",
      body: JSON.stringify(payload),
    }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      publicId,
      created: true,
      policy: {
        availableAt: null,
        expiresAt: payload.policy.expiresAt,
        maxReveals: 3,
        passwordRequired: false,
        unlockRequired: false,
      },
    });
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

  it("returns uniform unavailable without causal leakage when share is unavailable", async () => {
    const deps = dependencies({
      getStatus: vi.fn(async () => ({ status: "unavailable" as const })),
    });
    const handler = createGetStatusHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares"), { params: Promise.resolve({ publicId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "unavailable" });
    expect(Object.keys(body)).toEqual(["status"]);
  });

  it("requires the exact reveal token shape and rejects extras", async () => {
    const deps = dependencies();
    const handler = createPostRevealHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares", {
      method: "POST",
      body: JSON.stringify({ requestToken: digest, extra: true }),
    }), { params: Promise.resolve({ publicId }) });
    expect(response.status).toBe(400);
    expect(deps.service.reveal).not.toHaveBeenCalled();
  });

  it("returns uniform 404 unavailable on exhausted or unavailable reveal", async () => {
    const deps = dependencies({
      reveal: vi.fn(async () => ({ status: "unavailable" as const, contentEnvelope: null, retryExpiresAt: null })),
    });
    const handler = createPostRevealHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares", {
      method: "POST",
      body: JSON.stringify({ requestToken: digest }),
    }), { params: Promise.resolve({ publicId }) });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });

  it("returns authorized ciphertext and file download URL when file is attached", async () => {
    const fileMetadata = {
      envelope: {
        version: 2 as const,
        objectType: "file" as const,
        algorithm: "AES-256-GCM" as const,
        nonce: "AQEBAQEBAQEBAQEB",
        hkdfSalt: "AQEBAQEBAQEBAQEBAQEBAQ",
        passwordSalt: null,
        kdf: "none" as const,
        kdfParameters: {},
        factorMask: "link" as const,
      },
      ciphertextSize: 2048,
      downloadUrl: "http://localhost:54321/storage/v1/object/sign/securebin-files/objects/test.bin?token=abc",
    };

    const deps = dependencies({
      reveal: vi.fn(async () => ({
        status: "authorized" as const,
        contentEnvelope: envelope,
        file: fileMetadata,
        retryExpiresAt: "2099-01-01T00:05:00.000Z",
      })),
    });

    const handler = createPostRevealHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares", {
      method: "POST",
      body: JSON.stringify({ requestToken: digest }),
    }), { params: Promise.resolve({ publicId }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      status: "authorized",
      contentEnvelope: envelope,
      file: fileMetadata,
      retryExpiresAt: "2099-01-01T00:05:00.000Z",
    });
  });

  it("handles share revocation with valid delete capability", async () => {
    const deps = dependencies();
    const handler = createDeleteShareHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares", {
      method: "DELETE",
      body: JSON.stringify({ deleteCapability: digest }),
    }), { params: Promise.resolve({ publicId }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: true });
    expect(deps.service.revoke).toHaveBeenCalledWith(publicId, digest);
  });

  it("rejects invalid delete capability before calling service", async () => {
    const deps = dependencies();
    const handler = createDeleteShareHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares", {
      method: "DELETE",
      body: JSON.stringify({ deleteCapability: "too-short" }),
    }), { params: Promise.resolve({ publicId }) });
    expect(response.status).toBe(400);
    expect(deps.service.revoke).not.toHaveBeenCalled();
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

  it("returns HTTP 409 and idempotency_conflict on create conflict", async () => {
    const deps = dependencies();
    deps.service.createShare = vi.fn().mockRejectedValue(new ShareServiceError("conflict"));
    const handler = createPostShareHandler(deps);
    const response = await handler(new Request("http://localhost/api/shares", {
      method: "POST",
      body: JSON.stringify(validPayload()),
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "idempotency_conflict" });
  });
});

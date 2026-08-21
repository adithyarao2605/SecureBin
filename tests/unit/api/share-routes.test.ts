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
import type { ShareService } from "@/lib/server/share-service";

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
  const now = 1_700_000_000_000;
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

  it("accepts all five valid MaxReveals values and rejects invalid ones", () => {
    for (const valid of VALID_MAX_REVEALS) {
      expect(isMaxReveals(valid)).toBe(true);
      const input = validPayload({ policy: { availableAt: null, expiresAt: new Date(fixedNow + 86400000).toISOString(), maxReveals: valid } });
      const parsed = parseCreateShareInput(input, fixedNow);
      expect(parsed).not.toBeNull();
      expect(parsed?.maxReveals).toBe(valid);
    }

    const invalidMaxReveals = [0, 2, 4, 6, 7, 8, 9, 11, 20, -1, -5, 1.5, 3.14, "1", "3", "5", "10", "burn", true, false, {}, []];
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
    expect(parseStatus({ status: "unknown" })).toBeNull();
  });
});

describe("share route handlers", () => {
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
});

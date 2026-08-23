import { describe, expect, it, vi } from "vitest";

import {
  createPostUploadHandler,
  type UploadRouteDependencies,
} from "@/lib/server/upload-routes";
import { UploadServiceError } from "@/lib/server/upload-service";
import { parseUploadReservationInput } from "@/lib/shares/contracts";

const publicId = "AQEBAQEBAQEBAQEBAQEBAQ";
const digest = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";
const validFileEnvelope = {
  version: 2 as const,
  objectType: "file" as const,
  algorithm: "AES-256-GCM" as const,
  nonce: "AQEBAQEBAQEBAQEB",
  hkdfSalt: "AQEBAQEBAQEBAQEBAQEBAQ",
  passwordSalt: null,
  kdf: "none" as const,
  kdfParameters: {},
  factorMask: "link" as const,
};

function validUploadPayload(overrides: Record<string, unknown> = {}) {
  return {
    publicId,
    idempotencyKeyHash: digest,
    fileEnvelope: validFileEnvelope,
    expectedCiphertextSize: 1024,
        attachmentSlot: 0,
    ...overrides,
  };
}

function uploadDependencies(
  serviceOverrides: Partial<UploadRouteDependencies["uploadService"]> = {},
  rateLimitAllowed = true
): UploadRouteDependencies {
  return {
    rateLimitHmacKey: "test-hmac-key",
    shareService: {
      consumeRateLimit: vi.fn(async () => rateLimitAllowed),
      createShare: vi.fn(),
      getStatus: vi.fn(),
      reveal: vi.fn(),
      revoke: vi.fn(),
    },
    uploadService: {
      createReservation: vi.fn(async () => ({
        uploadUrl: "http://localhost:54321/storage/v1/object/upload/sign/securebin-files/objects/test.bin?token=abc",
        token: "abc",
        expiresAt: "2099-01-01T00:15:00.000Z",
      })),
      ...serviceOverrides,
    },
  };
}

describe("upload route contracts and parsing", () => {
  it("parses valid upload reservation payload", () => {
    const input = validUploadPayload();
    const parsed = parseUploadReservationInput(input);
    expect(parsed).toEqual({
      publicId,
      idempotencyKeyHash: digest,
      fileEnvelope: validFileEnvelope,
      expectedCiphertextSize: 1024,
        attachmentSlot: 0,
    });
  });

  it("rejects unknown fields in upload reservation input", () => {
    const input = validUploadPayload({ unknownField: "bad" });
    expect(parseUploadReservationInput(input)).toBeNull();
  });

  it("rejects fileEnvelope containing ciphertext", () => {
    const input = validUploadPayload({
      fileEnvelope: { ...validFileEnvelope, ciphertext: "AQEBAQEBAQEBAQEBAQEBAQ" },
    });
    expect(parseUploadReservationInput(input)).toBeNull();
  });

  it("rejects expectedCiphertextSize smaller than 16 or larger than 10_486_422", () => {
    expect(parseUploadReservationInput(validUploadPayload({ expectedCiphertextSize: 15 }))).toBeNull();
    expect(parseUploadReservationInput(validUploadPayload({ expectedCiphertextSize: 10_486_423 }))).toBeNull();
    expect(parseUploadReservationInput(validUploadPayload({ expectedCiphertextSize: 10_486_422 }))).not.toBeNull();
  });

  it("rejects invalid publicId or idempotency digest", () => {
    expect(parseUploadReservationInput(validUploadPayload({ publicId: "too-short" }))).toBeNull();
    expect(parseUploadReservationInput(validUploadPayload({ idempotencyKeyHash: "not-a-digest" }))).toBeNull();
  });
});

describe("POST /api/uploads handler", () => {
  it("returns 201 with signed upload URL on valid request", async () => {
    const deps = uploadDependencies();
    const handler = createPostUploadHandler(deps);
    const response = await handler(new Request("http://localhost/api/uploads", {
      method: "POST",
      body: JSON.stringify(validUploadPayload()),
    }));

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json).toMatchObject({
      uploadUrl: expect.stringContaining("securebin-files"),
      token: "abc",
      expiresAt: "2099-01-01T00:15:00.000Z",
    });
  });

  it("returns 429 when rate limited", async () => {
    const deps = uploadDependencies({}, false);
    const handler = createPostUploadHandler(deps);
    const response = await handler(new Request("http://localhost/api/uploads", {
      method: "POST",
      body: JSON.stringify(validUploadPayload()),
    }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
    expect(deps.uploadService.createReservation).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed json or invalid input", async () => {
    const deps = uploadDependencies();
    const handler = createPostUploadHandler(deps);
    const response = await handler(new Request("http://localhost/api/uploads", {
      method: "POST",
      body: "not json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
  });

  it("returns 409 reservation_conflict on conflict", async () => {
    const deps = uploadDependencies({
      createReservation: vi.fn().mockRejectedValue(new UploadServiceError("conflict")),
    });
    const handler = createPostUploadHandler(deps);
    const response = await handler(new Request("http://localhost/api/uploads", {
      method: "POST",
      body: JSON.stringify(validUploadPayload()),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "reservation_conflict" });
  });

  it("returns 409 reservation_attached when already attached", async () => {
    const deps = uploadDependencies({
      createReservation: vi.fn().mockRejectedValue(new UploadServiceError("attached")),
    });
    const handler = createPostUploadHandler(deps);
    const response = await handler(new Request("http://localhost/api/uploads", {
      method: "POST",
      body: JSON.stringify(validUploadPayload()),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "reservation_attached" });
  });

  it("returns 503 on dependency failure", async () => {
    const deps = uploadDependencies({
      createReservation: vi.fn().mockRejectedValue(new UploadServiceError("dependency")),
    });
    const handler = createPostUploadHandler(deps);
    const response = await handler(new Request("http://localhost/api/uploads", {
      method: "POST",
      body: JSON.stringify(validUploadPayload()),
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "server_error" });
  });
});

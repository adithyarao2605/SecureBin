import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import type { CreateShareInput } from "../../lib/shares/contracts";
import { createShareService } from "../../lib/server/share-service";
import type { SecureStorage } from "../../lib/server/storage";
import type { RpcClient } from "../../lib/server/supabase-rpc";

const fakeStorage: SecureStorage = {
  createSignedUpload: async () => ({ url: "https://example.com/upload" }),
  createSignedDownload: async () => "https://example.com/download",
  inspectSize: async () => 1024,
  remove: async () => "deleted",
};

const publicId = "abcdefghijklmnopqrstug";
const digest = "a".repeat(43);
const contentEnvelope: CreateShareInput["contentEnvelope"] = {
  version: 1,
  objectType: "content",
  algorithm: "AES-256-GCM",
  nonce: "abcdefghijklmnop",
  hkdfSalt: "abcdefghijklmnopqrstug",
  passwordSalt: null,
  kdf: "none",
  kdfParameters: {},
  factorMask: "link",
  ciphertext: "AAAAAAAAAAAAAAAAAAAAAA",
};

const createInput: CreateShareInput = {
  publicId,
  contentEnvelope,
  availableAt: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  maxReveals: null,
  deleteTokenHash: digest,
  passwordRequired: false,
  unlockRequired: false,
  idempotencyKeyHash: digest,
};

type RpcCall = { readonly functionName: string; readonly args: Record<string, unknown> };

class FakeRpcClient implements RpcClient {
  readonly calls: RpcCall[] = [];

  async call(functionName: string, args: Record<string, unknown>): Promise<unknown> {
    this.calls.push({ functionName, args });
    switch (functionName) {
      case "create_share":
        return [{ share_id: "share-1", public_id: publicId, created: true }];
      case "get_share_status":
        return [{
          status: "active",
          available_at: null,
          expires_at: "2099-01-01T00:00:00.000Z",
          password_required: false,
          unlock_required: false,
          max_reveals: null,
          remaining_reveals: null,
        }];
      case "reveal_share":
        return [{
          status: "authorized",
          share_id: "share-1",
          content_envelope: contentEnvelope,
          attachments: [],
          reveal_count: 1,
          max_reveals: null,
          retry_expires_at: "2099-01-01T00:05:00.000Z",
        }];
      case "revoke_share":
        return [{ valid_capability: true, revoked: true }];
      default:
        throw new Error(`unexpected rpc: ${functionName}`);
    }
  }
}

function bytea(base64UrlValue: string): string {
  return `\\x${Buffer.from(base64UrlValue, "base64url").toString("hex")}`;
}

describe("share service RPC mapping", () => {
  it("maps create arguments without exposing plaintext and matches 9-arg signature without file parameters", async () => {
    const rpc = new FakeRpcClient();
    const service = createShareService(rpc, fakeStorage);

    await expect(service.createShare(createInput)).resolves.toEqual({ publicId, created: true });

    const call = rpc.calls.find(({ functionName }) => functionName === "create_share");
    expect(call).toBeDefined();
    expect(call?.args.p_public_id).toBe(publicId);
    expect(call?.args.p_content_envelope).toBe(contentEnvelope);
    expect(call?.args.p_delete_token_hash).toBe(bytea(digest));
    expect(call?.args.p_idempotency_key_hash).toBe(bytea(digest));
    expect(call?.args).not.toHaveProperty("p_reservation_token_hash");
    expect(call?.args).not.toHaveProperty("plaintext");
  });

  it("maps SQLSTATE 23505 or idempotency_conflict to ShareServiceError with conflict kind", async () => {
    class ConflictRpcClient implements RpcClient {
      async call(): Promise<unknown> {
        const error = new Error("idempotency_conflict");
        (error as unknown as { code: string; errorDetails: string }).code = "23505";
        (error as unknown as { code: string; errorDetails: string }).errorDetails = "idempotency_conflict";
        throw error;
      }
    }

    const service = createShareService(new ConflictRpcClient(), fakeStorage);
    await expect(service.createShare(createInput)).rejects.toMatchObject({
      name: "ShareServiceError",
      kind: "conflict",
    });
  });

  it("maps status, preserves ciphertext on reveal, and hashes raw retry/delete capabilities", async () => {
    const rpc = new FakeRpcClient();
    const service = createShareService(rpc, fakeStorage);

    await expect(service.getStatus(publicId)).resolves.toMatchObject({ status: "active", expiresAt: "2099-01-01T00:00:00.000Z" });
    await expect(service.reveal(publicId, "raw-reveal-token")).resolves.toEqual({
      status: "authorized",
      contentEnvelope,
      files: [],
      retryExpiresAt: "2099-01-01T00:05:00.000Z",
    });
    await expect(service.revoke(publicId, "raw-delete-capability")).resolves.toBe(true);

    const revealCall = rpc.calls.find(({ functionName }) => functionName === "reveal_share");
    expect(revealCall?.args.p_request_token_hash).toBe("\\xe8936f412865d7835b0bb970fe780f4740eb0c49b16ab9bd82d8bc938e3f272a");
    const revokeCall = rpc.calls.find(({ functionName }) => functionName === "revoke_share");
    expect(revokeCall?.args.p_delete_token_hash).toBe("\\xa8e46592d861df319356a462b76a2a16d3e7f3218811a1cd74349d6998955cee");
  });

  it("correctly maps scheduled, unavailable, limited, and burn-after-reading statuses", async () => {
    class CustomRpcClient extends FakeRpcClient {
      constructor(private readonly statusRow: Record<string, unknown>) {
        super();
      }
      override async call(functionName: string, args: Record<string, unknown>): Promise<unknown> {
        if (functionName === "get_share_status") return [this.statusRow];
        return super.call(functionName, args);
      }
    }

    // Scheduled
    const scheduledService = createShareService(new CustomRpcClient({
      status: "scheduled",
      available_at: "2026-08-25T12:00:00+00:00",
      expires_at: "2026-08-30T12:00:00+00:00",
      password_required: false,
      unlock_required: false,
      max_reveals: 5,
      remaining_reveals: 5,
    }), fakeStorage);
    await expect(scheduledService.getStatus(publicId)).resolves.toEqual({
      status: "scheduled",
      availableAt: "2026-08-25T12:00:00.000Z",
      expiresAt: "2026-08-30T12:00:00.000Z",
      passwordRequired: false,
      unlockRequired: false,
      maxReveals: 5,
      remainingReveals: 5,
    });

    // Unavailable
    const unavailableService = createShareService(new CustomRpcClient({
      status: "unavailable",
      available_at: null,
      expires_at: null,
      password_required: false,
      unlock_required: false,
      max_reveals: null,
      remaining_reveals: null,
    }), fakeStorage);
    await expect(unavailableService.getStatus(publicId)).resolves.toEqual({ status: "unavailable" });

    // Burn after reading (maxReveals: 1)
    const burnService = createShareService(new CustomRpcClient({
      status: "active",
      available_at: null,
      expires_at: "2026-08-25T12:00:00+00:00",
      password_required: true,
      unlock_required: false,
      max_reveals: 1,
      remaining_reveals: 1,
    }), fakeStorage);
    await expect(burnService.getStatus(publicId)).resolves.toEqual({
      status: "active",
      availableAt: null,
      expiresAt: "2026-08-25T12:00:00.000Z",
      passwordRequired: true,
      unlockRequired: false,
      maxReveals: 1,
      remainingReveals: 1,
    });
  });
});

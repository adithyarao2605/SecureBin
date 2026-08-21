import { Buffer } from "node:buffer";

import {
  parseIsoUtc,
  parseRpcEnvelope,
  parseStatus,
  type CreateShareInput,
  type RevealResult,
  type ShareStatus,
} from "../shares/contracts";
import { sha256Base64Url } from "./hashing";
import { createRpcClient, type RpcClient } from "./supabase-rpc";

export interface CreatedShare {
  readonly publicId: string;
  readonly created: boolean;
}

export interface ShareService {
  consumeRateLimit(discriminatorHash: string, action: RateLimitAction, limit: number): Promise<boolean>;
  createShare(input: CreateShareInput): Promise<CreatedShare>;
  getStatus(publicId: string): Promise<ShareStatus>;
  reveal(publicId: string, requestToken: string): Promise<RevealResult>;
  revoke(publicId: string, deleteCapability: string): Promise<boolean>;
}

export type RateLimitAction = "upload" | "create" | "status" | "reveal" | "delete";

export class ShareServiceError extends Error {
  readonly kind: "dependency" | "invalid" | "conflict";

  constructor(kind: "dependency" | "invalid" | "conflict") {
    super("SecureBin share operation failed");
    this.name = "ShareServiceError";
    this.kind = kind;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bytesHex(value: string): string {
  return `\\x${Buffer.from(value, "base64url").toString("hex")}`;
}

function firstRow(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length !== 1) return null;
  const row = value[0];
  return isRecord(row) ? row : null;
}

function dependencyError(): ShareServiceError {
  return new ShareServiceError("dependency");
}

export function createShareService(rpc: RpcClient = createRpcClient()): ShareService {
  return {
    async consumeRateLimit(discriminatorHash, action, limit) {
      try {
        const value = await rpc.call("consume_rate_limit", {
          p_discriminator_hash: bytesHex(discriminatorHash),
          p_action: action,
          p_limit: limit,
        });
        if (typeof value === "boolean") return value;
        const row = firstRow(value);
        if (row && typeof row.consume_rate_limit === "boolean") return row.consume_rate_limit;
        throw new ShareServiceError("dependency");
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        throw dependencyError();
      }
    },

    async createShare(input) {
      try {
        const value = await rpc.call("create_share", {
          p_public_id: input.publicId,
          p_content_envelope: input.contentEnvelope,
          p_available_at: input.availableAt,
          p_expires_at: input.expiresAt,
          p_max_reveals: input.maxReveals,
          p_delete_token_hash: bytesHex(input.deleteTokenHash),
          p_password_required: input.passwordRequired,
          p_unlock_required: input.unlockRequired,
          p_idempotency_key_hash: bytesHex(input.idempotencyKeyHash),
          p_file_envelope: input.fileEnvelope,
          p_file_ciphertext_size: input.fileCiphertextSize,
        });
        const row = firstRow(value);
        if (!row || typeof row.public_id !== "string" || typeof row.created !== "boolean") throw new ShareServiceError("dependency");
        return { publicId: row.public_id, created: row.created };
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error.code === "23505" || ("errorDetails" in error && typeof error.errorDetails === "string" && error.errorDetails.includes("idempotency_conflict")))
        ) {
          throw new ShareServiceError("conflict");
        }
        throw dependencyError();
      }
    },

    async getStatus(publicId) {
      try {
        const value = await rpc.call("get_share_status", { p_public_id: publicId });
        const row = firstRow(value);
        const status = row ? parseStatus(row) : null;
        if (!status) throw new ShareServiceError("dependency");
        return status;
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        throw dependencyError();
      }
    },

    async reveal(publicId, requestToken) {
      try {
        const value = await rpc.call("reveal_share", {
          p_public_id: publicId,
          p_request_token_hash: bytesHex(sha256Base64Url(requestToken)),
        });
        const row = firstRow(value);
        if (!row || (row.status !== "authorized" && row.status !== "unavailable" && row.status !== "request_expired")) {
          throw new ShareServiceError("dependency");
        }
        if (row.status !== "authorized") {
          return {
            status: row.status,
            contentEnvelope: null,
            retryExpiresAt: typeof row.retry_expires_at === "string" ? parseIsoUtc(row.retry_expires_at) : null,
          };
        }
        const contentEnvelope = parseRpcEnvelope(row.content_envelope);
        const retryExpiresAt = typeof row.retry_expires_at === "string" ? parseIsoUtc(row.retry_expires_at) : null;
        if (!contentEnvelope || !retryExpiresAt) throw new ShareServiceError("dependency");
        return { status: "authorized", contentEnvelope, retryExpiresAt };
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        throw dependencyError();
      }
    },

    async revoke(publicId, deleteCapability) {
      try {
        const value = await rpc.call("revoke_share", {
          p_public_id: publicId,
          p_delete_token_hash: bytesHex(sha256Base64Url(deleteCapability)),
        });
        const row = firstRow(value);
        if (!row || typeof row.valid_capability !== "boolean" || typeof row.revoked !== "boolean") throw new ShareServiceError("dependency");
        return row.valid_capability && row.revoked;
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        throw dependencyError();
      }
    },
  };
}

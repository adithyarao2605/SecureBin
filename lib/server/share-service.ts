import { Buffer } from "node:buffer";

import {
  parseIsoUtc,
  parseRpcEnvelope,
  parseRpcFileEnvelope,
  parseStatus,
  isDigest,
  isPublicId,
  MAX_STATUS_BATCH_IDS,
  type AddCommentInput,
  type DeleteCommentInput,
  type EditCommentInput,
  type RevealAttachment,
  type CreateShareInput,
  type RevealResult,
  type ShareStatusBatchItem,
  type ShareStatus,
} from "../shares/contracts";
import { sha256Base64Url } from "./hashing";
import { createRpcClient, RpcRequestError, type RpcClient } from "./supabase-rpc";
import { createSecureStorage, type SecureStorage } from "./storage";

export interface CreatedShare {
  readonly publicId: string;
  readonly created: boolean;
}

export interface ShareService {
  consumeRateLimit(discriminatorHash: string, action: RateLimitAction, limit: number): Promise<boolean>;
  createShare(input: CreateShareInput): Promise<CreatedShare>;
  getStatus(publicId: string): Promise<ShareStatus>;
  getStatusBatch(publicIds: readonly string[]): Promise<ShareStatusBatchItem[]>;
  reveal(publicId: string, requestToken: string): Promise<RevealResult>;
  addComment(
    publicId: string,
    payload: AddCommentInput
  ): Promise<{ commentId: string; createdAt: string }>;
  editComment(
    publicId: string,
    commentId: string,
    payload: EditCommentInput
  ): Promise<{ commentId: string; editedAt: string }>;
  deleteComment(publicId: string, commentId: string, payload: DeleteCommentInput): Promise<boolean>;
  listComments(publicId: string, capability: string): Promise<Array<Record<string, unknown>>>;
  revoke(publicId: string, deleteCapability: string): Promise<boolean>;
}

export type RateLimitAction = "upload" | "create" | "status" | "reveal" | "delete" | "discussion";

export class ShareServiceError extends Error {
  readonly kind: "dependency" | "invalid" | "conflict" | "rate_limited";

  constructor(kind: "dependency" | "invalid" | "conflict" | "rate_limited") {
    super("SecureBin share operation failed");
    this.name = "ShareServiceError";
    this.kind = kind;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bytesHex(value: string): string {
  return `\\x${Buffer.from(value, "base64url").toString("hex")}`;
}

function firstRow(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length !== 1) return null;
  const row = value[0];
  return isRecord(row) ? row : null;
}

const STATUS_BATCH_ROW_KEYS = [
  "public_id",
  "status",
  "available_at",
  "expires_at",
  "password_required",
  "unlock_required",
  "max_reveals",
  "remaining_reveals",
] as const;

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseBatchStatusRows(value: unknown, publicIds: readonly string[]): ShareStatusBatchItem[] | null {
  if (!Array.isArray(value) || value.length !== publicIds.length) return null;
  const requested = new Set(publicIds);
  const parsed = new Map<string, ShareStatusBatchItem>();
  for (const entry of value) {
    if (!isRecord(entry) || !hasExactKeys(entry, STATUS_BATCH_ROW_KEYS) || typeof entry.public_id !== "string" || !isPublicId(entry.public_id)) return null;
    if (!requested.has(entry.public_id) || parsed.has(entry.public_id)) return null;
    const status = parseStatus(entry);
    if (!status) return null;
    parsed.set(entry.public_id, { publicId: entry.public_id, status });
  }
  const ordered: ShareStatusBatchItem[] = [];
  for (const publicId of publicIds) {
    const status = parsed.get(publicId);
    if (!status) return null;
    ordered.push(status);
  }
  return ordered;
}

function dependencyError(): ShareServiceError {
  return new ShareServiceError("dependency");
}

export function createShareService(
  rpc: RpcClient = createRpcClient(),
  storage: SecureStorage = createSecureStorage()
): ShareService {
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
          p_discussion_capability_hash: input.discussionCapabilityHash
            ? bytesHex(input.discussionCapabilityHash)
            : null,
        });;
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
        // Client-class DB rejections (bad policy values, constraint bounds)
        // are request errors, not outages.
        if (
          error instanceof RpcRequestError &&
          (error.code === "22023" || error.code === "23514")
        ) {
          throw new ShareServiceError("invalid");
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

    async getStatusBatch(publicIds) {
      if (
        publicIds.length === 0 ||
        publicIds.length > MAX_STATUS_BATCH_IDS ||
        new Set(publicIds).size !== publicIds.length ||
        !publicIds.every(isPublicId)
      ) {
        throw new ShareServiceError("invalid");
      }
      try {
        const value = await rpc.call("get_share_status_batch", { p_public_ids: publicIds });
        const statuses = parseBatchStatusRows(value, publicIds);
        if (!statuses) throw new ShareServiceError("dependency");
        return statuses;
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
            files: [],
            retryExpiresAt: typeof row.retry_expires_at === "string" ? parseIsoUtc(row.retry_expires_at) : null,
          };
        }
        const contentEnvelope = parseRpcEnvelope(row.content_envelope);
        const retryExpiresAt = typeof row.retry_expires_at === "string" ? parseIsoUtc(row.retry_expires_at) : null;
        if (!contentEnvelope || !retryExpiresAt) throw new ShareServiceError("dependency");

        const files: RevealAttachment[] = [];
        if (Array.isArray(row.attachments)) {
          for (const entry of row.attachments) {
            if (!isRecord(entry)) throw new ShareServiceError("dependency");
            const envelope = typeof entry.envelope === "object" && entry.envelope !== null
              ? parseRpcFileEnvelope(entry.envelope)
              : null;
            const path = typeof entry.objectPath === "string" ? entry.objectPath : "";
            const size = typeof entry.ciphertextSize === "number" ? entry.ciphertextSize : -1;
            const slot = typeof entry.slot === "number" ? entry.slot : -1;
            if (!envelope || !path || size < 16 || slot < 0) throw new ShareServiceError("dependency");
            let downloadUrl: string;
            try {
              downloadUrl = await storage.createSignedDownload(path, 60);
            } catch {
              throw new ShareServiceError("dependency");
            }
            files.push({ slot, envelope, ciphertextSize: size, downloadUrl });
          }
        } else {
          throw new ShareServiceError("dependency");
        }

        return {
          status: "authorized",
          contentEnvelope,
          files,
          retryExpiresAt,
        };
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        throw dependencyError();
      }
    },

    async addComment(publicId, payload) {
      const capability = typeof payload.capability === "string" ? payload.capability : "";
      // A present-but-malformed parent id would surface as a PG 22P02 cast
      // failure and map to a false dependency outage; reject it as invalid.
      const parentCommentId = typeof payload.parentCommentId === "string" ? payload.parentCommentId : "";
      if (parentCommentId !== "" && !UUID_PATTERN.test(parentCommentId)) {
        throw new ShareServiceError("invalid");
      }
      const editToken = typeof payload.editToken === "string" ? payload.editToken : "";
      if (!isDigest(capability) || !isDigest(editToken) || typeof payload.bodyEnvelope !== "object" || payload.bodyEnvelope === null) {
        throw new ShareServiceError("invalid");
      }
      try {
        const value = await rpc.call("add_share_comment", {
          p_public_id: publicId,
          p_discussion_capability: bytesHex(capability),
          p_edit_token_hash: bytesHex(sha256Base64Url(editToken)),
          p_parent_comment_id: parentCommentId === "" ? null : parentCommentId,
          p_body_envelope: payload.bodyEnvelope,
          p_nickname_envelope: payload.nicknameEnvelope ?? null,
        });
        const row = firstRow(value);
        if (!row || typeof row.comment_id !== "string") throw new ShareServiceError("dependency");
        return {
          commentId: row.comment_id,
          createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
        };
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        if (error instanceof RpcRequestError && (error.code === "22023" || error.code === "P0001")) {
          throw new ShareServiceError(error.errorDetails?.includes("rate_limited") ? "rate_limited" : "invalid");
        }
        throw dependencyError();
      }
    },

    async editComment(publicId, commentId, payload) {
      const capability = typeof payload.capability === "string" ? payload.capability : "";
      const editToken = typeof payload.editToken === "string" ? payload.editToken : "";
      if (!UUID_PATTERN.test(commentId) || !isDigest(capability) || !isDigest(editToken) || typeof payload.bodyEnvelope !== "object" || payload.bodyEnvelope === null) {
        throw new ShareServiceError("invalid");
      }
      try {
        const value = await rpc.call("edit_share_comment", {
          p_public_id: publicId,
          p_discussion_capability: bytesHex(capability),
          p_comment_id: commentId,
          p_edit_token_hash: bytesHex(sha256Base64Url(editToken)),
          p_body_envelope: payload.bodyEnvelope,
        });
        const row = firstRow(value);
        if (!row || typeof row.comment_id !== "string" || typeof row.edited_at !== "string") throw new ShareServiceError("dependency");
        return { commentId: row.comment_id, editedAt: row.edited_at };
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        if (error instanceof RpcRequestError && (error.code === "22023" || error.code === "P0001")) {
          throw new ShareServiceError(error.errorDetails?.includes("rate_limited") ? "rate_limited" : "invalid");
        }
        throw dependencyError();
      }
    },

    async deleteComment(publicId, commentId, payload) {
      const capability = typeof payload.capability === "string" ? payload.capability : "";
      const editToken = typeof payload.editToken === "string" ? payload.editToken : "";
      if (!UUID_PATTERN.test(commentId) || !isDigest(capability) || !isDigest(editToken)) {
        throw new ShareServiceError("invalid");
      }
      try {
        const value = await rpc.call("delete_share_comment", {
          p_public_id: publicId,
          p_discussion_capability: bytesHex(capability),
          p_comment_id: commentId,
          p_edit_token_hash: bytesHex(sha256Base64Url(editToken)),
        });
        const row = firstRow(value);
        if (!row || typeof row.deleted !== "boolean") throw new ShareServiceError("dependency");
        return row.deleted;
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        if (error instanceof RpcRequestError && (error.code === "22023" || error.code === "P0001")) {
          throw new ShareServiceError(error.errorDetails?.includes("rate_limited") ? "rate_limited" : "invalid");
        }
        throw dependencyError();
      }
    },

    async listComments(publicId, capability) {
      if (!capability) throw new ShareServiceError("invalid");
      try {
        const value = await rpc.call("list_share_comments", {
          p_public_id: publicId,
          p_discussion_capability: bytesHex(capability),
        });
        return Array.isArray(value) && value.every(isRecord)
          ? (value as Array<Record<string, unknown>>)
          : [];
      } catch (error) {
        if (error instanceof RpcRequestError && error.code === "22023") {
          throw new ShareServiceError("invalid");
        }
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

import { Buffer } from "node:buffer";

import {
  parseIsoUtc,
  MAX_ATTACHMENTS,
  MAX_FILE_CIPHERTEXT_SIZE,
  parseRpcEnvelope,
  parseRpcFileEnvelope,
  parseShareCommentRows,
  parseStatus,
  isDigest,
  isUuid,
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
  type ShareCommentRow,
} from "../shares/contracts";
import {
  MAX_DISCUSSION_BODY_CIPHERTEXT_BYTES,
  MAX_DISCUSSION_NICKNAME_CIPHERTEXT_BYTES,
  validateDiscussionEnvelope,
} from "../crypto/discussion";
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
  listComments(publicId: string, capability: string): Promise<ShareCommentRow[]>;
  revoke(publicId: string, deleteCapability: string): Promise<boolean>;
}

export type RateLimitAction = "upload" | "create" | "status" | "reveal" | "delete" | "discussion";

export class ShareServiceError extends Error {
  readonly kind: "dependency" | "invalid" | "conflict" | "rate_limited" | "unavailable";

  constructor(kind: "dependency" | "invalid" | "conflict" | "rate_limited" | "unavailable") {
    super("SecureBin share operation failed");
    this.name = "ShareServiceError";
    this.kind = kind;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const STORAGE_PATH_PATTERN = /^objects\/[0-9a-f]{48}\.bin$/;

const REVEAL_ROW_KEYS = [
  "attachments",
  "content_envelope",
  "max_reveals",
  "retry_expires_at",
  "reveal_count",
  "share_id",
  "status",
  "window_ends_at",
] as const;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.username === "" && parsed.password === "" && parsed.hash === "";
  } catch {
    return false;
  }
}

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

function discussionRpcError(error: RpcRequestError): ShareServiceError {
  if (error.errorDetails?.includes("rate_limited")) return new ShareServiceError("rate_limited");
  if (error.errorDetails?.includes("discussion unavailable")) return new ShareServiceError("unavailable");
  return new ShareServiceError("invalid");
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
          p_reveal_window_seconds: input.revealWindowSeconds,
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
        if (
          !row ||
          !hasExactKeys(row, REVEAL_ROW_KEYS) ||
          (row.status !== "authorized" && row.status !== "unavailable" && row.status !== "request_expired")
        ) {
          throw new ShareServiceError("dependency");
        }

        const retryExpiresAt = row.retry_expires_at === null ? null : parseIsoUtc(row.retry_expires_at);
        if (row.retry_expires_at !== null && !retryExpiresAt) throw new ShareServiceError("dependency");

        if (row.status !== "authorized") {
          if (
            row.share_id !== null ||
            row.content_envelope !== null ||
            row.attachments !== null ||
            row.reveal_count !== null ||
            row.max_reveals !== null ||
            row.window_ends_at !== null ||
            (row.status === "unavailable" ? retryExpiresAt !== null : retryExpiresAt === null)
          ) {
            throw new ShareServiceError("dependency");
          }
          return {
            status: row.status,
            contentEnvelope: null,
            files: [],
            retryExpiresAt,
            releaseWindowEndsAt: null,
          };
        }

        if (
          !isUuid(row.share_id) ||
          typeof row.reveal_count !== "number" ||
          !Number.isSafeInteger(row.reveal_count) ||
          row.reveal_count < 1 ||
          (row.max_reveals !== null &&
            (typeof row.max_reveals !== "number" ||
              !Number.isSafeInteger(row.max_reveals) ||
              row.max_reveals < 1 ||
              row.max_reveals > 100 ||
              row.reveal_count > row.max_reveals)) ||
          !retryExpiresAt
        ) {
          throw new ShareServiceError("dependency");
        }

        const contentEnvelope = parseRpcEnvelope(row.content_envelope);
        const releaseWindowEndsAt = row.window_ends_at === null ? null : parseIsoUtc(row.window_ends_at);
        if (!contentEnvelope || !retryExpiresAt) throw new ShareServiceError("dependency");

        const files: RevealAttachment[] = [];
        if (!Array.isArray(row.attachments) || row.attachments.length > MAX_ATTACHMENTS) {
          throw new ShareServiceError("dependency");
        }
        const slots = new Set<number>();
        const pendingFiles: Array<{
          readonly slot: number;
          readonly envelope: NonNullable<ReturnType<typeof parseRpcFileEnvelope>>;
          readonly path: string;
          readonly size: number;
        }> = [];
        for (const entry of row.attachments) {
          if (
            !isRecord(entry) ||
            !hasExactKeys(entry, ["ciphertextSize", "envelope", "objectPath", "slot"])
          ) {
            throw new ShareServiceError("dependency");
          }
          const envelope = parseRpcFileEnvelope(entry.envelope);
          const path = entry.objectPath;
          const size = entry.ciphertextSize;
          const slot = entry.slot;
          if (
            !envelope ||
            typeof path !== "string" ||
            !STORAGE_PATH_PATTERN.test(path) ||
            typeof size !== "number" ||
            !Number.isSafeInteger(size) ||
            size < 16 ||
            size > MAX_FILE_CIPHERTEXT_SIZE ||
            typeof slot !== "number" ||
            !Number.isSafeInteger(slot) ||
            slot < 0 ||
            slot >= MAX_ATTACHMENTS ||
            slots.has(slot)
          ) {
            throw new ShareServiceError("dependency");
          }
          slots.add(slot);
          pendingFiles.push({ slot, envelope, path, size });
        }

        for (const pending of pendingFiles) {
          let downloadUrl: string;
          try {
            downloadUrl = await storage.createSignedDownload(pending.path, 60);
          } catch {
            throw new ShareServiceError("dependency");
          }
          if (!isHttpUrl(downloadUrl)) throw new ShareServiceError("dependency");
          files.push({ slot: pending.slot, envelope: pending.envelope, ciphertextSize: pending.size, downloadUrl });
        }

        return {
          status: "authorized",
          contentEnvelope,
          files,
          retryExpiresAt,
          releaseWindowEndsAt,
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
      if (parentCommentId !== "" && !isUuid(parentCommentId)) {
        throw new ShareServiceError("invalid");
      }
      const editToken = typeof payload.editToken === "string" ? payload.editToken : "";
      if (!isDigest(capability) || !isDigest(editToken) || typeof payload.bodyEnvelope !== "object" || payload.bodyEnvelope === null) {
        throw new ShareServiceError("invalid");
      }
      try {
        validateDiscussionEnvelope(payload.bodyEnvelope, MAX_DISCUSSION_BODY_CIPHERTEXT_BYTES);
        if (payload.nicknameEnvelope !== undefined && payload.nicknameEnvelope !== null) validateDiscussionEnvelope(payload.nicknameEnvelope, MAX_DISCUSSION_NICKNAME_CIPHERTEXT_BYTES);
      } catch {
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
        const createdAt = row ? parseIsoUtc(row.created_at) : null;
        if (
          !row ||
          !hasExactKeys(row, ["comment_id", "created_at"]) ||
          !isUuid(row.comment_id) ||
          !createdAt
        ) {
          throw new ShareServiceError("dependency");
        }
        return {
          commentId: row.comment_id,
          createdAt,
        };
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        if (error instanceof RpcRequestError && (error.code === "22023" || error.code === "P0001")) {
          throw discussionRpcError(error);
        }
        throw dependencyError();
      }
    },

    async editComment(publicId, commentId, payload) {
      const capability = typeof payload.capability === "string" ? payload.capability : "";
      const editToken = typeof payload.editToken === "string" ? payload.editToken : "";
      if (!isUuid(commentId) || !isDigest(capability) || !isDigest(editToken) || typeof payload.bodyEnvelope !== "object" || payload.bodyEnvelope === null) {
        throw new ShareServiceError("invalid");
      }
      try {
        validateDiscussionEnvelope(payload.bodyEnvelope, MAX_DISCUSSION_BODY_CIPHERTEXT_BYTES);
      } catch {
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
        const editedAt = row ? parseIsoUtc(row.edited_at) : null;
        if (
          !row ||
          !hasExactKeys(row, ["comment_id", "edited_at"]) ||
          !isUuid(row.comment_id) ||
          !editedAt
        ) {
          throw new ShareServiceError("dependency");
        }
        return { commentId: row.comment_id, editedAt };
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        if (error instanceof RpcRequestError && (error.code === "22023" || error.code === "P0001")) {
          throw discussionRpcError(error);
        }
        throw dependencyError();
      }
    },

    async deleteComment(publicId, commentId, payload) {
      const capability = typeof payload.capability === "string" ? payload.capability : "";
      const editToken = typeof payload.editToken === "string" ? payload.editToken : "";
      if (!isUuid(commentId) || !isDigest(capability) || !isDigest(editToken)) {
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
        if (!row || !hasExactKeys(row, ["deleted"]) || typeof row.deleted !== "boolean") {
          throw new ShareServiceError("dependency");
        }
        return row.deleted;
      } catch (error) {
        if (error instanceof ShareServiceError) throw error;
        if (error instanceof RpcRequestError && (error.code === "22023" || error.code === "P0001")) {
          throw discussionRpcError(error);
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
        const comments = parseShareCommentRows(value);
        if (!comments) throw new ShareServiceError("dependency");
        return comments;
      } catch (error) {
        if (error instanceof RpcRequestError && error.code === "22023") {
          throw discussionRpcError(error);
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

import { Buffer } from "node:buffer";
import type { UploadReservationInput } from "@/lib/shares/contracts";
import { parseIsoUtc } from "@/lib/shares/contracts";
import { createRpcClient, type RpcClient, RpcRequestError } from "./supabase-rpc";
import { createSecureStorage, type SecureStorage } from "./storage";

export class UploadServiceError extends Error {
  readonly kind: "dependency" | "invalid" | "conflict" | "attached";

  constructor(kind: "dependency" | "invalid" | "conflict" | "attached") {
    super("SecureBin upload operation failed");
    this.name = "UploadServiceError";
    this.kind = kind;
  }
}

export interface UploadReservationResult {
  readonly uploadUrl: string | null;
  readonly alreadyUploaded: boolean;
  readonly expiresAt: string;
}

export interface UploadService {
  createReservation(input: UploadReservationInput): Promise<UploadReservationResult>;
}

function bytesHex(value: string): string {
  return `\\x${Buffer.from(value, "base64url").toString("hex")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstRow(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length !== 1) return null;
  const row = value[0];
  return isRecord(row) ? row : null;
}

export function createUploadService(
  rpc: RpcClient = createRpcClient(),
  storage: SecureStorage = createSecureStorage()
): UploadService {
  return {
    async createReservation(input) {
      let objectPath: string;
      let expiresAt: string;
      let alreadyUploaded = false;

      try {
        const value = await rpc.call("create_upload_reservation", {
          p_public_id: input.publicId,
          p_idempotency_key_hash: bytesHex(input.idempotencyKeyHash),
          p_file_envelope: input.fileEnvelope,
          p_expected_ciphertext_size: input.expectedCiphertextSize,
          p_attachment_slot: input.attachmentSlot,
        });
        const row = firstRow(value);
        if (
          !row ||
          typeof row.object_path !== "string" ||
          !row.expires_at ||
          typeof row.already_uploaded !== "boolean"
        ) {
          throw new UploadServiceError("dependency");
        }
        objectPath = row.object_path;
        alreadyUploaded = row.already_uploaded;
        const parsedExpiry = parseIsoUtc(row.expires_at);
        if (!parsedExpiry) throw new UploadServiceError("dependency");
        expiresAt = parsedExpiry;
      } catch (error) {
        if (error instanceof UploadServiceError) throw error;
        if (error instanceof RpcRequestError) {
          if (error.code === "23505" || error.errorDetails?.includes("reservation_conflict")) {
            throw new UploadServiceError("conflict");
          }
          if (error.errorDetails?.includes("reservation_attached")) {
            throw new UploadServiceError("attached");
          }
          if (error.code === "22023") {
            throw new UploadServiceError("invalid");
          }
        }
        throw new UploadServiceError("dependency");
      }

      if (alreadyUploaded) {
        return { uploadUrl: null, alreadyUploaded: true, expiresAt };
      }

      try {
        const signed = await storage.createSignedUpload(objectPath);
        return { uploadUrl: signed.url, alreadyUploaded: false, expiresAt };
      } catch {
        throw new UploadServiceError("dependency");
      }
    },
  };
}

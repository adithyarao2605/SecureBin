import type { RpcClient } from "./supabase-rpc";
import { createRpcClient } from "./supabase-rpc";
import type { SecureStorage } from "./storage";
import { createSecureStorage } from "./storage";

export interface CleanupCandidate {
  readonly candidate_type: "share" | "upload" | "upload_rotation";
  readonly share_id: string | null;
  readonly reservation_id: string | null;
  readonly object_path: string;
}

export interface CleanupResult {
  readonly deletedShares: number;
  readonly deletedUploads: number;
  readonly deletedUploadRotations: number;
  readonly deletedLeases: number;
  readonly deletedBuckets: number;
}

export interface CleanupService {
  runCleanup(): Promise<CleanupResult>;
}

const STORAGE_PATH_PATTERN = /^objects\/[0-9a-f]{48}\.bin$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && UUID_PATTERN.test(value));
}

function parseCandidate(value: unknown): CleanupCandidate | null {
  if (!isRecord(value)) return null;
  const candidateType = value.candidate_type;
  const item = value;
  if (
    (candidateType !== "share" && candidateType !== "upload" && candidateType !== "upload_rotation") ||
    typeof item.object_path !== "string" ||
    !STORAGE_PATH_PATTERN.test(item.object_path) ||
    !isNullableUuid(item.share_id) ||
    !isNullableUuid(item.reservation_id)
  ) {
    return null;
  }
  if (candidateType === "share" && !item.share_id) return null;
  if ((candidateType === "upload" || candidateType === "upload_rotation") && !item.reservation_id) {
    return null;
  }
  return {
    candidate_type: candidateType,
    share_id: item.share_id,
    reservation_id: item.reservation_id,
    object_path: item.object_path,
  };
}

export function createCleanupService(
  rpc: RpcClient = createRpcClient(),
  storage: SecureStorage = createSecureStorage()
): CleanupService {
  return {
    async runCleanup(): Promise<CleanupResult> {
      const rawCandidates = await rpc.call("list_cleanup_candidates", {});
      const candidates = Array.isArray(rawCandidates)
        ? rawCandidates.map(parseCandidate).filter((candidate): candidate is CleanupCandidate => candidate !== null)
        : [];

      // A share may have several attachment candidates. Finalize it only
      // after every path in its group was deleted (or already missing), so a
      // transient failure leaves the whole share retryable on the next run.
      const shareGroups = new Map<string, CleanupCandidate[]>();
      const nonShareCandidates: CleanupCandidate[] = [];
      for (const candidate of candidates) {
        if (candidate.candidate_type === "share" && candidate.share_id) {
          const group = shareGroups.get(candidate.share_id) ?? [];
          group.push(candidate);
          shareGroups.set(candidate.share_id, group);
        } else {
          nonShareCandidates.push(candidate);
        }
      }

      const successfulShareIds: string[] = [];
      const successfulReservationIds: string[] = [];
      const successfulRotationIds: string[] = [];

      for (const [shareId, group] of shareGroups) {
        let complete = true;
        for (const candidate of group) {
          try {
            await storage.remove(candidate.object_path);
          } catch {
            complete = false;
          }
        }
        if (complete) successfulShareIds.push(shareId);
      }

      for (const candidate of nonShareCandidates) {
        try {
          await storage.remove(candidate.object_path);
          if (candidate.candidate_type === "upload" && candidate.reservation_id) {
            successfulReservationIds.push(candidate.reservation_id);
          } else if (candidate.candidate_type === "upload_rotation" && candidate.reservation_id) {
            successfulRotationIds.push(candidate.reservation_id);
          }
        } catch {
          // If storage removal fails, preserve the row
        }
      }

      const finalizeResult = await rpc.call("finalize_expired_securebin", {
        p_share_ids: successfulShareIds.length > 0 ? successfulShareIds : null,
        p_reservation_ids: successfulReservationIds.length > 0 ? successfulReservationIds : null,
        p_rotation_ids: successfulRotationIds.length > 0 ? successfulRotationIds : null,
      });

      const firstRow =
        Array.isArray(finalizeResult) && isRecord(finalizeResult[0])
          ? finalizeResult[0]
          : {};

      return {
        deletedShares: typeof firstRow.deleted_shares === "number" ? firstRow.deleted_shares : 0,
        deletedUploads: typeof firstRow.deleted_uploads === "number" ? firstRow.deleted_uploads : 0,
        deletedUploadRotations:
          typeof firstRow.deleted_rotated_uploads === "number" ? firstRow.deleted_rotated_uploads : 0,
        deletedLeases: typeof firstRow.deleted_leases === "number" ? firstRow.deleted_leases : 0,
        deletedBuckets: typeof firstRow.deleted_buckets === "number" ? firstRow.deleted_buckets : 0,
      };
    },
  };
}

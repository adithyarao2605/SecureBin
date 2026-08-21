import type { RpcClient } from "./supabase-rpc";
import { createRpcClient } from "./supabase-rpc";
import type { SecureStorage } from "./storage";
import { createSecureStorage } from "./storage";

export interface CleanupCandidate {
  readonly candidate_type: "share" | "upload";
  readonly share_id: string | null;
  readonly reservation_id: string | null;
  readonly object_path: string;
}

export interface CleanupResult {
  readonly deletedShares: number;
  readonly deletedUploads: number;
  readonly deletedLeases: number;
  readonly deletedBuckets: number;
}

export interface CleanupService {
  runCleanup(): Promise<CleanupResult>;
}

const STORAGE_PATH_PATTERN = /^objects\/[0-9a-f]{48}\.bin$/;

export function createCleanupService(
  rpc: RpcClient = createRpcClient(),
  storage: SecureStorage = createSecureStorage()
): CleanupService {
  return {
    async runCleanup(): Promise<CleanupResult> {
      const rawCandidates = (await rpc.call("list_cleanup_candidates", {})) as unknown[];
      const candidates: CleanupCandidate[] = [];
      if (Array.isArray(rawCandidates)) {
        for (const item of rawCandidates) {
          if (
            item &&
            typeof item === "object" &&
            "object_path" in item &&
            typeof item.object_path === "string" &&
            STORAGE_PATH_PATTERN.test(item.object_path)
          ) {
            candidates.push(item as CleanupCandidate);
          }
        }
      }

      const successfulShareIds: string[] = [];
      const successfulReservationIds: string[] = [];

      for (const candidate of candidates) {
        try {
          await storage.remove(candidate.object_path);
          if (candidate.candidate_type === "share" && candidate.share_id) {
            successfulShareIds.push(candidate.share_id);
          } else if (candidate.candidate_type === "upload" && candidate.reservation_id) {
            successfulReservationIds.push(candidate.reservation_id);
          }
        } catch {
          // If storage removal fails, preserve the row
        }
      }

      const finalizeResult = (await rpc.call("finalize_expired_securebin", {
        p_share_ids: successfulShareIds.length > 0 ? successfulShareIds : null,
        p_reservation_ids: successfulReservationIds.length > 0 ? successfulReservationIds : null,
      })) as unknown[];

      const firstRow =
        Array.isArray(finalizeResult) && finalizeResult[0] && typeof finalizeResult[0] === "object"
          ? (finalizeResult[0] as Record<string, unknown>)
          : {};

      return {
        deletedShares: typeof firstRow.deleted_shares === "number" ? firstRow.deleted_shares : 0,
        deletedUploads: typeof firstRow.deleted_uploads === "number" ? firstRow.deleted_uploads : 0,
        deletedLeases: typeof firstRow.deleted_leases === "number" ? firstRow.deleted_leases : 0,
        deletedBuckets: typeof firstRow.deleted_buckets === "number" ? firstRow.deleted_buckets : 0,
      };
    },
  };
}

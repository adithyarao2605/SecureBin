import { describe, expect, it, vi } from "vitest";

import { createCleanupService } from "@/lib/server/cleanup-service";
import type { RpcClient } from "@/lib/server/supabase-rpc";
import type { SecureStorage } from "@/lib/server/storage";

const queueId = "11111111-1111-4111-8111-111111111111";
const queuedPath = "objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bin";

function dependencies(remove: SecureStorage["remove"], deletedRotated = 1): {
  readonly rpc: RpcClient;
  readonly storage: SecureStorage;
} {
  const rpc: RpcClient = {
    call: vi.fn(async (name: string) => {
      if (name === "list_cleanup_candidates") {
        return [{
          candidate_type: "upload_rotation",
          share_id: null,
          reservation_id: queueId,
          object_path: queuedPath,
        }];
      }
      if (name === "finalize_expired_securebin") {
        return [{
          deleted_shares: 0,
          deleted_uploads: 0,
          deleted_rotated_uploads: deletedRotated,
          deleted_leases: 0,
          deleted_buckets: 0,
        }];
      }
      throw new Error(`unexpected RPC: ${name}`);
    }),
  };
  const storage: SecureStorage = {
    createSignedUpload: vi.fn(),
    createSignedDownload: vi.fn(),
    inspectSize: vi.fn(),
    remove,
  };
  return { rpc, storage };
}

describe("cleanup service rotation queue", () => {
  it("finalizes a queue row only after Storage reports deletion", async () => {
    const remove = vi.fn(async () => "deleted" as const);
    const { rpc, storage } = dependencies(remove);

    const result = await createCleanupService(rpc, storage).runCleanup();

    expect(remove).toHaveBeenCalledWith(queuedPath);
    expect(rpc.call).toHaveBeenLastCalledWith("finalize_expired_securebin", {
      p_share_ids: null,
      p_reservation_ids: null,
      p_rotation_ids: [queueId],
    });
    expect(result.deletedUploadRotations).toBe(1);
  });

  it("preserves a queue row when Storage removal fails", async () => {
    const remove = vi.fn(async () => {
      throw new Error("storage unavailable");
    });
    const { rpc, storage } = dependencies(remove, 0);

    const result = await createCleanupService(rpc, storage).runCleanup();

    expect(rpc.call).toHaveBeenLastCalledWith("finalize_expired_securebin", {
      p_share_ids: null,
      p_reservation_ids: null,
      p_rotation_ids: null,
    });
    expect(result.deletedUploadRotations).toBe(0);
  });
});

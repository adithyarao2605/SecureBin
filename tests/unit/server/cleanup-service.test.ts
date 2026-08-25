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

  it("cleans up expired shares with attached encrypted objects", async () => {
    const shareId = "22222222-2222-4222-8222-222222222222";
    const sharePath = "objects/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.bin";
    const remove = vi.fn(async () => "deleted" as const);

    const rpc: RpcClient = {
      call: vi.fn(async (name: string) => {
        if (name === "list_cleanup_candidates") {
          return [{
            candidate_type: "share",
            share_id: shareId,
            reservation_id: null,
            object_path: sharePath,
          }];
        }
        if (name === "finalize_expired_securebin") {
          return [{
            deleted_shares: 1,
            deleted_uploads: 0,
            deleted_rotated_uploads: 0,
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

    const result = await createCleanupService(rpc, storage).runCleanup();
    expect(remove).toHaveBeenCalledWith(sharePath);
    expect(rpc.call).toHaveBeenLastCalledWith("finalize_expired_securebin", {
      p_share_ids: [shareId],
      p_reservation_ids: null,
      p_rotation_ids: null,
    });
    expect(result.deletedShares).toBe(1);
  });

  it("finalizes an expired note-only share without touching Storage", async () => {
    const shareId = "44444444-4444-4444-8444-444444444444";
    const remove = vi.fn(async () => "deleted" as const);
    const rpc: RpcClient = {
      call: vi.fn(async (name: string) => {
        if (name === "list_cleanup_candidates") {
          return [{
            candidate_type: "share",
            share_id: shareId,
            reservation_id: null,
            object_path: null,
          }];
        }
        if (name === "finalize_expired_securebin") {
          return [{
            deleted_shares: 1,
            deleted_uploads: 0,
            deleted_rotated_uploads: 0,
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

    const result = await createCleanupService(rpc, storage).runCleanup();
    expect(remove).not.toHaveBeenCalled();
    expect(rpc.call).toHaveBeenLastCalledWith("finalize_expired_securebin", {
      p_share_ids: [shareId],
      p_reservation_ids: null,
      p_rotation_ids: null,
    });
    expect(result.deletedShares).toBe(1);
  });

  it("cleans up orphaned upload reservations", async () => {
    const resId = "33333333-3333-4333-8333-333333333333";
    const resPath = "objects/cccccccccccccccccccccccccccccccccccccccccccccccc.bin";
    const remove = vi.fn(async () => "deleted" as const);

    const rpc: RpcClient = {
      call: vi.fn(async (name: string) => {
        if (name === "list_cleanup_candidates") {
          return [{
            candidate_type: "upload",
            share_id: null,
            reservation_id: resId,
            object_path: resPath,
          }];
        }
        if (name === "finalize_expired_securebin") {
          return [{
            deleted_shares: 0,
            deleted_uploads: 1,
            deleted_rotated_uploads: 0,
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

    const result = await createCleanupService(rpc, storage).runCleanup();
    expect(remove).toHaveBeenCalledWith(resPath);
    expect(rpc.call).toHaveBeenLastCalledWith("finalize_expired_securebin", {
      p_share_ids: null,
      p_reservation_ids: [resId],
      p_rotation_ids: null,
    });
    expect(result.deletedUploads).toBe(1);
  });

  it("fails closed when the candidate RPC returns an unknown or malformed row", async () => {
    const remove = vi.fn(async () => "deleted" as const);
    const finalize = vi.fn(async () => [{
      deleted_shares: 0,
      deleted_uploads: 0,
      deleted_rotated_uploads: 0,
      deleted_leases: 0,
      deleted_buckets: 0,
    }]);
    const rpc: RpcClient = {
      call: vi.fn(async (name: string) => {
        if (name === "list_cleanup_candidates") {
          return [{
            candidate_type: "share",
            share_id: "22222222-2222-4222-8222-222222222222",
            reservation_id: null,
            object_path: queuedPath,
            unexpected: true,
          }];
        }
        if (name === "finalize_expired_securebin") return finalize();
        throw new Error(`unexpected RPC: ${name}`);
      }),
    };
    const storage: SecureStorage = {
      createSignedUpload: vi.fn(),
      createSignedDownload: vi.fn(),
      inspectSize: vi.fn(),
      remove,
    };

    await expect(createCleanupService(rpc, storage).runCleanup()).rejects.toThrow("Invalid cleanup candidate response");
    expect(remove).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

import { createCleanupService } from "@/lib/server/cleanup-service";

const shareId = "11111111-1111-4111-8111-111111111111";
const pathA = "objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bin";
const pathB = "objects/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.bin";

describe("cleanup service attachment grouping", () => {
  it("does not finalize a share when one attachment deletion fails, then retries the group", async () => {
    const rpc = {
      call: vi.fn(async (name: string, _args: Record<string, unknown>) => {
        if (name === "list_cleanup_candidates") {
          return [
            { candidate_type: "share", share_id: shareId, reservation_id: null, object_path: pathA },
            { candidate_type: "share", share_id: shareId, reservation_id: null, object_path: pathB },
          ];
        }
        return [{ deleted_shares: 0, deleted_uploads: 0, deleted_rotated_uploads: 0, deleted_leases: 0, deleted_buckets: 0 }];
      }),
    };
    let removeCalls = 0;
    const storage = {
      remove: vi.fn(async () => {
        removeCalls += 1;
        if (removeCalls === 2) throw new Error("transient storage failure");
        return "deleted" as const;
      }),
    };
    const service = createCleanupService(rpc as never, storage as never);

    await service.runCleanup();
    const firstRunCalls = rpc.call.mock.calls as unknown as Array<[string, Record<string, unknown>]>;
    const firstFinalize = firstRunCalls.find((call) => call[0] === "finalize_expired_securebin");
    expect(firstFinalize?.[1]).toMatchObject({ p_share_ids: null });

    await service.runCleanup();
    const allCalls = rpc.call.mock.calls as unknown as Array<[string, Record<string, unknown>]>;
    const finalizeCalls = allCalls.filter((call) => call[0] === "finalize_expired_securebin");
    expect(finalizeCalls[1]?.[1]).toMatchObject({ p_share_ids: [shareId] });
    expect(storage.remove).toHaveBeenCalledTimes(4);
  });
});

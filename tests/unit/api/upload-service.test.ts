import { describe, expect, it, vi } from "vitest";

import { createUploadService } from "@/lib/server/upload-service";
import { RpcRequestError } from "@/lib/server/supabase-rpc";

const publicId = "AQEBAQEBAQEBAQEBAQEBAQ";

function rpcStub(response: unknown = [{ object_path: "shares/abc", expires_at: "2026-09-01T00:00:00Z" }]) {
  return { call: vi.fn(async () => response) };
}

describe("upload reservation service", () => {
  it("forwards the attachment slot to the reservation RPC", async () => {
    const rpc = rpcStub();
    const storage = { createSignedUpload: vi.fn(async () => ({ url: "https://signed", token: "t" })) };
    const service = createUploadService(rpc as never, storage as never);

    await service.createReservation({
      publicId,
      idempotencyKeyHash: "A".repeat(32),
      fileEnvelope: { version: 2 },
      expectedCiphertextSize: 1024,
      attachmentSlot: 3,
    } as never);

    expect(rpc.call).toHaveBeenCalledWith("create_upload_reservation", expect.objectContaining({
      p_public_id: publicId,
      p_attachment_slot: 3,
    }));
  });

  it("maps reservation_conflict to a conflict error", async () => {
    const rpc = {
      call: vi.fn(async () => {
        throw new RpcRequestError("conflict", "23505", "reservation_conflict");
      }),
    };
    const service = createUploadService(rpc as never, { createSignedUpload: vi.fn() } as never);
    await expect(
      service.createReservation({
        publicId,
        idempotencyKeyHash: "A".repeat(32),
        fileEnvelope: { version: 2 },
        expectedCiphertextSize: 1024,
        attachmentSlot: 0,
      } as never)
    ).rejects.toMatchObject({ kind: "conflict" });
  });
});

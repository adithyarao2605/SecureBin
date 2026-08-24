import { describe, expect, it, vi } from "vitest";

import { createUploadService } from "@/lib/server/upload-service";
import { RpcRequestError } from "@/lib/server/supabase-rpc";

const publicId = "AQEBAQEBAQEBAQEBAQEBAQ";

function rpcStub(response: unknown = [{ object_path: "shares/abc", expires_at: "2026-09-01T00:00:00Z", already_uploaded: false }]) {
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
    expect(storage.createSignedUpload).toHaveBeenCalledWith("shares/abc");
  });

  it("recovers a completed PUT without minting another signed upload URL", async () => {
    const rpc = rpcStub([{ object_path: "objects/finished.bin", expires_at: "2026-09-01T00:00:00Z", already_uploaded: true }]);
    const storage = { createSignedUpload: vi.fn(async () => ({ url: "https://must-not-be-called" })) };
    const service = createUploadService(rpc as never, storage as never);

    await expect(service.createReservation({
      publicId,
      idempotencyKeyHash: "A".repeat(32),
      fileEnvelope: { version: 2 },
      expectedCiphertextSize: 1024,
      attachmentSlot: 0,
    } as never)).resolves.toEqual({
      uploadUrl: null,
      alreadyUploaded: true,
      expiresAt: "2026-09-01T00:00:00.000Z",
    });
    expect(storage.createSignedUpload).not.toHaveBeenCalled();
  });

  it("maps reservation_conflict to a conflict error", async () => {
    const rpc = {
      call: vi.fn(async () => {
          throw new RpcRequestError(409, "23505", "reservation_conflict");
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

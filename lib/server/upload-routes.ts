import { errorResponse, jsonResponse, readJsonBody } from "./http";
import { readServerConfig } from "./config";
import { networkDiscriminator } from "./hashing";
import { parseUploadReservationInput } from "@/lib/shares/contracts";
import { createUploadService, UploadServiceError, type UploadService } from "./upload-service";
import { createShareService, type ShareService } from "./share-service";

const MAX_UPLOAD_JSON_BYTES = 65_536;

export interface UploadRouteDependencies {
  readonly uploadService: UploadService;
  readonly shareService: ShareService;
  readonly rateLimitHmacKey: string;
}

export function defaultUploadRouteDependencies(): UploadRouteDependencies {
  const config = readServerConfig();
  return {
    uploadService: createUploadService(),
    shareService: createShareService(),
    rateLimitHmacKey: config.rateLimitHmacKey,
  };
}

export function createPostUploadHandler(
  dependencies: UploadRouteDependencies
): (request: Request) => Promise<Response> {
  return async (request) => {
    let allowed: boolean;
    try {
      const discriminator = networkDiscriminator(request, dependencies.rateLimitHmacKey);
      allowed = await dependencies.shareService.consumeRateLimit(discriminator, "upload", 30);
    } catch {
      return errorResponse("server_error", 503);
    }
    if (!allowed) {
      return errorResponse("rate_limited", 429);
    }

    const body = await readJsonBody(request, MAX_UPLOAD_JSON_BYTES);
    if (body === null) {
      return errorResponse("invalid_request", 400);
    }

    const input = parseUploadReservationInput(body);
    if (!input) {
      return errorResponse("invalid_request", 400);
    }

    try {
      const result = await dependencies.uploadService.createReservation(input);
      return jsonResponse({
        uploadUrl: result.uploadUrl,
        token: result.token,
        expiresAt: result.expiresAt,
      }, 201);
    } catch (error) {
      console.error("[SecureBin Server] create_upload_reservation failed:", error instanceof Error ? error.message : String(error));
      if (error instanceof UploadServiceError) {
        if (error.kind === "conflict") {
          return errorResponse("reservation_conflict", 409);
        }
        if (error.kind === "attached") {
          return errorResponse("reservation_attached", 409);
        }
        if (error.kind === "invalid") {
          return errorResponse("invalid_request", 400);
        }
        return errorResponse("server_error", 503);
      }
      return errorResponse("server_error", 500);
    }
  };
}

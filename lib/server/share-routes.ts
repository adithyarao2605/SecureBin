import { isPublicId, parseCreateShareInput, parseDeleteInput, parseRevealInput, type ShareStatus } from "../shares/contracts";
import { networkDiscriminator } from "./hashing";
import { errorResponse, jsonResponse, readJsonBody } from "./http";
import { readServerConfig } from "./config";
import { createShareService, ShareServiceError, type ShareService } from "./share-service";

export interface ShareRouteDependencies {
  readonly service: ShareService;
  readonly rateLimitHmacKey: string;
}

const MAX_CREATE_BODY_BYTES = 1_100_000;
const MAX_SMALL_BODY_BYTES = 4_096;

function defaultDependencies(): ShareRouteDependencies {
  const config = readServerConfig();
  return { service: createShareService(), rateLimitHmacKey: config.rateLimitHmacKey };
}

function isDependencyFailure(error: unknown): boolean {
  return error instanceof ShareServiceError && error.kind === "dependency";
}

async function allowed(request: Request, dependencies: ShareRouteDependencies, action: "create" | "status" | "reveal" | "delete", limit: number): Promise<true | Response> {
    try {
      const discriminator = networkDiscriminator(request, dependencies.rateLimitHmacKey);
      const accepted = await dependencies.service.consumeRateLimit(discriminator, action, limit);
    if (!accepted) return errorResponse("rate_limited", 429);
    return true;
  } catch {
    return errorResponse("server_error", 503);
  }
}

export function createPostShareHandler(dependencies: ShareRouteDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    const rateLimit = await allowed(request, dependencies, "create", 20);
    if (rateLimit !== true) return rateLimit;
    const body = await readJsonBody(request, MAX_CREATE_BODY_BYTES);
    const input = parseCreateShareInput(body);
    if (!input) return errorResponse("invalid_request", 400);
    try {
      const result = await dependencies.service.createShare(input);
      return jsonResponse({
        publicId: result.publicId,
        created: result.created,
        policy: {
          availableAt: input.availableAt,
          expiresAt: input.expiresAt,
          maxReveals: input.maxReveals,
          passwordRequired: input.passwordRequired,
          unlockRequired: input.unlockRequired,
        },
      }, 201);
    } catch (error) {
      return isDependencyFailure(error) ? errorResponse("server_error", 503) : errorResponse("server_error", 500);
    }
  };
}

export function createGetStatusHandler(dependencies: ShareRouteDependencies): (request: Request, context: { params: Promise<{ publicId: string }> }) => Promise<Response> {
  return async (request, context) => {
    const rateLimit = await allowed(request, dependencies, "status", 60);
    if (rateLimit !== true) return rateLimit;
    let publicId: string;
    try {
      publicId = (await context.params).publicId;
    } catch {
      return jsonResponse({ status: "unavailable" }, 404);
    }
    if (!isPublicId(publicId)) return jsonResponse({ status: "unavailable" }, 404);
    try {
      const status = await dependencies.service.getStatus(publicId);
      return jsonResponse(statusPayload(status));
    } catch (error) {
      return isDependencyFailure(error) ? errorResponse("server_error", 503) : errorResponse("server_error", 500);
    }
  };
}

export function createPostRevealHandler(dependencies: ShareRouteDependencies): (request: Request, context: { params: Promise<{ publicId: string }> }) => Promise<Response> {
  return async (request, context) => {
    const rateLimit = await allowed(request, dependencies, "reveal", 20);
    if (rateLimit !== true) return rateLimit;
    let publicId: string;
    try {
      publicId = (await context.params).publicId;
    } catch {
      return jsonResponse({ status: "unavailable" }, 404);
    }
    if (!isPublicId(publicId)) return jsonResponse({ status: "unavailable" }, 404);
    const input = parseRevealInput(await readJsonBody(request, MAX_SMALL_BODY_BYTES));
    if (!input) return errorResponse("invalid_request", 400);
    try {
      const result = await dependencies.service.reveal(publicId, input.requestToken);
      if (result.status !== "authorized" || !result.contentEnvelope || !result.retryExpiresAt) return jsonResponse({ status: "unavailable" }, 404);
      return jsonResponse({ status: "authorized", contentEnvelope: result.contentEnvelope, retryExpiresAt: result.retryExpiresAt });
    } catch (error) {
      return isDependencyFailure(error) ? errorResponse("server_error", 503) : errorResponse("server_error", 500);
    }
  };
}

export function createDeleteShareHandler(dependencies: ShareRouteDependencies): (request: Request, context: { params: Promise<{ publicId: string }> }) => Promise<Response> {
  return async (request, context) => {
    const rateLimit = await allowed(request, dependencies, "delete", 20);
    if (rateLimit !== true) return rateLimit;
    let publicId: string;
    try {
      publicId = (await context.params).publicId;
    } catch {
      return errorResponse("unavailable", 404);
    }
    if (!isPublicId(publicId)) return errorResponse("unavailable", 404);
    const input = parseDeleteInput(await readJsonBody(request, MAX_SMALL_BODY_BYTES));
    if (!input) return errorResponse("invalid_request", 400);
    try {
      const revoked = await dependencies.service.revoke(publicId, input.deleteCapability);
      return revoked ? jsonResponse({ revoked: true }) : errorResponse("unavailable", 404);
    } catch (error) {
      return isDependencyFailure(error) ? errorResponse("server_error", 503) : errorResponse("server_error", 500);
    }
  };
}

function statusPayload(status: ShareStatus): unknown {
  if (status.status === "unavailable") return { status: "unavailable" };
  return {
    status: status.status,
    availableAt: status.availableAt,
    expiresAt: status.expiresAt,
    passwordRequired: status.passwordRequired,
    unlockRequired: status.unlockRequired,
    maxReveals: status.maxReveals,
    remainingReveals: status.remainingReveals,
  };
}

export const defaultShareRouteDependencies = defaultDependencies;

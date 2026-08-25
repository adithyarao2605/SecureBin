import {
  parseAddCommentInput,
  parseDeleteCommentInput,
  parseEditCommentInput,
} from "../shares/contracts";
import { errorResponse, jsonResponse, readJsonBody } from "./http";
import { readServerConfig, type ProxyTrust } from "./config";
import { networkDiscriminator } from "./hashing";
import { createShareService, ShareServiceError, type ShareService } from "./share-service";
import { RpcRequestError } from "./supabase-rpc";

const MAX_COMMENT_BODY_BYTES = 4_096;

export interface CommentRouteDependencies {
  readonly service: ShareService;
  readonly rateLimitHmacKey: string;
  readonly proxyTrust?: ProxyTrust;
}

export function defaultCommentRouteDependencies(): CommentRouteDependencies {
  const config = readServerConfig();
  return { service: createShareService(), rateLimitHmacKey: config.rateLimitHmacKey, proxyTrust: config.proxyTrust };
}

export function createCommentHandlers(dependencies: CommentRouteDependencies): {
  get: (request: Request, context: { params: Promise<{ publicId: string }> }) => Promise<Response>;
  post: (request: Request, context: { params: Promise<{ publicId: string }> }) => Promise<Response>;
  patch: (request: Request, context: { params: Promise<{ publicId: string; commentId: string }> }) => Promise<Response>;
  delete: (request: Request, context: { params: Promise<{ publicId: string; commentId: string }> }) => Promise<Response>;
} {
  async function allowed(
    request: Request,
    action: "discussion",
    limit: number
  ): Promise<true | Response> {
    try {
      const discriminator = networkDiscriminator(request, dependencies.rateLimitHmacKey, dependencies.proxyTrust);
      const accepted = await dependencies.service.consumeRateLimit(discriminator, action, limit);
      return accepted ? true : errorResponse("rate_limited", 429);
    } catch {
      return errorResponse("server_error", 503);
    }
  }

  function mapError(error: unknown): Response {
    if (error instanceof ShareServiceError && error.kind === "unavailable") {
      return errorResponse("unavailable", 404);
    }
    if (error instanceof ShareServiceError && error.kind === "invalid") {
      return errorResponse("invalid_request", 400);
    }
    if (
      (error instanceof ShareServiceError && error.kind === "rate_limited") ||
      (error instanceof RpcRequestError && error.code === "P0001" && error.errorDetails?.includes("rate_limited"))
    ) {
      return errorResponse("rate_limited", 429);
    }
    return isDependency(error) ? errorResponse("server_error", 503) : errorResponse("server_error", 500);
  }

  function isDependency(error: unknown): boolean {
    return error instanceof ShareServiceError && error.kind === "dependency";
  }

  return {
    async get(request, context) {
      const limitCheck = await allowed(request, "discussion", 240);
      if (limitCheck !== true) return limitCheck;
      let publicId: string;
      try {
        publicId = (await context.params).publicId;
      } catch {
        return jsonResponse({ comments: [] }, 404);
      }
      // The capability travels in a header instead of the URL so it never
      // lands in proxy or access logs.
      const capability = request.headers.get("x-discussion-capability") ?? "";
      try {
        const comments = await dependencies.service.listComments(publicId, capability);
        return jsonResponse({ comments });
      } catch (error) {
        return mapError(error);
      }
    },

    async post(request, context) {
      const limit = await allowed(request, "discussion", 120);
      if (limit !== true) return limit;
      let publicId: string;
      try {
        publicId = (await context.params).publicId;
      } catch {
        return errorResponse("invalid_request", 400);
      }
      const body = parseAddCommentInput(await readJsonBody(request, MAX_COMMENT_BODY_BYTES));
      if (!body) return errorResponse("invalid_request", 400);
      try {
        const created = await dependencies.service.addComment(publicId, body);
        return jsonResponse(created, 201);
      } catch (error) {
        return mapError(error);
      }
    },

    async patch(request, context) {
      const limitCheck = await allowed(request, "discussion", 120);
      if (limitCheck !== true) return limitCheck;
      let publicId: string;
      let commentId: string;
      try {
        ({ publicId, commentId } = await context.params);
      } catch {
        return errorResponse("invalid_request", 400);
      }
      const body = parseEditCommentInput(await readJsonBody(request, MAX_COMMENT_BODY_BYTES));
      if (!body) return errorResponse("invalid_request", 400);
      try {
        return jsonResponse(await dependencies.service.editComment(publicId, commentId, body));
      } catch (error) {
        return mapError(error);
      }
    },

    async delete(request, context) {
      const limitCheck = await allowed(request, "discussion", 120);
      if (limitCheck !== true) return limitCheck;
      let publicId: string;
      let commentId: string;
      try {
        ({ publicId, commentId } = await context.params);
      } catch {
        return errorResponse("invalid_request", 400);
      }
      const body = parseDeleteCommentInput(await readJsonBody(request, MAX_COMMENT_BODY_BYTES));
      if (!body) return errorResponse("invalid_request", 400);
      try {
        const deleted = await dependencies.service.deleteComment(publicId, commentId, body);
        return deleted ? jsonResponse({ deleted: true }) : errorResponse("unavailable", 404);
      } catch (error) {
        return mapError(error);
      }
    },
  };
}

import { timingSafeEqual } from "node:crypto";
import { errorResponse, jsonResponse } from "./http";
import { readServerConfig } from "./config";
import { createCleanupService, type CleanupService } from "./cleanup-service";

export interface CleanupRouteDependencies {
  readonly cleanupService: CleanupService;
  readonly cronSecret: string;
}

export function defaultCleanupRouteDependencies(): CleanupRouteDependencies {
  const config = readServerConfig();
  return {
    cleanupService: createCleanupService(),
    cronSecret: config.cronSecret,
  };
}

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function createPostCleanupHandler(
  dependencies: CleanupRouteDependencies
): (request: Request) => Promise<Response> {
  return async (request) => {
    const authHeader = request.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    const cronSecretHeader = request.headers.get("x-cron-secret");
    const providedSecret = bearer ?? cronSecretHeader;

    if (!providedSecret || !safeCompare(providedSecret, dependencies.cronSecret)) {
      return errorResponse("unavailable", 404);
    }

    try {
      const result = await dependencies.cleanupService.runCleanup();
      return jsonResponse(result, 200);
    } catch {
      return errorResponse("server_error", 500);
    }
  };
}

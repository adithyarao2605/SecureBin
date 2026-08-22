import { createPostCleanupHandler, defaultCleanupRouteDependencies } from "@/lib/server/cleanup-routes";
import { withAudit } from "@/lib/server/observability";

export const dynamic = "force-dynamic";
export const POST = withAudit("cleanup", (request: Request): Promise<Response> =>
  createPostCleanupHandler(defaultCleanupRouteDependencies())(request)
);

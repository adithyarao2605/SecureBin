import { createPostCleanupHandler, defaultCleanupRouteDependencies } from "@/lib/server/cleanup-routes";
import { withAudit } from "@/lib/server/observability";

export const dynamic = "force-dynamic";
export const POST = withAudit("cleanup", (request: Request): Promise<Response> =>
  createPostCleanupHandler(defaultCleanupRouteDependencies())(request)
);
// Vercel Cron invokes configured paths with GET and automatically supplies
// Authorization: Bearer $CRON_SECRET. Manual owner checks may continue to POST.
export const GET = withAudit("cleanup", (request: Request): Promise<Response> =>
  createPostCleanupHandler(defaultCleanupRouteDependencies())(request)
);

import { createPostStatusBatchHandler, defaultShareRouteDependencies } from "@/lib/server/share-routes";
import { withAudit } from "@/lib/server/observability";

export const dynamic = "force-dynamic";
export const POST = withAudit(
  "status",
  (request: Request): Promise<Response> => createPostStatusBatchHandler(defaultShareRouteDependencies())(request)
);

import { createPostShareHandler, defaultShareRouteDependencies } from "@/lib/server/share-routes";
import { withAudit } from "@/lib/server/observability";

export const dynamic = "force-dynamic";
export const POST = withAudit("create", (request: Request): Promise<Response> =>
  createPostShareHandler(defaultShareRouteDependencies())(request)
);

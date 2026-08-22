import { createGetStatusHandler, defaultShareRouteDependencies } from "@/lib/server/share-routes";
import { withAudit } from "@/lib/server/observability";

export const dynamic = "force-dynamic";
export const GET = withAudit(
  "status",
  (request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> =>
    createGetStatusHandler(defaultShareRouteDependencies())(request, context)
);

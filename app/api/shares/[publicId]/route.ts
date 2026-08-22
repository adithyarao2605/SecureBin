import { createDeleteShareHandler, defaultShareRouteDependencies } from "@/lib/server/share-routes";
import { withAudit } from "@/lib/server/observability";

export const dynamic = "force-dynamic";
export const DELETE = withAudit(
  "delete",
  (request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> =>
    createDeleteShareHandler(defaultShareRouteDependencies())(request, context)
);

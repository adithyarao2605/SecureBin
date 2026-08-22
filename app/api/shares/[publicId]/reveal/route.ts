import { createPostRevealHandler, defaultShareRouteDependencies } from "@/lib/server/share-routes";
import { withAudit } from "@/lib/server/observability";

export const dynamic = "force-dynamic";
export const POST = withAudit(
  "reveal",
  (request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> =>
    createPostRevealHandler(defaultShareRouteDependencies())(request, context)
);

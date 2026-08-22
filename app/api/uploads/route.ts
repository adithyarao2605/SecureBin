import { createPostUploadHandler, defaultUploadRouteDependencies } from "@/lib/server/upload-routes";
import { withAudit } from "@/lib/server/observability";

export const dynamic = "force-dynamic";

export const POST = withAudit("upload", (request: Request): Promise<Response> =>
  createPostUploadHandler(defaultUploadRouteDependencies())(request)
);

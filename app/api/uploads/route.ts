import { createPostUploadHandler, defaultUploadRouteDependencies } from "@/lib/server/upload-routes";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return createPostUploadHandler(defaultUploadRouteDependencies())(request);
}

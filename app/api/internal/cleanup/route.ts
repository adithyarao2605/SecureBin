import { createPostCleanupHandler, defaultCleanupRouteDependencies } from "@/lib/server/cleanup-routes";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return createPostCleanupHandler(defaultCleanupRouteDependencies())(request);
}

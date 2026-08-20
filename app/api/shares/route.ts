import { createPostShareHandler, defaultShareRouteDependencies } from "@/lib/server/share-routes";

export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  return createPostShareHandler(defaultShareRouteDependencies())(request);
}

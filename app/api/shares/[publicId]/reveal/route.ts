import { createPostRevealHandler, defaultShareRouteDependencies } from "@/lib/server/share-routes";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  return createPostRevealHandler(defaultShareRouteDependencies())(request, context);
}

import { createGetStatusHandler, defaultShareRouteDependencies } from "@/lib/server/share-routes";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  return createGetStatusHandler(defaultShareRouteDependencies())(request, context);
}

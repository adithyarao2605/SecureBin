import { createDeleteShareHandler, defaultShareRouteDependencies } from "@/lib/server/share-routes";

export const dynamic = "force-dynamic";
export async function DELETE(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  return createDeleteShareHandler(defaultShareRouteDependencies())(request, context);
}

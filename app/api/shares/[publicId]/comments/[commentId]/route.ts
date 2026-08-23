import { createCommentHandlers, defaultCommentRouteDependencies } from "@/lib/server/comment-routes";

export const dynamic = "force-dynamic";

const handlers = createCommentHandlers(defaultCommentRouteDependencies());

export async function PATCH(
  request: Request,
  context: { params: Promise<{ publicId: string; commentId: string }> }
): Promise<Response> {
  return handlers.patch(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ publicId: string; commentId: string }> }
): Promise<Response> {
  return handlers.delete(request, context);
}

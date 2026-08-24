import { createCommentHandlers, defaultCommentRouteDependencies } from "@/lib/server/comment-routes";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ publicId: string; commentId: string }> }
): Promise<Response> {
  return createCommentHandlers(defaultCommentRouteDependencies()).patch(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ publicId: string; commentId: string }> }
): Promise<Response> {
  return createCommentHandlers(defaultCommentRouteDependencies()).delete(request, context);
}

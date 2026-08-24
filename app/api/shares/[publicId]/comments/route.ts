import { createCommentHandlers, defaultCommentRouteDependencies } from "@/lib/server/comment-routes";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  return createCommentHandlers(defaultCommentRouteDependencies()).get(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  return createCommentHandlers(defaultCommentRouteDependencies()).post(request, context);
}

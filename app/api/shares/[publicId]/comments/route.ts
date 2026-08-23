import { createCommentHandlers, defaultCommentRouteDependencies } from "@/lib/server/comment-routes";

export const dynamic = "force-dynamic";

const handlers = createCommentHandlers(defaultCommentRouteDependencies());

export async function GET(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  return handlers.get(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  return handlers.post(request, context);
}

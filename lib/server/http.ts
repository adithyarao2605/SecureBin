import { NextResponse } from "next/server";

export const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export type ApiErrorCode =
  | "invalid_request"
  | "unavailable"
  | "rate_limited"
  | "server_error"
  | "idempotency_conflict"
  | "reservation_conflict"
  | "reservation_attached";

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  });
}

export function errorResponse(code: ApiErrorCode, status: number, headers: Record<string, string> = {}): NextResponse {
  return jsonResponse({ error: code }, status, headers);
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number.parseInt(contentLength, 10);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > maxBytes) return null;
  }
  try {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > maxBytes) return null;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function routePublicId(context: { params: Promise<{ publicId: string }> }): Promise<string> {
  return context.params.then(({ publicId }) => publicId);
}

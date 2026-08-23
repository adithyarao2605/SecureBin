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
  // Stream with early abort so chunked or undeclared bodies cannot buffer
  // arbitrary bytes in memory ahead of the size cap.
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      void reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    const body = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function routePublicId(context: { params: Promise<{ publicId: string }> }): Promise<string> {
  return context.params.then(({ publicId }) => publicId);
}

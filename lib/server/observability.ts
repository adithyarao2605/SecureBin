import { randomBytes } from "node:crypto";

import { errorResponse } from "./http";

export type AuditAction =
  | "create"
  | "upload"
  | "status"
  | "reveal"
  | "delete"
  | "cleanup"
  | "health";

export type StatusClass = "2xx" | "4xx" | "5xx";
export type SizeBucket = "<1KB" | "1KB-64KB" | "64KB-1MB" | "1MB-10MB" | ">10MB" | "none";

export interface AuditEvent {
  readonly requestId: string;
  readonly action: AuditAction;
  readonly statusClass: StatusClass;
  readonly durationMs: number;
  readonly sizeBucket: SizeBucket;
}

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function sanitizeRequestId(inboundId: string | null | undefined): string {
  if (inboundId && REQUEST_ID_PATTERN.test(inboundId)) {
    return inboundId;
  }
  return randomBytes(16).toString("base64url");
}

export function classifyStatus(status: number): StatusClass {
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 400 && status < 500) return "4xx";
  return "5xx";
}

export function classifySize(bytes: number | null | undefined): SizeBucket {
  if (bytes === null || bytes === undefined || bytes <= 0) return "none";
  if (bytes < 1024) return "<1KB";
  if (bytes <= 65_536) return "1KB-64KB";
  if (bytes <= 1_048_576) return "64KB-1MB";
  if (bytes <= 10_485_760) return "1MB-10MB";
  return ">10MB";
}

export function formatAuditEvent(event: AuditEvent): string {
  return JSON.stringify({
    type: "audit",
    requestId: event.requestId,
    action: event.action,
    statusClass: event.statusClass,
    durationMs: Math.max(0, Math.round(event.durationMs)),
    sizeBucket: event.sizeBucket,
  });
}

export function logAuditEvent(
  event: AuditEvent,
  writer: (msg: string) => void = (msg) => {
    // Only emit audit lines in production or when explicitly enabled
    if (process.env.NODE_ENV !== "test") {
      process.stdout.write(`${msg}\n`);
    }
  }
): void {
  writer(formatAuditEvent(event));
}

/**
 * Wrap an API route handler with coarse, secret-free audit logging and a
 * uniform JSON failure for unexpected throws. The request id echoes a
 * sanitized inbound `x-request-id` or is generated, and is returned to the
 * caller in the response header.
 */
export function withAudit<A extends unknown[]>(
  action: AuditAction,
  handler: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    const startedAtMs = Date.now();
    const request = args[0];
    const inboundId = request instanceof Request ? request.headers.get("x-request-id") : null;
    const requestId = sanitizeRequestId(inboundId);

    let response: Response;
    try {
      response = await handler(...args);
    } catch {
      response = errorResponse("server_error", 500);
    }

    let declaredBytes: number | null = null;
    if (request instanceof Request) {
      const parsed = Number.parseInt(request.headers.get("content-length") ?? "", 10);
      if (Number.isSafeInteger(parsed) && parsed > 0) declaredBytes = parsed;
    }
    logAuditEvent({
      requestId,
      action,
      statusClass: classifyStatus(response.status),
      durationMs: Date.now() - startedAtMs,
      sizeBucket: classifySize(declaredBytes),
    });
    response.headers.set("x-request-id", requestId);
    return response;
  };
}

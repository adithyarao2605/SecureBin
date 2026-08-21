import { randomBytes } from "node:crypto";

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

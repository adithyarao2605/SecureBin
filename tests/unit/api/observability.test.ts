import { describe, expect, it, vi } from "vitest";

import {
  classifySize,
  classifyStatus,
  formatAuditEvent,
  logAuditEvent,
  sanitizeRequestId,
  type AuditEvent,
} from "@/lib/server/observability";

describe("observability and safe auditing", () => {
  it("sanitizes inbound request IDs and falls back to random base64url", () => {
    expect(sanitizeRequestId("valid-req_123")).toBe("valid-req_123");
    expect(sanitizeRequestId("a".repeat(64))).toBe("a".repeat(64));

    // Overly long ID gets replaced
    const tooLong = sanitizeRequestId("a".repeat(65));
    expect(tooLong).not.toBe("a".repeat(65));
    expect(tooLong.length).toBe(22);

    // Invalid characters get replaced
    const withSpecialChars = sanitizeRequestId("bad/id?query=1");
    expect(withSpecialChars).not.toBe("bad/id?query=1");
    expect(withSpecialChars.length).toBe(22);

    // Null/undefined/empty get replaced
    expect(sanitizeRequestId(null).length).toBe(22);
    expect(sanitizeRequestId(undefined).length).toBe(22);
    expect(sanitizeRequestId("").length).toBe(22);
  });

  it("classifies HTTP status codes into coarse classes", () => {
    expect(classifyStatus(200)).toBe("2xx");
    expect(classifyStatus(201)).toBe("2xx");
    expect(classifyStatus(400)).toBe("4xx");
    expect(classifyStatus(404)).toBe("4xx");
    expect(classifyStatus(409)).toBe("4xx");
    expect(classifyStatus(429)).toBe("4xx");
    expect(classifyStatus(500)).toBe("5xx");
    expect(classifyStatus(503)).toBe("5xx");
  });

  it("classifies body sizes into bounded buckets without exact byte leakage", () => {
    expect(classifySize(null)).toBe("none");
    expect(classifySize(undefined)).toBe("none");
    expect(classifySize(0)).toBe("none");
    expect(classifySize(500)).toBe("<1KB");
    expect(classifySize(1024)).toBe("1KB-64KB");
    expect(classifySize(65_536)).toBe("1KB-64KB");
    expect(classifySize(100_000)).toBe("64KB-1MB");
    expect(classifySize(5_000_000)).toBe("1MB-10MB");
    expect(classifySize(15_000_000)).toBe(">10MB");
  });

  it("formats audit log events with zero secret leakage", () => {
    const event: AuditEvent = {
      requestId: "req-123",
      action: "create",
      statusClass: "2xx",
      durationMs: 14.7,
      sizeBucket: "1KB-64KB",
    };

    const formatted = formatAuditEvent(event);
    const parsed = JSON.parse(formatted);

    expect(parsed).toEqual({
      type: "audit",
      requestId: "req-123",
      action: "create",
      statusClass: "2xx",
      durationMs: 15,
      sizeBucket: "1KB-64KB",
    });

    // Check absence of forbidden keys
    const forbiddenKeys = [
      "content",
      "ciphertext",
      "fragment",
      "url",
      "link",
      "password",
      "unlock",
      "deleteCapability",
      "token",
      "ip",
      "address",
      "filename",
      "mime",
    ];

    for (const key of forbiddenKeys) {
      expect(parsed[key]).toBeUndefined();
    }
  });

  it("calls log writer when logAuditEvent is invoked", () => {
    const writer = vi.fn();
    const event: AuditEvent = {
      requestId: "req-456",
      action: "reveal",
      statusClass: "2xx",
      durationMs: 8.2,
      sizeBucket: "<1KB",
    };

    logAuditEvent(event, writer);
    expect(writer).toHaveBeenCalledWith(expect.stringContaining('"requestId":"req-456"'));
  });
});

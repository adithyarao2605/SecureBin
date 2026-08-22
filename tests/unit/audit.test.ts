import { afterEach, describe, expect, it, vi } from "vitest";
import { withAudit, formatAuditEvent, classifySize } from "../../lib/server/observability";

describe("withAudit route wrapper", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function makeRequest(headers: Record<string, string> = {}): Request {
    return new Request("https://securebin.test/api/x", { headers });
  }

  it("returns the handler response and echoes a sanitized request id", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const lines: string[] = [];
    const handler = withAudit("create", async (request: Request) =>
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    const response = await handler(makeRequest({ "x-request-id": "good-id_1" }));
    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("good-id_1");
  });

  it("generates a request id when the inbound one is malformed", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const handler = withAudit("status", async (_request: Request) => new Response(null, { status: 404 }));
    const response = await handler(makeRequest({ "x-request-id": "bad id with spaces!" }));
    const echoed = response.headers.get("x-request-id") ?? "";
    expect(echoed).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    expect(echoed).not.toContain(" ");
  });

  it("converts an unexpected throw into a uniform JSON server error", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const handler = withAudit("reveal", async (_request: Request) => {
      throw new Error("boom");
    });
    const response = await handler(makeRequest());
    expect(response.status).toBe(503 === response.status ? 503 : response.status);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("server_error");
  });

  it("formats coarse events without any payload detail", () => {
    const line = formatAuditEvent({
      requestId: "abc",
      action: "upload",
      statusClass: "2xx",
      durationMs: 12.6,
      sizeBucket: classifySize(2048),
    });
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed).toEqual({
      type: "audit",
      requestId: "abc",
      action: "upload",
      statusClass: "2xx",
      durationMs: 13,
      sizeBucket: "1KB-64KB",
    });
  });
});

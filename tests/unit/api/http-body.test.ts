import { describe, expect, it } from "vitest";

import { readJsonBody } from "@/lib/server/http";

function jsonRequest(body: string | null, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    ...(body !== null ? { body } : {}),
    headers,
  });
}

function chunkedRequest(chunks: string[], headers: Record<string, string> = {}): Request {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request("http://localhost/api/test", {
    method: "POST",
    // @ts-expect-error duplex streaming bodies are valid at runtime
    duplex: "half",
    body: stream,
    headers,
  });
}

describe("readJsonBody", () => {
  it("parses JSON under the cap", async () => {
    const body = await readJsonBody(jsonRequest(JSON.stringify({ ok: true })), 1024);
    expect(body).toEqual({ ok: true });
  });

  it("rejects a declared content-length above the cap", async () => {
    const body = await readJsonBody(
      jsonRequest("{}", { "content-length": String(2048) }),
      1024
    );
    expect(body).toBeNull();
  });

  it("aborts an undeclared chunked body that exceeds the cap mid-stream", async () => {
    const half = Math.ceil(1024 / 2) + 1;
    const body = await readJsonBody(chunkedRequest(["a".repeat(half), "b".repeat(half)]), 1024);
    expect(body).toBeNull();
  });

  it("accepts an undeclared chunked body within the cap", async () => {
    const body = await readJsonBody(chunkedRequest([JSON.stringify({ ok: 1 })]), 1024);
    expect(body).toEqual({ ok: 1 });
  });

  it("returns null for non-JSON or empty bodies", async () => {
    expect(await readJsonBody(jsonRequest(null), 1024)).toBeNull();
    expect(await readJsonBody(jsonRequest(""), 1024)).toBeNull();
    expect(await readJsonBody(jsonRequest("{invalid"), 1024)).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";

import { createCommentHandlers, type CommentRouteDependencies } from "@/lib/server/comment-routes";
import { ShareServiceError, type ShareService } from "@/lib/server/share-service";

const publicId = "AQEBAQEBAQEBAQEBAQEBAQ";
const commentId = "11111111-1111-4111-8111-111111111111";
const digest = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";
const discussionEnvelope = {
  version: 1,
  objectType: "discussion",
  algorithm: "AES-256-GCM",
  nonce: "AAAAAAAAAAAAAAAA",
  ciphertext: "AAAAAAAAAAAAAAAAAAAAAA",
};

function dependencies(overrides: Partial<ShareService> = {}): CommentRouteDependencies {
  return {
    rateLimitHmacKey: "test-only-key",
    service: {
      consumeRateLimit: vi.fn(async () => true),
      createShare: vi.fn(),
      getStatus: vi.fn(),
      getStatusBatch: vi.fn(async () => []),
      reveal: vi.fn(),
      addComment: vi.fn(async () => ({ commentId, createdAt: "2026-08-23T00:00:00.000Z" })),
      editComment: vi.fn(async () => ({ commentId, editedAt: "2026-08-23T00:00:00.000Z" })),
      deleteComment: vi.fn(async () => true),
      listComments: vi.fn(async () => []),
      revoke: vi.fn(),
      ...overrides,
    },
  };
}

function context() {
  return { params: Promise.resolve({ publicId, commentId }) };
}

describe("discussion comment mutation routes", () => {
  it("requires an edit token when posting a comment", async () => {
    const deps = dependencies();
    const handlers = createCommentHandlers(deps);
    const response = await handlers.post(
      new Request("http://localhost/comments", {
        method: "POST",
        body: JSON.stringify({ capability: digest, bodyEnvelope: { v: 1 } }),
      }),
      context()
    );

    expect(response.status).toBe(400);
    expect(deps.service.addComment).not.toHaveBeenCalled();
  });

  it("passes PATCH ciphertext and raw capability tokens only to the service boundary", async () => {
    const deps = dependencies();
    const handlers = createCommentHandlers(deps);
    const response = await handlers.patch(
      new Request("http://localhost/comments", {
        method: "PATCH",
        body: JSON.stringify({ capability: digest, editToken: digest, bodyEnvelope: discussionEnvelope }),
      }),
      context()
    );

    expect(response.status).toBe(200);
    expect(deps.service.editComment).toHaveBeenCalledWith(publicId, commentId, {
      capability: digest,
      editToken: digest,
      bodyEnvelope: discussionEnvelope,
    });
  });

  it("returns 429 when the database rate limit rejects a mutation", async () => {
    const deps = dependencies({ deleteComment: vi.fn(async () => { throw new ShareServiceError("rate_limited"); }) });
    const handlers = createCommentHandlers(deps);
    const response = await handlers.delete(
      new Request("http://localhost/comments", {
        method: "DELETE",
        body: JSON.stringify({ capability: digest, editToken: digest }),
      }),
      context()
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
  });

  it.each([
    ["GET", "get"],
    ["POST", "post"],
    ["PATCH", "patch"],
    ["DELETE", "delete"],
  ] as const)("maps a closed discussion %s to the uniform unavailable response", async (method, handlerName) => {
    const unavailable = vi.fn(async () => { throw new ShareServiceError("unavailable"); });
    const deps = dependencies({
      listComments: unavailable,
      addComment: unavailable,
      editComment: unavailable,
      deleteComment: unavailable,
    });
    const handlers = createCommentHandlers(deps);
    const init: RequestInit = { method, headers: { "x-discussion-capability": digest } };
    if (method === "POST") init.body = JSON.stringify({ capability: digest, editToken: digest, bodyEnvelope: discussionEnvelope });
    if (method === "PATCH") init.body = JSON.stringify({ capability: digest, editToken: digest, bodyEnvelope: discussionEnvelope });
    if (method === "DELETE") init.body = JSON.stringify({ capability: digest, editToken: digest });

    const response = await handlers[handlerName](new Request("http://localhost/comments", init), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "unavailable" });
  });
});

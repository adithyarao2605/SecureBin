import { describe, expect, it } from "vitest";

import { parseShareCommentRows } from "../../lib/shares/contracts";

const envelope = {
  version: 1,
  objectType: "discussion",
  algorithm: "AES-256-GCM",
  nonce: "AAAAAAAAAAAAAAAA",
  ciphertext: "AAAAAAAAAAAAAAAAAAAAAA",
};

function comment(id = "11111111-1111-4111-8111-111111111111") {
  return {
    comment_id: id,
    parent_comment_id: null,
    body_envelope: envelope,
    nickname_envelope: null,
    created_at: "2099-01-01T00:00:00.000Z",
    edited_at: null,
  };
}

describe("share comment response contracts", () => {
  it("accepts the complete database row shape", () => {
    expect(parseShareCommentRows([comment()])).toMatchObject([{
      comment_id: "11111111-1111-4111-8111-111111111111",
      created_at: "2099-01-01T00:00:00.000Z",
    }]);
  });

  it.each([
    ["unknown fields", { ...comment(), unexpected: true }],
    ["missing edited_at", (() => { const value = comment(); delete (value as { edited_at?: unknown }).edited_at; return value; })()],
    ["invalid parent id", { ...comment(), parent_comment_id: "not-a-uuid" }],
    ["invalid envelope", { ...comment(), body_envelope: { ...envelope, ciphertext: "bad" } }],
  ])("rejects rows with %s", (_label, value) => {
    expect(parseShareCommentRows([value])).toBeNull();
  });

  it("rejects duplicate comment ids instead of rendering ambiguous state", () => {
    expect(parseShareCommentRows([comment(), comment()])).toBeNull();
  });
});

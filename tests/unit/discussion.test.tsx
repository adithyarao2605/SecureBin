import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscussionThread } from "../../app/components/discussion-thread";
import { deriveDiscussionKey, openDiscussionText, sealDiscussionText } from "../../lib/crypto/discussion";
import { bytesToBase64Url } from "../../lib/crypto/encoding";

const capability = new Uint8Array(32).fill(0x33);
const hkdfSalt = new Uint8Array(16).fill(0x44);
const threadProps = {
  publicId: bytesToBase64Url(new Uint8Array(16).fill(0x11)),
  capability,
  hkdfSalt,
  mask: "link" as const,
};

const topLevelId = "11111111-1111-4111-8111-111111111111";

let key: CryptoKey;

async function commentsResponse(): Promise<Response> {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      comments: [
        {
          comment_id: topLevelId,
          parent_comment_id: null,
          body_envelope: await sealDiscussionText(key, "First sealed note"),
          nickname_envelope: await sealDiscussionText(key, "Ada"),
          created_at: "2026-08-20T10:00:00.000Z",
        },
        {
          comment_id: "22222222-2222-4222-8222-222222222222",
          parent_comment_id: null,
          body_envelope: await sealDiscussionText(key, "Second sealed note"),
          nickname_envelope: null,
          created_at: "2026-08-20T11:00:00.000Z",
          edited_at: "2026-08-20T11:30:00.000Z",
        },
        {
          comment_id: "44444444-4444-4444-8444-444444444444",
          parent_comment_id: "55555555-5555-4555-8555-555555555555",
          body_envelope: await sealDiscussionText(key, "Orphaned reply"),
          nickname_envelope: null,
          created_at: "2026-08-20T12:00:00.000Z",
          edited_at: null,
        },
      ],
    }),
  } as unknown as Response;
}

describe("DiscussionThread", () => {
  beforeAll(async () => {
    key = await deriveDiscussionKey(threadProps);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ commentId: "33333333-3333-4333-8333-333333333333", createdAt: "2026-08-20T12:00:00.000Z" }),
        } as unknown as Response);
      }
      if (url.includes("/comments")) {
        return Promise.resolve(commentsResponse());
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }));
  });

  it("decrypts and renders sealed comments with nicknames", async () => {
    render(<DiscussionThread {...threadProps} />);

    expect(await screen.findByText("First sealed note")).toBeInTheDocument();
    expect(screen.getByText("Second sealed note")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getAllByText("Anonymous")).toHaveLength(2);
    expect(screen.getByText("Comment deleted")).toBeInTheDocument();
    expect(screen.getByText("(edited)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Encrypted discussion" })).toBeInTheDocument();
    expect(
      screen.getByText(/Comments are encrypted locally; the server stores opaque ciphertext/)
    ).toBeInTheDocument();

    const [getUrl, getInit] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(getUrl).not.toContain("capability=");
    expect((getInit.headers as Record<string, string>)["x-discussion-capability"]).toBe(
      bytesToBase64Url(capability)
    );
  });

  it("posts a sealed reply bound to the capability and refetches", async () => {
    render(<DiscussionThread {...threadProps} />);
    await screen.findByText("First sealed note");

    fireEvent.click(screen.getAllByRole("button", { name: "Reply" })[0]);
    fireEvent.change(screen.getByLabelText("Reply"), {
      target: { value: "A sealed reply" },
    });
    fireEvent.change(screen.getByLabelText("Nickname (optional)"), {
      target: { value: "Grace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Post" })).toBeEnabled()
    );
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThanOrEqual(3));

    const [, postInit] = vi.mocked(fetch).mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST"
    ) as [string, RequestInit];
    const payload = JSON.parse(String(postInit.body)) as {
      capability: unknown;
      parentCommentId: unknown;
      bodyEnvelope: unknown;
      nicknameEnvelope: unknown;
      editToken: unknown;
    };

    expect(payload.capability).toBe(bytesToBase64Url(capability));
    expect(payload.editToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(payload.parentCommentId).toBe(topLevelId);
    await expect(openDiscussionText(key, payload.bodyEnvelope)).resolves.toBe("A sealed reply");
    await expect(openDiscussionText(key, payload.nicknameEnvelope)).resolves.toBe("Grace");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

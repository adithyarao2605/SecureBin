import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "../../app/components/composer";

type JsonRecord = Record<string, unknown>;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function callsTo(fetchMock: ReturnType<typeof vi.fn>, path: string): JsonRecord[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).includes(path))
    .map((call) => JSON.parse((call[1] as { body: string }).body) as JsonRecord);
}

describe("composer staged creation flow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects drafts above the UTF-8 byte budget before any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Composer />);

    const textarea = screen.getByLabelText("Note content") as HTMLTextAreaElement;
    // ~560k UTF-8 bytes via astral characters while staying small in UTF-16
    // code units - exactly the mismatch the old char maxLength allowed.
    const oversize = "\u{1F680}".repeat(140_000);
    fireEvent.change(textarea, { target: { value: oversize } });
    fireEvent.click(screen.getByRole("button", { name: "Create share" }));

    expect(await screen.findByText(/Content is too large for one share/u)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reuses the identical idempotency hash when a failed create is retried", async () => {
    let createCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/uploads")) {
        return Promise.resolve(jsonResponse(201, {
          uploadUrl:
            "http://127.0.0.1:54321/storage/v1/object/upload/sign/securebin-files/objects/" +
            "a".repeat(48) +
            ".bin?token=x",
          token: "t",
          expiresAt: new Date(Date.now() + 900_000).toISOString(),
        }));
      }
      if (url.includes("/storage/")) {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      if (url.includes("/api/shares")) {
        createCalls += 1;
        if (createCalls === 1) return Promise.resolve(jsonResponse(503, { error: "server_error" }));
        return Promise.resolve(jsonResponse(201, { publicId: "AQEBAQEBAQEBAQEBAQEBAQ", created: true }));
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Composer />);

    fireEvent.change(screen.getByLabelText("Note content"), { target: { value: "composer flow probe" } });
    fireEvent.change(screen.getByLabelText("Attach file (max 10 MB)"), {
      target: {
        files: [new File([new Uint8Array([1, 2, 3, 4])], "probe.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create share" }));
    await screen.findByText(/This share could not be created/u);
    fireEvent.click(screen.getByRole("button", { name: "Create share" }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Share link" })).toBeVisible());
    expect(createCalls).toBe(2);

    const uploads = callsTo(fetchMock, "/api/uploads");
    expect(uploads.length).toBe(1);
    const creates = callsTo(fetchMock, "/api/shares");
    expect(creates.length).toBe(2);
    expect(creates[0].idempotencyKeyHash).toBe(creates[1].idempotencyKeyHash);
    expect(creates[0].publicId).toBe(creates[1].publicId);
  });
});

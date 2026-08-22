import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openContent } from "../../lib/crypto/content";
import { bytesToBase64Url } from "../../lib/crypto/encoding";
import { Viewer } from "../../app/s/[publicId]/viewer";

vi.mock("../../lib/crypto/content", () => ({
  openContent: vi.fn(),
}));

const mockedOpenContent = vi.mocked(openContent);
const publicId = bytesToBase64Url(new Uint8Array(16).fill(0x11));
const alternatePublicId = bytesToBase64Url(new Uint8Array(16).fill(0x12));
const linkSecret = bytesToBase64Url(new Uint8Array(32).fill(0x22));
const envelope = {
  version: 1 as const,
  objectType: "content" as const,
  algorithm: "AES-256-GCM" as const,
  nonce: "MzMzMzMzMzMzMzMz",
  hkdfSalt: "RERERERERERERERERERERA",
  passwordSalt: null,
  kdf: "none" as const,
  kdfParameters: {},
  factorMask: "link" as const,
  ciphertext: "0JTiqnlQ9k8q5GuExNrVabO8qMGv3Hr-OaWLaUQ",
};

function response(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: body instanceof Error ? vi.fn().mockRejectedValue(body) : vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function activeStatusResponse(): Response {
  return response(200, {
    status: "active",
    availableAt: null,
    expiresAt: "2099-01-01T00:00:00.000Z",
    maxReveals: null,
    remainingReveals: null,
    passwordRequired: false,
    unlockRequired: false,
  });
}

// The viewer now issues a quiet /status refresh after failed reveal
// attempts, so mocks route by URL instead of strict call order.
function routedFetchMock(opts: {
  statusResponse?: () => Response;
  firstReveal: () => Promise<Response>;
  laterReveals?: () => Response;
}) {
  let revealCount = 0;
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/status")) {
      return Promise.resolve((opts.statusResponse ?? activeStatusResponse)());
    }
    revealCount += 1;
    if (revealCount === 1) return opts.firstReveal();
    return Promise.resolve((opts.laterReveals ?? authorizedResponse)());
  });
}

function revealCalls(fetchMock: ReturnType<typeof vi.fn>): Array<unknown> {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).includes("/reveal"))
    .map((call) => (call[1] as { body?: unknown })?.body);
}

function authorizedResponse(): Response {
  return response(200, {
    status: "authorized",
    retryExpiresAt: "2099-01-01T00:05:00.000Z",
    contentEnvelope: envelope,
  });
}

const retryFailures: Array<[string, () => Promise<Response>]> = [
  ["aborted", () => Promise.reject(new DOMException("The request was aborted.", "AbortError"))],
  ["network", () => Promise.reject(new TypeError("Failed to fetch"))],
  ["timeout", () => Promise.reject(new DOMException("The request timed out.", "TimeoutError"))],
  ["503", () => Promise.resolve(response(503))],
  ["malformed JSON", () => Promise.resolve(response(200, new SyntaxError("Unexpected end of JSON input")))],
  ["malformed authorized payload", () => Promise.resolve(response(200, { status: "authorized" }))],
];

async function renderReady(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  window.location.hash = `#${linkSecret}`;
  render(<Viewer publicId={publicId} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Reveal" })).toBeVisible());
}

describe("viewer reveal retry token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedOpenContent.mockResolvedValue({ mode: "note", text: "opened locally" });
  });

  it.each(retryFailures)("reuses the byte-identical token after %s", async (_failure, failure) => {
    const fetchMock = routedFetchMock({ firstReveal: failure });
    await renderReady(fetchMock);

    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Reveal" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    await waitFor(() => expect(screen.getByText("opened locally")).toBeVisible());

    const bodies = revealCalls(fetchMock);
    expect(bodies.length).toBe(2);
    expect(bodies[0]).toBe(bodies[1]);
  });

  it("reuses the token after local decryption uncertainty", async () => {
    mockedOpenContent.mockRejectedValueOnce(new Error("decryption interrupted"));
    const fetchMock = routedFetchMock({ firstReveal: () => Promise.resolve(authorizedResponse()) });
    await renderReady(fetchMock);

    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Reveal" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    await waitFor(() => expect(screen.getByText("opened locally")).toBeVisible());

    const bodies = revealCalls(fetchMock);
    expect(bodies.length).toBe(2);
    expect(bodies[0]).toBe(bodies[1]);
  });

  it("blocks duplicate pending requests", async () => {
    let releaseReveal: ((value: Response) => void) | undefined;
    const revealResponse = new Promise<Response>((resolve) => {
      releaseReveal = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(activeStatusResponse())
      .mockReturnValueOnce(revealResponse)
      .mockResolvedValueOnce(authorizedResponse());
    await renderReady(fetchMock);

    const revealButton = screen.getByRole("button", { name: "Reveal" });
    fireEvent.click(revealButton);
    fireEvent.click(revealButton);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    releaseReveal?.(authorizedResponse());
    await waitFor(() => expect(screen.getByText("opened locally")).toBeVisible());
  });

  it("clears the token only after 404 unavailable or successful decryption", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(activeStatusResponse())
      .mockResolvedValueOnce(response(404, { status: "unavailable" }))
      .mockResolvedValueOnce(activeStatusResponse())
      .mockResolvedValueOnce(authorizedResponse())
      .mockResolvedValueOnce(activeStatusResponse())
      .mockResolvedValueOnce(authorizedResponse());
    await renderReady(fetchMock);

    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    await waitFor(() => expect(screen.getByText(/no longer available/)).toBeVisible());
    const unavailableToken = fetchMock.mock.calls[1]?.[1]?.body;

    window.location.hash = `#${linkSecret}`;
    render(<Viewer publicId={alternatePublicId} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Reveal" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    await waitFor(() => expect(screen.getByText("opened locally")).toBeVisible());
    const openedToken = fetchMock.mock.calls[3]?.[1]?.body;
    expect(openedToken).not.toBe(unavailableToken);

    render(<Viewer publicId={publicId} />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Reveal" })[0]).toBeVisible());
    fireEvent.click(screen.getAllByRole("button", { name: "Reveal" })[0]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
    expect(fetchMock.mock.calls[5]?.[1]?.body).not.toBe(openedToken);
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareHistoryDesk } from "../../app/components/share-history";
import { clearShareHistory, saveShareToHistory, type ShareHistoryItem } from "../../lib/shares/share-history";

class StorageMock implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const sample: ShareHistoryItem = {
  publicId: "sample-public-id",
  shareUrl: "https://example.test/s/sample-public-id#local-secret",
  createdAt: "2026-08-21T12:00:00.000Z",
  expiresAt: "2026-09-21T12:00:00.000Z",
  availableAt: null,
  maxReveals: 3,
  deleteCapability: "delete-capability",
  label: "Design notes",
};

describe("local share management", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", { configurable: true, value: new StorageMock() });
    clearShareHistory();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));
  });

  afterEach(() => {
    clearShareHistory();
    vi.unstubAllGlobals();
  });

  it("requires confirmation and distinguishes local removal from revocation", async () => {
    saveShareToHistory(sample);
    render(<ShareHistoryDesk />);

    fireEvent.click(await screen.findByRole("button", { name: /Remove share/u }));
    expect(screen.getByText(/Remove only from local history/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Remove$/u }));
    expect(await screen.findByText(/still available to anyone with its link/u)).toBeInTheDocument();
  });

  it("requires confirmation before server revocation", async () => {
    saveShareToHistory(sample);
    render(<ShareHistoryDesk />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    expect(screen.getByText(/Stop future releases/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/u }));
  });

  it("requires confirmation before clearing local history", async () => {
    saveShareToHistory(sample);
    render(<ShareHistoryDesk />);
    fireEvent.click(await screen.findByRole("button", { name: "Clear history" }));
    expect(screen.getByText(/Clear local history\?/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/u }));
    expect(screen.getByRole("button", { name: "Clear history" })).toBeInTheDocument();
  });

  it("shows a manual-copy fallback when clipboard access fails", async () => {
    saveShareToHistory(sample);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<ShareHistoryDesk />);

    fireEvent.click(await screen.findByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("textbox", { name: /Manual copy link/u })).toHaveValue(sample.shareUrl);
    expect(screen.getByText(/Clipboard access is unavailable/u)).toBeInTheDocument();
  });

  it("filters local rows and keeps an explicit Open action", async () => {
    saveShareToHistory(sample);
    saveShareToHistory({ ...sample, publicId: "other-public-id", label: "Release brief", shareUrl: "https://example.test/s/other-public-id#key" });
    render(<ShareHistoryDesk />);

    const search = await screen.findByRole("searchbox", { name: "Search shares" });
    fireEvent.change(search, { target: { value: "release brief" } });
    expect(screen.getByText("other-public-id")).toBeInTheDocument();
    expect(screen.queryByText("sample-public-id")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", expect.stringContaining("other-public-id"));
  });

  it("announces revoke failures after confirmation", async () => {
    saveShareToHistory(sample);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))));
    render(<ShareHistoryDesk />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));
    await waitFor(() => expect(screen.getByText(/could not be revoked/u)).toBeInTheDocument());
  });
});

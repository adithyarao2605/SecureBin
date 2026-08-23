import { beforeEach, describe, expect, it } from "vitest";
import {
  clearShareHistory,
  loadShareHistory,
  mergeShareStatuses,
  removeShareFromHistory,
  saveShareToHistory,
  updateShareInHistory,
  type ShareHistoryItem,
} from "../../lib/shares/share-history";

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe("Browser-local Share History Manager", () => {
  beforeEach(() => {
    const mock = new MockStorage();
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: mock,
      },
      writable: true,
      configurable: true,
    });
  });

  const sampleItem: ShareHistoryItem = {
    publicId: "sample-pub-123456789012",
    shareUrl: "https://example.com/s/sample-pub-123456789012#secret-key-123",
    createdAt: "2026-08-21T12:00:00.000Z",
    expiresAt: "2026-08-22T12:00:00.000Z",
    availableAt: null,
    maxReveals: 3,
    deleteCapability: "del-cap-123",
    noteSnippet: "Secret note preview...",
  };

  it("saves and loads history items cleanly", () => {
    expect(loadShareHistory()).toEqual([]);
    saveShareToHistory(sampleItem);

    const loaded = loadShareHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].publicId).toBe(sampleItem.publicId);
    expect(loaded[0].maxReveals).toBe(3);
    expect(loaded[0].noteSnippet).toBe("Secret note preview...");
  });

  it("deduplicates by publicId and puts newest first", () => {
    saveShareToHistory(sampleItem);
    saveShareToHistory({
      ...sampleItem,
      publicId: "item-2",
      shareUrl: "https://example.com/s/item-2#sec",
    });
    saveShareToHistory(sampleItem); // Re-add item 1

    const loaded = loadShareHistory();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].publicId).toBe(sampleItem.publicId);
    expect(loaded[1].publicId).toBe("item-2");
  });

  it("updates existing items in place", () => {
    saveShareToHistory(sampleItem);
    updateShareInHistory(sampleItem.publicId, {
      status: "active",
      remainingReveals: 2,
    });

    const loaded = loadShareHistory();
    expect(loaded[0].status).toBe("active");
    expect(loaded[0].remainingReveals).toBe(2);
  });

  it("removes individual items and clears all", () => {
    saveShareToHistory(sampleItem);
    saveShareToHistory({
      ...sampleItem,
      publicId: "item-2",
      shareUrl: "https://example.com/s/item-2#sec",
    });

    removeShareFromHistory(sampleItem.publicId);
    expect(loadShareHistory()).toHaveLength(1);
    expect(loadShareHistory()[0].publicId).toBe("item-2");

    clearShareHistory();
    expect(loadShareHistory()).toEqual([]);
  });

  it("merges batch status while preserving local capabilities", () => {
    saveShareToHistory(sampleItem);
    const merged = mergeShareStatuses([{
      publicId: sampleItem.publicId,
      status: {
        status: "active",
        availableAt: null,
        expiresAt: sampleItem.expiresAt,
        passwordRequired: false,
        unlockRequired: false,
        maxReveals: 3,
        remainingReveals: 1,
      },
    }]);

    expect(merged[0]).toMatchObject({ status: "active", remainingReveals: 1, deleteCapability: sampleItem.deleteCapability });
    expect(loadShareHistory()[0]?.deleteCapability).toBe(sampleItem.deleteCapability);
  });
});

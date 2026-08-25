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
  const publicId = "AQEBAQEBAQEBAQEBAQEBAQ";
  const otherPublicId = "AgICAgICAgICAgICAgICAg";
  const fragment = "A".repeat(43);
  const deleteCapability = "A".repeat(43);

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
    publicId,
    shareUrl: `http://localhost:3000/s/${publicId}#${fragment}`,
    createdAt: "2026-08-21T12:00:00.000Z",
    expiresAt: "2026-08-22T12:00:00.000Z",
    availableAt: null,
    maxReveals: 3,
    deleteCapability,
  };

  it("saves and loads history items cleanly", () => {
    expect(loadShareHistory()).toEqual([]);
    saveShareToHistory(sampleItem);

    const loaded = loadShareHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].publicId).toBe(sampleItem.publicId);
    expect(loaded[0].maxReveals).toBe(3);
    expect(loaded[0]).not.toHaveProperty("noteSnippet");
  });

  it("deduplicates by publicId and puts newest first", () => {
    saveShareToHistory(sampleItem);
    saveShareToHistory({
      ...sampleItem,
      publicId: otherPublicId,
      shareUrl: `http://localhost:3000/s/${otherPublicId}#${fragment}`,
    });
    saveShareToHistory(sampleItem); // Re-add item 1

    const loaded = loadShareHistory();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].publicId).toBe(sampleItem.publicId);
    expect(loaded[1].publicId).toBe(otherPublicId);
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
      publicId: otherPublicId,
      shareUrl: `http://localhost:3000/s/${otherPublicId}#${fragment}`,
    });

    removeShareFromHistory(sampleItem.publicId);
    expect(loadShareHistory()).toHaveLength(1);
    expect(loadShareHistory()[0].publicId).toBe(otherPublicId);

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

  it("preserves a sender-local revoked label over the recipient unavailable state", () => {
    saveShareToHistory({ ...sampleItem, status: "revoked", deleteCapability: null });
    const merged = mergeShareStatuses([{
      publicId: sampleItem.publicId,
      status: {
        status: "unavailable",
      },
    }]);

    expect(merged[0]?.status).toBe("revoked");
    expect(merged[0]?.remainingReveals).toBeNull();
  });

  it("rejects tampered or cross-origin local records", () => {
    const storage = window.localStorage;
    storage.setItem("securebin_share_history_v1", JSON.stringify([
      { ...sampleItem, shareUrl: "javascript:alert(1)" },
      { ...sampleItem, shareUrl: "https://other.example/s/AQEBAQEBAQEBAQEBAQEBAQ#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
    ]));

    expect(loadShareHistory()).toEqual([]);
  });
});

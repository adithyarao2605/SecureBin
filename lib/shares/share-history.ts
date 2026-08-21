/**
 * Browser-local Share History Manager
 *
 * Stores references to shares created on this device in localStorage.
 * Keeps zero-knowledge security intact: content keys remain in fragment URLs
 * and all queries use public IDs.
 */

export interface ShareHistoryItem {
  readonly publicId: string;
  readonly shareUrl: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly availableAt: string | null;
  readonly maxReveals: number | null;
  readonly deleteCapability: string | null;
  readonly noteSnippet?: string;
  status?: "active" | "scheduled" | "unavailable" | "checking" | "revoked";
  remainingReveals?: number | null;
}

const STORAGE_KEY = "securebin_share_history_v1";
const MAX_HISTORY_ITEMS = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseHistoryItem(item: unknown): ShareHistoryItem | null {
  if (!isRecord(item)) return null;
  if (
    typeof item.publicId !== "string" ||
    typeof item.shareUrl !== "string" ||
    typeof item.createdAt !== "string" ||
    typeof item.expiresAt !== "string"
  ) {
    return null;
  }

  return {
    publicId: item.publicId,
    shareUrl: item.shareUrl,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    availableAt: typeof item.availableAt === "string" ? item.availableAt : null,
    maxReveals: typeof item.maxReveals === "number" ? item.maxReveals : null,
    deleteCapability: typeof item.deleteCapability === "string" ? item.deleteCapability : null,
    noteSnippet: typeof item.noteSnippet === "string" ? item.noteSnippet : undefined,
    status: typeof item.status === "string" ? (item.status as ShareHistoryItem["status"]) : undefined,
    remainingReveals: typeof item.remainingReveals === "number" ? item.remainingReveals : null,
  };
}

export function loadShareHistory(): ShareHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: ShareHistoryItem[] = [];
    for (const item of parsed) {
      const validItem = parseHistoryItem(item);
      if (validItem) valid: valid.push(validItem);
    }
    return valid;
  } catch {
    return [];
  }
}

export function saveShareToHistory(item: ShareHistoryItem): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadShareHistory();
    const filtered = current.filter((existing) => existing.publicId !== item.publicId);
    const updated = [item, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // LocalStorage quota or access denied - silently handle
  }
}

export function updateShareInHistory(
  publicId: string,
  updates: Partial<ShareHistoryItem>
): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadShareHistory();
    const updated = current.map((item) => {
      if (item.publicId === publicId) {
        return { ...item, ...updates };
      }
      return item;
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silently handle
  }
}

export function removeShareFromHistory(publicId: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadShareHistory();
    const filtered = current.filter((item) => item.publicId !== publicId);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // Silently handle
  }
}

export function clearShareHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently handle
  }
}

/**
 * Browser-local Share History Manager
 *
 * Stores references to shares created on this device in localStorage.
 * Keeps zero-knowledge security intact: content keys remain in fragment URLs
 * and all queries use public IDs.
 */

import { base64UrlToBytes, bytesToBase64Url } from "../crypto/encoding";
import { validatePublicId } from "../crypto/envelope";
import { isMaxReveals, type MaxReveals, type ShareStatusBatchItem } from "./contracts";

export interface ShareHistoryItem {
  readonly publicId: string;
  readonly shareUrl: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly availableAt: string | null;
  readonly maxReveals: MaxReveals;
  readonly deleteCapability: string | null;
  /** Sender-assigned device-local label (never uploaded). */
  readonly label?: string;
  readonly revealWindowSeconds?: number | null;
  status?: "active" | "scheduled" | "unavailable" | "checking" | "revoked";
  remainingReveals?: number | null;
}

const STORAGE_KEY = "securebin_share_history_v1";
const MAX_HISTORY_ITEMS = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHistoryStatus(value: unknown): value is NonNullable<ShareHistoryItem["status"]> {
  return value === "active" || value === "scheduled" || value === "unavailable" || value === "checking" || value === "revoked";
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isCanonicalBase64Url(value: unknown, expectedBytes: number): value is string {
  if (typeof value !== "string") return false;
  try {
    const bytes = base64UrlToBytes(value);
    return bytes.length === expectedBytes && bytesToBase64Url(bytes) === value;
  } catch {
    return false;
  }
}

function isValidShareUrl(publicId: string, shareUrl: string): boolean {
  try {
    const parsed = new URL(shareUrl);
    const currentOrigin = typeof globalThis.location?.origin === "string" ? globalThis.location.origin : null;
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || (currentOrigin && parsed.origin !== currentOrigin)) {
      return false;
    }
    if (parsed.pathname !== `/s/${encodeURIComponent(publicId)}` || parsed.search || !isCanonicalBase64Url(parsed.hash.slice(1), 32)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function parseHistoryItem(item: unknown): ShareHistoryItem | null {
  if (!isRecord(item)) return null;
  if (
    typeof item.publicId !== "string" ||
    typeof item.shareUrl !== "string" ||
    !isIsoDate(item.createdAt) ||
    (typeof item.expiresAt !== "string" && item.expiresAt !== null)
  ) {
    return null;
  }
  try {
    validatePublicId(item.publicId);
  } catch {
    return null;
  }
  if (!isValidShareUrl(item.publicId, item.shareUrl) || !isMaxReveals(item.maxReveals)) return null;
  if (item.expiresAt !== null && !isIsoDate(item.expiresAt)) return null;
  if (item.availableAt !== null && item.availableAt !== undefined && !isIsoDate(item.availableAt)) return null;
  if (item.deleteCapability !== null && item.deleteCapability !== undefined && !isCanonicalBase64Url(item.deleteCapability, 32)) return null;
  if (item.label !== undefined && (typeof item.label !== "string" || item.label.length > 80)) return null;
  if (
    item.revealWindowSeconds !== undefined &&
    item.revealWindowSeconds !== null &&
    (typeof item.revealWindowSeconds !== "number" || !Number.isInteger(item.revealWindowSeconds) || item.revealWindowSeconds < 10 || item.revealWindowSeconds > 86_400)
  ) return null;
  if (
    item.remainingReveals !== undefined &&
    item.remainingReveals !== null &&
    (typeof item.remainingReveals !== "number" || !Number.isInteger(item.remainingReveals) || item.remainingReveals < 0)
  ) return null;

  return {
    publicId: item.publicId,
    shareUrl: item.shareUrl,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    availableAt: typeof item.availableAt === "string" ? item.availableAt : null,
    maxReveals: item.maxReveals,
    deleteCapability: typeof item.deleteCapability === "string" ? item.deleteCapability : null,
    label: typeof item.label === "string" ? item.label : undefined,
    revealWindowSeconds:
      typeof item.revealWindowSeconds === "number" || item.revealWindowSeconds === null
        ? item.revealWindowSeconds
        : undefined,
    status: isHistoryStatus(item.status) ? item.status : undefined,
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
      if (validItem) valid.push(validItem);
    }
    return valid;
  } catch {
    return [];
  }
}

export function saveShareToHistory(item: ShareHistoryItem): void {
  if (typeof window === "undefined") return;
  try {
    if (!parseHistoryItem(item)) return;
    const current = loadShareHistory();
    const filtered = current.filter((existing) => existing.publicId !== item.publicId);
    const updated = [item, ...filtered].map(parseHistoryItem).filter((entry): entry is ShareHistoryItem => entry !== null).slice(0, MAX_HISTORY_ITEMS);
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
    }).map(parseHistoryItem).filter((item): item is ShareHistoryItem => item !== null);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silently handle
  }
}

export function mergeShareStatuses(statuses: readonly ShareStatusBatchItem[]): ShareHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const current = loadShareHistory();
    const byPublicId = new Map(statuses.map((entry) => [entry.publicId, entry.status]));
    const updated = current.map((item) => {
      const status = byPublicId.get(item.publicId);
      if (!status) return item;
      // The server deliberately exposes revoked shares as uniformly
      // unavailable to recipients. Preserve the sender's local distinction so
      // the history desk can keep the revoke result and its follow-up action.
      const mergedStatus: ShareHistoryItem["status"] = item.status === "revoked" ? "revoked" : status.status;
      return {
        ...item,
        status: mergedStatus,
        remainingReveals: status.status === "unavailable" ? null : status.remainingReveals,
      };
    }).map(parseHistoryItem).filter((item): item is ShareHistoryItem => item !== null);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return loadShareHistory();
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

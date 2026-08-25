"use client";

import { useEffect, useRef, useState } from "react";
import {
  clearShareHistory,
  loadShareHistory,
  mergeShareStatuses,
  removeShareFromHistory,
  updateShareInHistory,
  type ShareHistoryItem,
} from "../../lib/shares/share-history";
import { parseStatusBatchResponse } from "../../lib/shares/contracts";
import { formatLocalizedDateTime } from "../../lib/shares/policy-ui";

export interface ShareHistoryDeskProps {
  readonly refreshSignal?: number;
  readonly visible?: boolean;
  readonly onSwitchToCreate?: () => void;
  readonly onRevokedShareRemoved?: () => void;
}

export function ShareHistoryDesk({
  refreshSignal,
  visible = true,
  onSwitchToCreate,
  onRevokedShareRemoved,
}: ShareHistoryDeskProps) {
  const [history, setHistory] = useState<ShareHistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [clipboardFallbackId, setClipboardFallbackId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "scheduled" | "expired" | "revoked">("all");
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const refreshInFlight = useRef(false);

  useEffect(() => {
    setMounted(true);
    setHistory(loadShareHistory());
  }, []);

  async function refreshStatuses() {
    if (refreshInFlight.current) return;
    const items = loadShareHistory();
    setHistory(items);
    if (items.length === 0) return;
    refreshInFlight.current = true;
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/shares/status-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicIds: items.map((item) => item.publicId) }),
        cache: "no-store",
      });
      if (!response.ok) return;
      const statuses = parseStatusBatchResponse(await response.json());
      if (statuses) setHistory(mergeShareStatuses(statuses));
    } catch {
      // Keep the last known local status on network or payload errors.
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
      setLastRefreshedAt(new Date());
    }
  }

  useEffect(() => {
    if (visible) void refreshStatuses();
  }, [visible]);

  useEffect(() => {
    if (visible && refreshSignal !== undefined && refreshSignal > 0) void refreshStatuses();
  }, [refreshSignal, visible]);

  useEffect(() => {
    function handleFocus() {
      if (visible) void refreshStatuses();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [visible]);

  async function handleCopy(item: ShareHistoryItem) {
    try {
      if (!navigator.clipboard) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(item.shareUrl);
      setCopiedId(item.publicId);
      setClipboardFallbackId(null);
      setFeedback("Link copied.");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
      setClipboardFallbackId(item.publicId);
      setFeedback("Clipboard access is unavailable. Select the link and copy it manually.");
    }
  }

  async function handleRevoke(item: ShareHistoryItem) {
    if (!item.deleteCapability || revokingId === item.publicId) return;
    setRevokingId(item.publicId);
    try {
      const response = await fetch(`/api/shares/${encodeURIComponent(item.publicId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteCapability: item.deleteCapability }),
      });

      if (response.ok) {
        updateShareInHistory(item.publicId, { status: "revoked", deleteCapability: null });
        setHistory(loadShareHistory());
        setRevokeConfirmId(null);
        setFeedback("Share revoked. Future ciphertext releases are unavailable.");
        void refreshStatuses();
      } else {
        setFeedback("The share could not be revoked. Try again.");
      }
    } catch {
      setFeedback("The share could not be revoked. Check your connection and try again.");
    } finally {
      setRevokingId(null);
    }
  }

  function handleRemove(item: ShareHistoryItem) {
    removeShareFromHistory(item.publicId);
    setHistory(loadShareHistory());
    setRemoveConfirmId(null);
    setFeedback("Removed from this browser's local history. The share is still available to anyone with its link.");
    if (item.status === "revoked") {
      if (onRevokedShareRemoved) onRevokedShareRemoved();
      else window.location.reload();
    }
  }

  function handleClearAll() {
    clearShareHistory();
    setHistory([]);
    setClearConfirm(false);
    setFeedback("Local history cleared. Existing shares were not revoked.");
  }

  if (!mounted) {
    return null;
  }

  if (history.length === 0) {
    return (
      <div className="surface-card history-empty-card" role="region" aria-label="No shares in history">
        <div className="history-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="history-eyebrow">Local index · 0 shares</p>
        <h2 className="surface-heading" id="history-heading">No shares created yet</h2>
        <p className="history-empty-text">
          Stored only in this browser. Shares created here will appear after you create one; no account is required.
        </p>
        {feedback && <p className="history-feedback" role="status" aria-live="polite">{feedback}</p>}
        {onSwitchToCreate && (
          <button
            type="button"
            className="action-button primary-button"
            onClick={onSwitchToCreate}
          >
            Create a share
          </button>
        )}
      </div>
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const statusCounts = {
    active: 0,
    scheduled: 0,
    expired: 0,
    revoked: 0,
  };
  for (const item of history) {
    const expired = item.expiresAt !== null && new Date(item.expiresAt).getTime() < Date.now();
    const status = item.status ?? (expired ? "unavailable" : "active");
    if (status === "active") statusCounts.active += 1;
    if (status === "scheduled") statusCounts.scheduled += 1;
    if (status === "revoked") statusCounts.revoked += 1;
    if (status === "unavailable") statusCounts.expired += 1;
  }
  const filteredHistory = history.filter((item) => {
    const expired = item.expiresAt !== null && new Date(item.expiresAt).getTime() < Date.now();
    const status = item.status ?? (expired ? "unavailable" : "active");
    const matchesFilter =
      filter === "all" ||
      (filter === "expired" ? status === "unavailable" : status === filter);
    const searchable = `${item.label ?? ""} ${item.publicId}`.toLowerCase();
    return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
  });

  return (
    <section className="history-section" aria-labelledby="history-heading">
      <div className="history-header">
        <div>
          <p className="history-eyebrow">Local management · {history.length} {history.length === 1 ? "share" : "shares"}</p>
          <h2 id="history-heading" className="history-heading">My shares</h2>
          <p className="history-sub">
            Stored only in this browser. Shares created here can be managed without an account.
          </p>
        </div>
        <div className="history-header-actions">
          {isRefreshing && <p className="history-refreshing" role="status" aria-live="polite">Refreshing</p>}
          {lastRefreshedAt && <span className="history-last-refresh">Updated {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button type="button" className="history-refresh-btn" onClick={() => void refreshStatuses()} disabled={isRefreshing}>Refresh status</button>
          {!clearConfirm ? (
            <button type="button" className="history-clear-btn" onClick={() => setClearConfirm(true)} title="Clear all local history">
              Clear history
            </button>
          ) : (
            <div className="history-confirm history-confirm-clear" role="alert">
              <span>Clear local history? This will not revoke shares.</span>
              <button type="button" className="history-confirm-btn danger" onClick={handleClearAll}>Clear</button>
              <button type="button" className="history-confirm-btn" onClick={() => setClearConfirm(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      <div className="history-controls" role="group" aria-label="Filter local shares">
        <label className="history-search-label" htmlFor="history-search">Search shares</label>
        <input id="history-search" className="history-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search label or ID" />
        <label className="history-filter-label" htmlFor="history-filter">Status</label>
        <select id="history-filter" className="history-filter" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">All ({history.length})</option>
          <option value="active">Active ({statusCounts.active})</option>
          <option value="scheduled">Scheduled ({statusCounts.scheduled})</option>
          <option value="expired">Expired ({statusCounts.expired})</option>
          <option value="revoked">Revoked ({statusCounts.revoked})</option>
        </select>
      </div>

      {feedback && <p className="history-feedback" role="status" aria-live="polite">{feedback}</p>}

      <div className="history-list" role="list">
        {filteredHistory.map((item) => {
          const isExpired = item.expiresAt !== null && new Date(item.expiresAt).getTime() < Date.now();
          const displayStatus = item.status ?? (isExpired ? "unavailable" : "active");

          return (
            <article key={item.publicId} className="history-card" role="listitem">
              <div className="history-card-main">
                <div className="history-badges-row">
                  <span className={`history-status-badge badge-${displayStatus}`}>
                    {displayStatus === "active" && "● Active"}
                    {displayStatus === "scheduled" && "⏱ Scheduled"}
                    {displayStatus === "checking" && "↻ Checking"}
                    {displayStatus === "unavailable" && "✕ Unavailable / Expired"}
                    {displayStatus === "revoked" && "⊘ Revoked"}
                  </span>

                  <span className="history-reveals-tag">
                    {item.maxReveals === null
                      ? "Unlimited reveals"
                      : item.remainingReveals !== undefined && item.remainingReveals !== null
                      ? `${item.remainingReveals} / ${item.maxReveals} reveals remaining`
                      : item.maxReveals === 1
                      ? "One-time reveal"
                      : `${item.maxReveals} reveals limit`}
                  </span>
                </div>

                <div className="history-meta-row">
                  <span className="history-date">
                    Created {formatLocalizedDateTime(item.createdAt)}
                  </span>
                  <span className="history-expiry">
                    Expires {formatLocalizedDateTime(item.expiresAt)}
                  </span>
                </div>

                <div className="history-label-row">
                  <label htmlFor={`history-label-${item.publicId}`} className="sr-only">
                    Local label for {item.publicId}
                  </label>
                  <input
                    id={`history-label-${item.publicId}`}
                    type="text"
                    className="history-label-input"
                    placeholder="Add a local label…"
                    maxLength={80}
                    value={item.label ?? ""}
                    onChange={(event) => {
                      const label = event.target.value;
                      updateShareInHistory(item.publicId, { label: label || undefined });
                      setHistory((prev) =>
                        prev.map((entry) =>
                          entry.publicId === item.publicId ? { ...entry, label } : entry
                        )
                      );
                    }}
                  />
                </div>

                <details className="history-policy">
                  <summary>Policy</summary>
                  <ul className="history-policy-list">
                    <li>
                      Availability:{" "}
                      {item.availableAt
                        ? formatLocalizedDateTime(item.availableAt)
                        : "Immediately"}
                    </li>
                    <li>Expires: {formatLocalizedDateTime(item.expiresAt)}</li>
                    <li>
                      Reveals:{" "}
                      {item.maxReveals === null ? "Unlimited" : `Up to ${item.maxReveals}`}
                    </li>
                    <li>
                      Release window:{" "}
                      {item.revealWindowSeconds == null
                        ? "None"
                        : `${item.revealWindowSeconds}s from first opening`}
                    </li>
                  </ul>
                </details>

                <div className="history-link-preview">
                  <code>{item.publicId}</code>
                </div>
              </div>

              <div className="history-card-actions">
                <a className="history-action-btn secondary" href={item.shareUrl}>Open</a>
                <button
                  type="button"
                  className="history-action-btn primary"
                  onClick={() => handleCopy(item)}
                >
                  {copiedId === item.publicId ? "Copied" : "Copy link"}
                </button>

                {clipboardFallbackId === item.publicId && (
                  <input className="history-copy-fallback" aria-label={`Manual copy link for ${item.publicId}`} readOnly value={item.shareUrl} onFocus={(event) => event.currentTarget.select()} />
                )}

                {item.deleteCapability && displayStatus !== "revoked" && displayStatus !== "unavailable" && (
                  revokeConfirmId === item.publicId ? (
                    <div className="history-confirm history-confirm-revoke" role="alert">
                      <span>Stop future releases? Saved copies cannot be erased.</span>
                      <button type="button" className="history-confirm-btn danger" disabled={revokingId === item.publicId} onClick={() => void handleRevoke(item)}>{revokingId === item.publicId ? "Revoking…" : "Confirm revoke"}</button>
                      <button type="button" className="history-confirm-btn" disabled={revokingId === item.publicId} onClick={() => setRevokeConfirmId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button type="button" className="history-action-btn danger" onClick={() => setRevokeConfirmId(item.publicId)}>Revoke</button>
                  )
                )}

                {removeConfirmId === item.publicId ? (
                  <div className="history-confirm history-confirm-remove" role="alert">
                    <span>Remove only from local history?</span>
                    <button type="button" className="history-confirm-btn danger" onClick={() => handleRemove(item)}>Remove</button>
                    <button type="button" className="history-confirm-btn" onClick={() => setRemoveConfirmId(null)}>Cancel</button>
                  </div>
                ) : (
                  <button type="button" className="history-remove-btn" onClick={() => setRemoveConfirmId(item.publicId)} title="Remove from local history" aria-label={`Remove share ${item.publicId} from history`}>✕</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {filteredHistory.length === 0 && <p className="history-filter-empty" role="status">No local shares match this filter.</p>}
    </section>
  );
}

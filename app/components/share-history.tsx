"use client";

import { useEffect, useState } from "react";
import {
  clearShareHistory,
  loadShareHistory,
  removeShareFromHistory,
  updateShareInHistory,
  type ShareHistoryItem,
} from "../../lib/shares/share-history";
import { formatLocalizedDateTime } from "../../lib/shares/policy-ui";

export interface ShareHistoryDeskProps {
  readonly refreshSignal?: number;
  readonly onSwitchToCreate?: () => void;
}

export function ShareHistoryDesk({ refreshSignal, onSwitchToCreate }: ShareHistoryDeskProps) {
  const [history, setHistory] = useState<ShareHistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setHistory(loadShareHistory());
  }, [refreshSignal]);

  async function handleCopy(item: ShareHistoryItem) {
    try {
      await navigator.clipboard.writeText(item.shareUrl);
      setCopiedId(item.publicId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard fallback
    }
  }

  async function checkLiveStatus(publicId: string) {
    setCheckingId(publicId);
    try {
      const response = await fetch(`/api/shares/${encodeURIComponent(publicId)}/status`, {
        cache: "no-store",
      });

      if (!response.ok) {
        updateShareInHistory(publicId, { status: "unavailable", remainingReveals: 0 });
        setHistory(loadShareHistory());
        return;
      }

      const data = (await response.json()) as {
        status: string;
        remainingReveals?: number | null;
        maxReveals?: number | null;
      };

      if (data.status === "unavailable") {
        updateShareInHistory(publicId, { status: "unavailable", remainingReveals: 0 });
      } else if (data.status === "scheduled") {
        updateShareInHistory(publicId, { status: "scheduled", remainingReveals: data.remainingReveals ?? null });
      } else if (data.status === "active") {
        updateShareInHistory(publicId, { status: "active", remainingReveals: data.remainingReveals ?? null });
      }
      setHistory(loadShareHistory());
    } catch {
      // Network error
    } finally {
      setCheckingId(null);
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
      }
    } catch {
      // Revoke error
    } finally {
      setRevokingId(null);
    }
  }

  function handleRemove(publicId: string) {
    removeShareFromHistory(publicId);
    setHistory(loadShareHistory());
  }

  function handleClearAll() {
    clearShareHistory();
    setHistory([]);
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
        <h2 className="surface-heading" id="history-heading">No shares created yet</h2>
        <p className="history-empty-text">
          Shares you seal and create on this browser will appear here so you can check live reveal limits, copy links, or revoke them anytime.
        </p>
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

  return (
    <section className="history-section" aria-labelledby="history-heading">
      <div className="history-header">
        <div>
          <h2 id="history-heading" className="history-heading">
            Shares created on this device
          </h2>
          <p className="history-sub">
            Stored locally in your browser. Track reveals, copy links, or revoke access.
          </p>
        </div>
        <button
          type="button"
          className="history-clear-btn"
          onClick={handleClearAll}
          title="Clear all local history"
        >
          Clear history
        </button>
      </div>

      <div className="history-list" role="list">
        {history.map((item) => {
          const isExpired = new Date(item.expiresAt).getTime() < Date.now();
          const displayStatus = item.status ?? (isExpired ? "unavailable" : "active");

          return (
            <article key={item.publicId} className="history-card" role="listitem">
              <div className="history-card-main">
                <div className="history-badges-row">
                  <span className={`history-status-badge badge-${displayStatus}`}>
                    {displayStatus === "active" && "● Active"}
                    {displayStatus === "scheduled" && "⏱ Scheduled"}
                    {displayStatus === "unavailable" && "✕ Unavailable / Expired"}
                    {displayStatus === "revoked" && "⊘ Revoked"}
                  </span>

                  <span className="history-reveals-tag">
                    {item.maxReveals === null
                      ? "Unlimited reveals"
                      : item.remainingReveals !== undefined && item.remainingReveals !== null
                      ? `${item.remainingReveals} / ${item.maxReveals} reveals remaining`
                      : item.maxReveals === 1
                      ? "1 reveal (burns after open)"
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

                <div className="history-link-preview">
                  <code>{item.publicId}</code>
                </div>
              </div>

              <div className="history-card-actions">
                <button
                  type="button"
                  className="history-action-btn primary"
                  onClick={() => handleCopy(item)}
                >
                  {copiedId === item.publicId ? "Copied" : "Copy link"}
                </button>

                <button
                  type="button"
                  className="history-action-btn secondary"
                  disabled={checkingId === item.publicId}
                  onClick={() => checkLiveStatus(item.publicId)}
                  title="Check remaining reveals live from server"
                >
                  {checkingId === item.publicId ? "Checking…" : "Check status"}
                </button>

                {item.deleteCapability && displayStatus !== "revoked" && displayStatus !== "unavailable" && (
                  <button
                    type="button"
                    className="history-action-btn danger"
                    disabled={revokingId === item.publicId}
                    onClick={() => handleRevoke(item)}
                  >
                    {revokingId === item.publicId ? "Revoking…" : "Revoke"}
                  </button>
                )}

                <button
                  type="button"
                  className="history-remove-btn"
                  onClick={() => handleRemove(item.publicId)}
                  title="Remove from local history"
                  aria-label={`Remove share ${item.publicId} from history`}
                >
                  ✕
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

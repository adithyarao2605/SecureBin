"use client";

import type { FactorMask } from "../../../../lib/crypto/factors";
import type { ContentPayload } from "../../../../lib/crypto/payload";
import { formatLocalizedDateTime, type ProoflinePhase } from "../../../../lib/shares/policy-ui";
import { DiscussionThread } from "../../../components/discussion-thread";
import { Proofline } from "../../../components/proofline";
import { FactorGate } from "../factor-gate";
import { RevealedContent, type DecryptedAttachment } from "../revealed-content";
import type { ShareStatus, ViewerState } from "../viewer-contracts";

export type ViewerViewProps = {
  publicId: string;
  state: ViewerState;
  shareStatus: ShareStatus | null;
  content: ContentPayload | null;
  attachments: DecryptedAttachment[];
  prooflinePhase: ProoflinePhase;
  notice: string;
  onDismissNotice: () => void;
  onRetry: () => void;
  factorsNeeded: boolean;
  passwordValue: string;
  unlockValue: string;
  onPasswordChange: (value: string) => void;
  onUnlockChange: (value: string) => void;
  factorError: string;
  onSubmitFactors: () => void;
  onReveal: () => void;
  onCancelConfirm: () => void;
  discussionCapability: Uint8Array | null;
  discussionSalt: Uint8Array | null;
  discussionMask: FactorMask;
};

export function ViewerView({
  publicId,
  state,
  shareStatus,
  content,
  attachments,
  prooflinePhase,
  notice,
  onDismissNotice,
  onRetry,
  factorsNeeded,
  passwordValue,
  unlockValue,
  onPasswordChange,
  onUnlockChange,
  factorError,
  onSubmitFactors,
  onReveal,
  onCancelConfirm,
  discussionCapability,
  discussionSalt,
  discussionMask,
}: ViewerViewProps) {
  const activeStatus = shareStatus?.status === "active" ? shareStatus : null;

  return (
    <main className="view-shell" role="main">
      <header className="brand-header">
        <h1 className="brand-title">SecureBin</h1>
        <p className="brand-subtitle">Zero-knowledge secure sharing</p>
      </header>

      <section className="evidence-rail" aria-label="Evidence rail">
        <Proofline phase={prooflinePhase} />
      </section>

      <div className="surface-card viewer-card">
        <div className="viewer-header">
          <h2 className="surface-heading">Decrypted share</h2>
          <p className="trust-line">Decrypted in your browser using the link fragment.</p>
        </div>

        {notice && state !== "opened" && (
          <div role="status">
            <p className="viewer-status-text">{notice}</p>
            <button type="button" className="action-button tertiary-button" onClick={onDismissNotice}>
              Dismiss
            </button>
          </div>
        )}

        {state === "checking" && (
          <div className="viewer-message-box" role="status">
            <p className="viewer-status-text">Checking share availability…</p>
          </div>
        )}

        {state === "incomplete" && (
          <div className="viewer-message-box" role="alert">
            <p className="viewer-status-text">
              The link is missing its decryption key. Ask the sender for the complete link with fragment.
            </p>
          </div>
        )}

        {state === "network_error" && (
          <div className="viewer-message-box" role="alert">
            <p className="viewer-status-text">Could not reach the server to verify this share.</p>
            <button type="button" className="action-button secondary-button" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}

        {state === "scheduled" && shareStatus?.status === "scheduled" && (
          <div className="viewer-message-box" role="status">
            <p className="viewer-status-text">
              This share is scheduled to unlock at {formatLocalizedDateTime(shareStatus.availableAt)}.
            </p>
          </div>
        )}

        {(state === "ready_unlimited" || state === "ready_limited") && activeStatus && factorsNeeded && (
          <FactorGate
            passwordRequired={activeStatus.passwordRequired}
            unlockRequired={activeStatus.unlockRequired}
            passwordValue={passwordValue}
            unlockValue={unlockValue}
            onPasswordChange={onPasswordChange}
            onUnlockChange={onUnlockChange}
            error={factorError}
            onSubmit={onSubmitFactors}
          />
        )}

        {state === "ready_unlimited" && activeStatus && !factorsNeeded && (
          <div className="viewer-action-box">
            <div className="viewer-policy-meta">
              <span className="policy-badge">Expires {formatLocalizedDateTime(activeStatus.expiresAt)}</span>
            </div>
            <p className="viewer-status-text">Ready to reveal.</p>
            <button type="button" className="action-button primary-button" onClick={onReveal}>
              Reveal
            </button>
          </div>
        )}

        {state === "ready_limited" && activeStatus && !factorsNeeded && (
          <div className="viewer-action-box">
            <div className="viewer-policy-meta">
              <span className="policy-badge">
                {activeStatus.remainingReveals} / {activeStatus.maxReveals} reveals remaining
              </span>
              <span className="policy-badge">Expires {formatLocalizedDateTime(activeStatus.expiresAt)}</span>
            </div>
            <p className="viewer-status-text">This share has a reveal limit. Revealing will consume one count.</p>
            <button
              type="button"
              className="action-button primary-button"
              onClick={() => {
                onDismissNotice();
                onReveal();
              }}
            >
              Reveal
            </button>
          </div>
        )}

        {state === "confirming" && activeStatus && !factorsNeeded && (
          <div className="viewer-action-box confirm-box" role="alert">
            <p className="viewer-status-text confirm-text">
              Consuming this reveal cannot be undone. Do you want to open it now?
            </p>
            <div className="confirm-actions-row">
              <button type="button" className="action-button primary-button" onClick={onReveal}>
                Yes, reveal now
              </button>
              <button type="button" className="action-button secondary-button" onClick={onCancelConfirm}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {state === "pending" && (
          <div className="viewer-action-box">
            <p className="viewer-status-text" role="status" aria-live="polite">
              Authorizing one reveal…
            </p>
            <button type="button" className="action-button primary-button" disabled>
              Opening…
            </button>
          </div>
        )}

        {state === "opened" && content !== null && (
          <RevealedContent content={content} attachments={attachments}>
            {discussionCapability && discussionSalt && (
              <DiscussionThread
                publicId={publicId}
                capability={discussionCapability}
                hkdfSalt={discussionSalt}
                mask={discussionMask}
              />
            )}
          </RevealedContent>
        )}

        {state === "unavailable" && (
          <div className="viewer-message-box" role="alert">
            <p className="viewer-status-text">This share is no longer available. Ask the sender for a new link.</p>
          </div>
        )}

        <div className="viewer-footer">
          <p className="public-id-tag">
            Public ID: <code>{publicId}</code>
          </p>
        </div>
      </div>
    </main>
  );
}

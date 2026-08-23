"use client";

import { PrivacyReceipt, type PrivacyReceiptData } from "../privacy-receipt";
import { ShareActions } from "../share-actions";

interface ShareResultCardProps {
  readonly shareUrl: string;
  readonly unlockCodeShown: string;
  readonly receiptData: PrivacyReceiptData | null;
  readonly activeDeleteCapability: string | null;
  readonly revokedMessage: string;
  readonly showRevokeConfirm: boolean;
  readonly copyStatus: "idle" | "copied";
  readonly isRevoking: boolean;
  setShowRevokeConfirm: (show: boolean) => void;
  onCopyLink: () => void;
  onRevoke: () => void;
  onReset: () => void;
}

export function ShareResultCard({
  shareUrl,
  unlockCodeShown,
  receiptData,
  activeDeleteCapability,
  revokedMessage,
  showRevokeConfirm,
  copyStatus,
  isRevoking,
  setShowRevokeConfirm,
  onCopyLink,
  onRevoke,
  onReset,
}: ShareResultCardProps) {
  return (
    <div className="surface-card result-card" role="region" aria-label="Share created">
      <h2 className="surface-heading">Share created</h2>
      <div className="share-link-box">
        <input
          type="text"
          className="share-link-input"
          readOnly
          value={shareUrl}
          aria-label="Share link"
          onFocus={(e) => e.target.select()}
        />
      </div>
      <p className="share-hint">
        The key stays in the link fragment. Keep the full link.
      </p>

      {unlockCodeShown && (
        <div className="unlock-code-box" role="status">
          <p className="unlock-heading">Second-channel unlock code</p>
          <p className="unlock-code">{unlockCodeShown}</p>
          <p className="policy-hint">
            This share needs <strong>two things</strong> to open: the link above (which carries the decryption
            key) and this code. Send them separately — for example the link by email and the code by text
            message — so no single channel can unlock it.
          </p>
          <ul className="policy-hint">
            <li>The link alone: shows a locked prompt.</li>
            <li>This code alone: useless without the link.</li>
            <li>Both together, in the same browser: content decrypts locally.</li>
          </ul>
          <p className="policy-hint">
            The code is shown only once and is never stored on the server. Copy it somewhere safe before
            leaving this page.
          </p>
        </div>
      )}

      <div className="share-copy-row">
        <button type="button" className="action-button primary-button" onClick={onCopyLink}>
          {copyStatus === "copied" ? "Copied" : "Copy link"}
        </button>
      </div>

      {receiptData && <PrivacyReceipt data={receiptData} />}

      <ShareActions shareUrl={shareUrl} />

      <div className="share-actions-row">

        {activeDeleteCapability && !revokedMessage && !showRevokeConfirm && (
          <button
            type="button"
            className="action-button secondary-button"
            onClick={() => setShowRevokeConfirm(true)}
          >
            Revoke share
          </button>
        )}

        <button
          type="button"
          className="action-button tertiary-button"
          onClick={onReset}
        >
          Create another
        </button>
      </div>

      {showRevokeConfirm && !revokedMessage && (
        <div className="revoke-confirmation-box" role="alert">
          <p className="revoke-warning">
            Stop future reveals? This cannot remove content already opened or downloaded.
          </p>
          <div className="revoke-actions">
            <button
              type="button"
              className="action-button danger-button"
              disabled={isRevoking}
              onClick={onRevoke}
            >
              {isRevoking ? "Revoking…" : "Revoke share"}
            </button>
            <button
              type="button"
              className="action-button secondary-button"
              disabled={isRevoking}
              onClick={() => setShowRevokeConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {revokedMessage && (
        <div className="revoked-status-box" role="status">
          <p className="revoked-status-text">{revokedMessage}</p>
        </div>
      )}
    </div>
  );
}

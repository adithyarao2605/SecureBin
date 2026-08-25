"use client";

import { bytesToArrayBuffer } from "../../../lib/crypto/encoding";
import { formatLocalizedDateTime } from "../../../lib/shares/policy-ui";
import { PrivacyReceipt, type PrivacyReceiptData } from "../privacy-receipt";
import { ShareActions } from "../share-actions";

interface ShareResultCardProps {
  readonly shareUrl: string;
  readonly unlockCodeShown: string;
  readonly receiptData: PrivacyReceiptData | null;
  readonly activeDeleteCapability: string | null;
  readonly revokedMessage: string;
  readonly showRevokeConfirm: boolean;
  readonly copyStatus: "idle" | "copied" | "failed";
  readonly isRevoking: boolean;
  readonly parcel: Uint8Array | null;
  setShowRevokeConfirm: (show: boolean) => void;
  onCopyLink: () => void;
  onRevoke: () => void;
  onReset: () => void;
}

function downloadParcel(parcel: Uint8Array, publicId: string): void {
  const blob = new Blob([bytesToArrayBuffer(parcel)], { type: "application/octet-stream" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${publicId}.securebin`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(anchor.href);
}

function factorLabel(mask: string): string {
  switch (mask) {
    case "link":
      return "Link only";
    case "link+password":
      return "Link + password";
    case "link+unlock":
      return "Link + unlock code";
    case "link+password+unlock":
      return "Link + password + unlock code";
    default:
      return mask;
  }
}

function revealLabel(maxReveals: number | null): string {
  return maxReveals === null ? "Unlimited releases" : `${maxReveals} release${maxReveals === 1 ? "" : "s"}`;
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
  parcel,
  setShowRevokeConfirm,
  onCopyLink,
  onRevoke,
  onReset,
}: ShareResultCardProps) {
  return (
    <div className="surface-card result-card" role="region" aria-labelledby="share-result-heading">
      <header className="share-result-header">
        <div>
          <p className="share-result-eyebrow">Sealed locally · sender view</p>
          <h2 className="surface-heading" id="share-result-heading">Share ready</h2>
          <p className="share-result-lede">Your browser encrypted the content before the server received it.</p>
        </div>
        <span className="share-result-state">Browser encrypted</span>
      </header>

      <section className="share-result-section" aria-labelledby="share-delivery-heading">
        <div className="share-result-section-heading">
          <div>
            <p className="share-result-eyebrow">01 / Delivery</p>
            <h3 id="share-delivery-heading">Send the complete link</h3>
          </div>
          <span className="share-proof-chip">Fragment-held key</span>
        </div>
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
          Keep the full link intact. Its <code>#fragment</code> carries the decryption key and is never sent in an HTTP request.
        </p>
        <div className="share-primary-actions">
          <button type="button" className="action-button primary-button" onClick={onCopyLink}>
            {copyStatus === "copied" ? "Copied" : "Copy link"}
          </button>
          <a className="action-button secondary-button" href={shareUrl}>Open recipient view</a>
        </div>
        {copyStatus === "failed" && <p className="composer-error" role="alert">Clipboard access is unavailable. Select the link above and copy it manually.</p>}
      </section>

      {unlockCodeShown && (
        <section className="share-result-section" aria-labelledby="unlock-heading">
          <div className="share-result-section-heading">
            <div>
              <p className="share-result-eyebrow">02 / Second channel</p>
              <h3 id="unlock-heading">Deliver this code separately</h3>
            </div>
            <span className="share-proof-chip">Two-channel unlock</span>
          </div>
          <div className="unlock-code-box" role="status">
            <p className="unlock-heading">Unlock code</p>
            <p className="unlock-code">{unlockCodeShown}</p>
            <p className="policy-hint">
              Send the link and this code through different channels. The link alone cannot unlock the share, and the code alone is useless.
            </p>
            <p className="policy-hint">
              This code is shown only once and is never stored on the server. Save it before leaving this page.
            </p>
          </div>
        </section>
      )}

      {receiptData && (
        <details className="share-result-section share-secondary-section">
          <summary className="share-result-section-summary">
            <div className="share-result-section-heading">
              <div>
                <p className="share-result-eyebrow">03 / Evidence</p>
                <h3 id="share-proof-heading">Verify what was sealed</h3>
              </div>
              <span className="share-proof-chip">No plaintext uploaded</span>
            </div>
          </summary>
          <div className="share-secondary-body">
            <div className="share-proof-summary" aria-label="Share policy summary">
              <div className="share-proof-chips">
                <span className="share-proof-chip">{receiptData.contentType ?? "Note"}</span>
                <span className="share-proof-chip">{factorLabel(receiptData.mask)}</span>
                <span className="share-proof-chip">{revealLabel(receiptData.maxReveals)}</span>
                <span className="share-proof-chip">
                  {receiptData.expiresAt ? `Expires ${formatLocalizedDateTime(receiptData.expiresAt)}` : "Never expires"}
                </span>
              </div>
              <p className="share-fingerprint-line">
                <span>Ciphertext fingerprint</span>
                <code>{receiptData.fingerprint.slice(0, 16)}…</code>
              </p>
              <p className="share-fingerprint-note">
                This identifies the sealed material; it is not proof that someone opened or read it.
              </p>
            </div>
            <PrivacyReceipt data={receiptData} />
          </div>
        </details>
      )}

      {parcel && receiptData && (
        <details className="share-result-section share-secondary-section">
          <summary className="share-result-section-summary">
            <div className="share-result-section-heading">
              <div>
                <p className="share-result-eyebrow">04 / Offline copy</p>
                <h3 id="parcel-heading">Carry the ciphertext locally</h3>
              </div>
              <span className="share-proof-chip">No network required to restore</span>
            </div>
          </summary>
          <div className="share-secondary-body">
            <div className="parcel-export-box">
              <button
                type="button"
                className="action-button secondary-button"
                onClick={() => downloadParcel(parcel, receiptData.publicId)}
              >
                Download .securebin parcel
              </button>
              <p className="policy-hint">
                The parcel contains encrypted material only—not the link key, password, unlock code, revoke ability, or discussion capability. Restore it from the parcel utility with the original factors.
              </p>
            </div>
          </div>
        </details>
      )}

      <details className="share-result-section share-secondary-section">
        <summary className="share-result-section-summary">
          <div className="share-result-section-heading">
            <div>
              <p className="share-result-eyebrow">05 / Transport</p>
              <h3 id="share-tools-heading">Choose how to pass it on</h3>
            </div>
            <span className="share-proof-chip">Full link required</span>
          </div>
        </summary>
        <div className="share-secondary-body"><ShareActions shareUrl={shareUrl} /></div>
      </details>

      <section className="share-danger-section" aria-labelledby="share-controls-heading">
        <div className="share-result-section-heading">
          <div>
            <p className="share-result-eyebrow">Sender controls</p>
            <h3 id="share-controls-heading">Manage this share</h3>
          </div>
        </div>
        <div className="share-actions-row">
          {activeDeleteCapability && !revokedMessage && !showRevokeConfirm && (
            <button
              type="button"
              className="action-button danger-button"
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
                {isRevoking ? "Revoking…" : "Confirm revoke"}
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
      </section>
    </div>
  );
}

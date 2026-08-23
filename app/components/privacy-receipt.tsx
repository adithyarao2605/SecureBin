"use client";

import { formatLocalizedDateTime } from "../../lib/shares/policy-ui";

export interface PrivacyReceiptData {
  readonly publicId: string;
  readonly fingerprint: string;
  readonly mask: string;
  readonly hasFile: boolean;
  readonly availableAt: string | null;
  readonly expiresAt: string | null;
  readonly maxReveals: number | null;
  readonly algorithm: string;
  readonly kdf: string;
  readonly envelopeVersion: number;
  /** Human label of the sealed content mode (note/markdown/code). */
  readonly contentType?: string;
  /** Number of encrypted attachments shipped with the share. */
  readonly fileCount?: number;
  /** Whether an encrypted discussion capability was sealed in. */
  readonly discussionEnabled?: boolean;
  /** Sender-chosen release window from first opening, seconds. */
  readonly revealWindowSeconds?: number | null;
}

function maskLabel(mask: string): string {
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

/**
 * Privacy Receipt (T1 transparency requirement): what the browser protected,
 * the technical details, and an honest list of what infrastructure can still
 * observe. Never includes secrets, fragments, or capabilities.
 */
export function PrivacyReceipt({ data }: { data: PrivacyReceiptData }) {
  return (
    <details className="privacy-receipt">
      <summary className="receipt-heading">Privacy receipt</summary>
      <div className="receipt-body">
        <dl className="receipt-grid">
          <dt>What stayed in this browser</dt>
          <dd>Plaintext, the fragment key, passwords, unlock codes, and every revocation ability</dd>
          <dt>Encrypted in your browser</dt>
          <dd>{data.algorithm}, envelope v{data.envelopeVersion}</dd>
          <dt>Key derivation</dt>
          <dd>{data.kdf === "none" ? "None required for this share" : `${data.kdf} (600,000 iterations)`}</dd>
          <dt>Required to open</dt>
          <dd>{maskLabel(data.mask)}</dd>
          <dt>Content</dt>
          <dd>{data.contentType ?? "Note"}</dd>
          <dt>Attachments</dt>
          <dd>
            {data.fileCount === undefined
              ? data.hasFile ? "One encrypted file (name and type encrypted too)" : "None"
              : data.fileCount === 0
              ? "None"
              : `${data.fileCount} encrypted file${data.fileCount === 1 ? "" : "s"} (names and types encrypted too)`}
          </dd>
          {data.discussionEnabled !== undefined && (
            <>
              <dt>Discussion</dt>
              <dd>{data.discussionEnabled ? "Enabled — revealed recipients can post encrypted replies" : "Disabled"}</dd>
            </>
          )}
          <dt>Availability</dt>
          <dd>{data.availableAt ? formatLocalizedDateTime(data.availableAt) : "Immediately"}</dd>
          <dt>Expires</dt>
          <dd>{formatLocalizedDateTime(data.expiresAt)}</dd>
          <dt>Reveal policy</dt>
          <dd>{data.maxReveals === null ? "Unlimited ciphertext releases" : `Up to ${data.maxReveals} release${data.maxReveals === 1 ? "" : "s"}`}</dd>
          <dt>Release window</dt>
          <dd>
            {data.revealWindowSeconds == null
              ? "None — releases stop at expiry or revocation"
              : `${data.revealWindowSeconds}s from the first opening`}
          </dd>
          <dt>Revocation</dt>
          <dd>You can revoke access from this device at any time</dd>
          <dt>Ciphertext fingerprint</dt>
          <dd><code className="receipt-fingerprint">{data.fingerprint.slice(0, 16)}…</code></dd>
        </dl>
        <p className="receipt-note">Infrastructure may still observe ciphertext sizes, timestamps, request timing, and access patterns. SecureBin cannot erase copies a recipient has already saved.</p>
        <button
          type="button"
          className="action-button tertiary-button receipt-download"
          onClick={() => downloadReceipt(data)}
        >
          Download receipt (.txt)
        </button>
      </div>
    </details>
  );
}

function downloadReceipt(data: PrivacyReceiptData): void {
  const lines = [
    "SecureBin privacy receipt",
    `Public ID: ${data.publicId}`,
    `Created: ${new Date().toISOString()}`,
    `Encrypted: ${data.algorithm}, envelope v${data.envelopeVersion}`,
    `Key derivation: ${data.kdf}`,
    `Required to open: ${data.mask}`,
    `Content: ${data.contentType ?? "Note"}`,
    `Attachments: ${data.fileCount ?? (data.hasFile ? 1 : 0)}`,
    `Discussion: ${data.discussionEnabled ? "enabled" : "disabled"}`,
    `Availability: ${data.availableAt ?? "Immediately"}`,
    `Expires: ${data.expiresAt ?? "Never"}`,
    `Reveals: ${data.maxReveals === null ? "Unlimited" : `Up to ${data.maxReveals}`}`,
    `Release window: ${data.revealWindowSeconds == null ? "None" : `${data.revealWindowSeconds}s from first opening`}`,
    "Revocation: available on this device at any time",
    `Ciphertext fingerprint: ${data.fingerprint.slice(0, 16)}…`,
    "Infrastructure may still observe ciphertext sizes, timestamps, request timing, and access patterns.",
    "SecureBin cannot erase copies a recipient has already saved.",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `securebin-receipt-${data.publicId}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(anchor.href);
}

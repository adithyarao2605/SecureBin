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
    <section className="privacy-receipt" aria-label="Privacy receipt">
      <h3 className="receipt-heading">Privacy receipt</h3>
      <dl className="receipt-grid">
        <dt>Encrypted in your browser</dt>
        <dd>{data.algorithm}, envelope v{data.envelopeVersion}</dd>
        <dt>Key derivation</dt>
        <dd>{data.kdf === "none" ? "None required for this share" : `${data.kdf} (600,000 iterations)`}</dd>
        <dt>Required to open</dt>
        <dd>{maskLabel(data.mask)}</dd>
        <dt>Attachment</dt>
        <dd>{data.hasFile ? "One encrypted file (name and type encrypted too)" : "None"}</dd>
        <dt>Availability</dt>
        <dd>{data.availableAt ? formatLocalizedDateTime(data.availableAt) : "Immediately"}</dd>
        <dt>Expires</dt>
        <dd>{formatLocalizedDateTime(data.expiresAt)}</dd>
        <dt>Reveal policy</dt>
        <dd>{data.maxReveals === null ? "Unlimited ciphertext releases" : `Up to ${data.maxReveals} release${data.maxReveals === 1 ? "" : "s"}`}</dd>
        <dt>Revocation</dt>
        <dd>You can revoke access from this device at any time</dd>
        <dt>Ciphertext fingerprint</dt>
        <dd>
          <code className="receipt-fingerprint">{data.fingerprint.slice(0, 16)}…</code>
        </dd>
      </dl>
      <p className="receipt-note">
        Infrastructure may still observe ciphertext sizes, timestamps, request
        timing, and access patterns. SecureBin cannot erase copies a recipient
        has already saved.
      </p>
    </section>
  );
}

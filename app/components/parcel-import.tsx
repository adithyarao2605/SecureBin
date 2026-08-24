"use client";

import { useRef, useState } from "react";

import { openContent } from "../../lib/crypto/content";
import { validateLinkSecret } from "../../lib/crypto/envelope";
import { openFile, type FilePayload } from "../../lib/crypto/file";
import type { ContentPayload } from "../../lib/crypto/payload";
import { decodeParcel, MAX_PARCEL_BYTES, ParcelError, type Parcel } from "../../lib/shares/parcel";
import { RevealedContent, type DecryptedAttachment } from "../s/[publicId]/revealed-content";

interface DecryptedParcel {
  readonly parcel: Parcel;
  readonly content: ContentPayload;
  readonly attachments: DecryptedAttachment[];
}

/**
 * Offline .securebin parcel restore (Day 6 §5): parses the container
 * strictly and decrypts entirely in this browser. No network request is
 * made at any point.
 */
export function ParcelImport() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [linkSecret, setLinkSecret] = useState("");
  const [password, setPassword] = useState("");
  const [unlockCode, setUnlockCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DecryptedParcel | null>(null);
  const [dragging, setDragging] = useState(false);

  function reset() {
    setParcel(null);
    setLinkSecret("");
    setPassword("");
    setUnlockCode("");
    setError("");
    setResult(null);
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFileChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    setDragging(false);
    if (file.size > MAX_PARCEL_BYTES) {
      setParcel(null);
      setError(`This parcel is too large. Choose a file no larger than ${MAX_PARCEL_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setParcel(decodeParcel(bytes));
    } catch (cause) {
      setParcel(null);
      setError(cause instanceof ParcelError ? cause.message : "This file could not be read as a parcel.");
    }
  }

  async function handleDecrypt() {
    if (!parcel || busy) return;
    setBusy(true);
    setError("");
    try {
      const key = linkSecret.trim();
      if (!/^[A-Za-z0-9_-]{43}$/.test(key)) {
        throw new ParcelError("Paste the full fragment key from the share link (the part after #).");
      }
      const mask = parcel.contentEnvelope.factorMask;
      const needsPassword = mask.includes("password");
      const needsUnlock = mask.includes("unlock");
      if (needsPassword && !password) throw new ParcelError("This parcel needs its password.");
      if (needsUnlock && !unlockCode.trim()) throw new ParcelError("This parcel needs its unlock code.");

      // Fail fast on a malformed key before any key derivation.
      validateLinkSecret(key);
      const sealed = await openContent(
        parcel.contentEnvelope,
        parcel.policy.publicId,
        key,
        needsPassword || needsUnlock
          ? {
              mask,
              password: needsPassword ? password : undefined,
              unlockCode: needsUnlock ? unlockCode.trim() : undefined,
            }
          : undefined
      );
      // A discussion capability cannot work offline; it is ignored here.
      const content: ContentPayload =
        sealed.mode === "code"
          ? { mode: "code", text: sealed.text, language: sealed.language }
          : { mode: sealed.mode, text: sealed.text };
      const attachments: DecryptedAttachment[] = [];
      for (const entry of parcel.attachments) {
        const payload: FilePayload = await openFile(
          entry.envelope,
          entry.ciphertext,
          parcel.policy.publicId,
          key,
          needsPassword || needsUnlock
            ? {
                mask,
                password: needsPassword ? password : undefined,
                unlockCode: needsUnlock ? unlockCode.trim() : undefined,
              }
            : undefined
        );
        attachments.push({ name: payload.filename, payload });
      }
      setResult({ parcel, content, attachments });
    } catch {
      setError("Could not decrypt with the supplied local factors. Check the fragment key and any required factors.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card parcel-import" aria-label="Restore a securebin parcel">
      <h3 className="surface-heading">Restore a .securebin parcel</h3>
      <p className="policy-hint">
        Opens an exported encrypted bundle fully offline — nothing is uploaded.
        You still need the original link’s fragment key; the parcel never
        contains it.
      </p>
      <p className="policy-hint parcel-offline-status" role="status">
        Offline restore · no upload or network request
      </p>

      <input
        ref={inputRef}
        id="parcel-file-input"
        type="file"
        accept=".securebin,application/octet-stream"
        className="sr-only"
        aria-label="Parcel file"
        onChange={(event) => void handleFileChange(event.target.files)}
      />
      {!parcel && !result && (
        <button
          type="button"
          className={`action-button secondary-button parcel-drop-zone${dragging ? " is-dragging" : ""}`}
          aria-label="Choose or drop a .securebin parcel"
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            void handleFileChange(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <span>Choose or drop a .securebin file</span>
          <small>Maximum {MAX_PARCEL_BYTES / (1024 * 1024)} MB · stays in this browser</small>
        </button>
      )}

      {error && (
        <div role="alert" className="composer-error">
          {error}
        </div>
      )}

      {parcel && !result && (
        <div className="policy-input-group">
          <p className="policy-hint">
            SBPX v{parcel.version} · sealed content with{" "}
            {parcel.attachments.length} attachment{parcel.attachments.length === 1 ? "" : "s"}.
          </p>
          <dl className="parcel-policy-summary" aria-label="Parcel policy snapshot">
            <div><dt>Availability</dt><dd>{parcel.policy.availableAt ? new Date(parcel.policy.availableAt).toLocaleString() : "Available now"}</dd></div>
            <div><dt>Expires</dt><dd>{parcel.policy.expiresAt ? new Date(parcel.policy.expiresAt).toLocaleString() : "Never"}</dd></div>
            <div><dt>Releases</dt><dd>{parcel.policy.maxReveals === null ? "Unlimited" : parcel.policy.maxReveals}</dd></div>
            <div><dt>Factors</dt><dd>{parcel.contentEnvelope.factorMask.replaceAll("+", " · ")}</dd></div>
          </dl>
          <label htmlFor="parcel-key" className="policy-input-label">
            Fragment key (the text after # in the share link)
          </label>
          <input
            id="parcel-key"
            type="text"
            autoComplete="off"
            spellCheck={false}
            className="policy-number-input"
            value={linkSecret}
            onChange={(e) => setLinkSecret(e.target.value)}
          />
          {parcel.contentEnvelope.factorMask.includes("password") && (
            <>
              <label htmlFor="parcel-password" className="policy-input-label">
                Password
              </label>
              <input
                id="parcel-password"
                type="password"
                autoComplete="off"
                className="policy-number-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}
          {parcel.contentEnvelope.factorMask.includes("unlock") && (
            <>
              <label htmlFor="parcel-unlock" className="policy-input-label">
                Unlock code
              </label>
              <input
                id="parcel-unlock"
                type="text"
                autoComplete="off"
                className="policy-number-input"
                value={unlockCode}
                onChange={(e) => setUnlockCode(e.target.value)}
              />
            </>
          )}
          <div className="composer-submit-row">
            <button type="button" className="action-button primary-button" disabled={busy} onClick={() => void handleDecrypt()}>
              {busy ? "Decrypting…" : "Decrypt offline"}
            </button>
            <button type="button" className="action-button tertiary-button" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="parcel-result">          <RevealedContent content={result.content} attachments={result.attachments} />
          <button type="button" className="action-button tertiary-button" onClick={reset}>
            Restore another parcel
          </button>
        </div>
      )}
    </section>
  );
}

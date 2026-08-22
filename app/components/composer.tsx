"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { digestCapability, sealContent, type SealedContent } from "../../lib/crypto/content";
import { bytesToArrayBuffer } from "../../lib/crypto/encoding";
import {
  MAX_FILE_PLAINTEXT_BYTES,
  sealFile,
  type FilePayload,
  type SealedFile,
} from "../../lib/crypto/file";
import {
  CODE_LANGUAGES,
  type CodeLanguage,
  type ContentPayload,
} from "../../lib/crypto/payload";
import { generateShareContext, type ShareCryptoContext } from "../../lib/crypto/share-context";
import {
  defaultPolicyDraft,
  validatePolicyDraft,
  type PolicyDraft,
  type ProoflinePhase,
  type ValidatedPolicy,
} from "../../lib/shares/policy-ui";
import { saveShareToHistory } from "../../lib/shares/share-history";
import { PolicyControls } from "./policy-controls";

export type ComposerMode = "note" | "markdown" | "code";

interface PreparedAttempt {
  readonly context: ShareCryptoContext;
  readonly sealedContent: SealedContent;
  readonly sealedFile: SealedFile | null;
  readonly fileUploaded: boolean;
  readonly payload: Record<string, unknown>;
}

export interface ComposerProps {
  readonly onPhaseChange?: (phase: ProoflinePhase) => void;
  readonly onPolicyChange?: (policy: ValidatedPolicy) => void;
  readonly onShareCreated?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Composer({ onPhaseChange, onPolicyChange, onShareCreated }: ComposerProps = {}) {
  const [mode, setMode] = useState<ComposerMode>("note");
  const [language, setLanguage] = useState<CodeLanguage>("typescript");
  const [draft, setDraft] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(defaultPolicyDraft());
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [activeDeleteCapability, setActiveDeleteCapability] = useState<string | null>(null);
  const [activePublicId, setActivePublicId] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revokedMessage, setRevokedMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const preparedRef = useRef<PreparedAttempt | null>(null);

  function resetPrepared() {
    preparedRef.current = null;
    setErrorMessage("");
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    resetPrepared();
  }

  function handleModeChange(newMode: ComposerMode) {
    setMode(newMode);
    resetPrepared();
  }

  function handleLanguageChange(newLang: CodeLanguage) {
    setLanguage(newLang);
    resetPrepared();
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_PLAINTEXT_BYTES) {
      setErrorMessage(`File is too large. Maximum size is 10 MB (selected: ${formatBytes(file.size)}).`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setAttachedFile(file);
    resetPrepared();
  }

  function handleRemoveFile() {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    resetPrepared();
  }

  function handlePolicyChange(updated: PolicyDraft) {
    setPolicyDraft(updated);
    resetPrepared();
    if (onPolicyChange) {
      onPolicyChange(validatePolicyDraft(updated));
    }
  }

  async function createShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    if (!draft.trim() && !attachedFile) {
      setErrorMessage("Write some content or attach a file before creating a share.");
      return;
    }

    const validated = validatePolicyDraft(policyDraft);
    if (!validated.valid) {
      setErrorMessage(validated.error);
      return;
    }

    setIsPending(true);
    setErrorMessage("");
    if (onPhaseChange) onPhaseChange("creating");

    try {
      let prepared = preparedRef.current;

      if (!prepared) {
        const context = generateShareContext();

        let contentPayload: ContentPayload;
        if (mode === "note") {
          contentPayload = { mode: "note", text: draft };
        } else if (mode === "markdown") {
          contentPayload = { mode: "markdown", text: draft };
        } else {
          contentPayload = { mode: "code", text: draft, language };
        }

        const sealedContent = await sealContent(contentPayload, context);

        let sealedFile: SealedFile | null = null;
        if (attachedFile) {
          const buffer = await attachedFile.arrayBuffer();
          const fileData = new Uint8Array(buffer);
          const payload: FilePayload = {
            filename: attachedFile.name,
            mimeType: attachedFile.type || "application/octet-stream",
            data: fileData,
          };
          sealedFile = await sealFile(payload, context);
        }

        const [deleteTokenHash, idempotencyKeyHash] = await Promise.all([
          digestCapability(context.deleteCapability),
          digestCapability(context.idempotencyKey),
        ]);

        const payload: Record<string, unknown> = {
          publicId: context.publicId,
          contentEnvelope: sealedContent.envelope,
          policy: {
            availableAt: validated.availableAt,
            expiresAt: validated.expiresAt,
            maxReveals: validated.maxReveals,
          },
          deleteTokenHash,
          idempotencyKeyHash,
          passwordRequired: false,
          unlockRequired: false,
          fileEnvelope: sealedFile ? sealedFile.envelope : null,
          fileCiphertextSize: sealedFile ? sealedFile.ciphertextSize : null,
        };

        prepared = {
          context,
          sealedContent,
          sealedFile,
          fileUploaded: false,
          payload,
        };
        preparedRef.current = prepared;
      }

      // If a file is attached and not yet uploaded, perform staged upload
      if (prepared.sealedFile && !prepared.fileUploaded) {
        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicId: prepared.context.publicId,
            idempotencyKeyHash: prepared.payload.idempotencyKeyHash,
            fileEnvelope: prepared.sealedFile.envelope,
            expectedCiphertextSize: prepared.sealedFile.ciphertextSize,
          }),
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => "");
          console.error("[SecureBin] Upload reservation failed:", uploadRes.status, errText);
          throw new Error("upload_reservation_failed");
        }

        const uploadData = (await uploadRes.json()) as { uploadUrl?: string };
        if (!uploadData.uploadUrl) {
          console.error("[SecureBin] Missing uploadUrl in reservation response");
          throw new Error("missing_upload_url");
        }

        const putRes = await fetch(uploadData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: new Blob([bytesToArrayBuffer(prepared.sealedFile.ciphertext)], { type: "application/octet-stream" }),
        });

        if (!putRes.ok) {
          const putErr = await putRes.text().catch(() => "");
          console.error("[SecureBin] Storage upload failed:", putRes.status, putErr);
          throw new Error("storage_upload_failed");
        }

        prepared = { ...prepared, fileUploaded: true };
        preparedRef.current = prepared;
      }

      // Create the share
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepared.payload),
      });

      if (!response.ok) {
        const createErr = await response.text().catch(() => "");
        console.error("[SecureBin] Create share RPC failed:", response.status, createErr);
        throw new Error("create_failed");
      }

      const result = (await response.json()) as { publicId?: unknown };
      const returnedPublicId =
        typeof result.publicId === "string" ? result.publicId : prepared.context.publicId;
      const origin = window.location.origin;
      const fullUrl = `${origin}/s/${encodeURIComponent(returnedPublicId)}#${prepared.context.linkSecret}`;

      setShareUrl(fullUrl);
      setActivePublicId(returnedPublicId);
      setActiveDeleteCapability(prepared.context.deleteCapability);

      saveShareToHistory({
        publicId: returnedPublicId,
        shareUrl: fullUrl,
        createdAt: new Date().toISOString(),
        expiresAt: validated.expiresAt,
        availableAt: validated.availableAt,
        maxReveals: validated.maxReveals,
        deleteCapability: prepared.context.deleteCapability,
        status: "active",
        remainingReveals: validated.maxReveals,
      });

      preparedRef.current = null;
      if (onPhaseChange) onPhaseChange("created");
      if (onShareCreated) onShareCreated();
    } catch (err) {
      console.error("[SecureBin] Share creation halted:", err instanceof Error ? err.message : String(err));
      setErrorMessage("This share could not be created. Your draft is still only on this device.");
      if (onPhaseChange) onPhaseChange("draft");
    } finally {
      setIsPending(false);
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      // Fallback
    }
  }

  async function handleRevoke() {
    if (!activePublicId || !activeDeleteCapability || isRevoking) return;
    setIsRevoking(true);
    setRevokedMessage("");

    try {
      const response = await fetch(`/api/shares/${encodeURIComponent(activePublicId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteCapability: activeDeleteCapability }),
      });

      if (!response.ok) {
        throw new Error("revoke_failed");
      }

      setRevokedMessage("Share revoked. Future reveals are unavailable.");
      setShowRevokeConfirm(false);
      setActiveDeleteCapability(null);
      if (onPhaseChange) onPhaseChange("unavailable");
    } catch {
      setRevokedMessage("The share could not be revoked. Try again.");
    } finally {
      setIsRevoking(false);
    }
  }

  function handleReset() {
    setDraft("");
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShareUrl("");
    setActiveDeleteCapability(null);
    setActivePublicId(null);
    setShowRevokeConfirm(false);
    setRevokedMessage("");
    setErrorMessage("");
    preparedRef.current = null;
    if (onPhaseChange) onPhaseChange("draft");
  }

  if (shareUrl) {
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

        <div className="share-actions-row">
          <button
            type="button"
            className="action-button primary-button"
            onClick={handleCopyLink}
          >
            {copyStatus === "copied" ? "Copied" : "Copy link"}
          </button>

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
            onClick={handleReset}
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
                onClick={handleRevoke}
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

  return (
    <div className="surface-card composer-surface">
      <div className="composer-header">
        <h2 className="surface-heading" id="composer-heading">
          Create a private share
        </h2>
        <p className="trust-line">Your browser encrypts this before it leaves the page.</p>
      </div>

      <form className="composer-form" onSubmit={createShare}>
        <div className="composer-toolbar">
          <div className="mode-tabs" role="tablist" aria-label="Share mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "note"}
              className={`mode-tab ${mode === "note" ? "active" : ""}`}
              onClick={() => handleModeChange("note")}
            >
              Plain note
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "markdown"}
              className={`mode-tab ${mode === "markdown" ? "active" : ""}`}
              onClick={() => handleModeChange("markdown")}
            >
              Markdown
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "code"}
              className={`mode-tab ${mode === "code" ? "active" : ""}`}
              onClick={() => handleModeChange("code")}
            >
              Code
            </button>
          </div>

          {mode === "code" && (
            <div className="language-selector-wrapper">
              <label htmlFor="code-language-select" className="sr-only">
                Programming language
              </label>
              <select
                id="code-language-select"
                className="language-select"
                value={language}
                disabled={isPending}
                onChange={(e) => handleLanguageChange(e.target.value as CodeLanguage)}
              >
                {CODE_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="character-count" aria-live="polite">
            {draft.length.toLocaleString()} / 524,288
          </span>
        </div>

        <label htmlFor="draft-textarea" className="sr-only">
          {mode === "note" ? "Note content" : mode === "markdown" ? "Markdown content" : "Code content"}
        </label>
        <textarea
          id="draft-textarea"
          className="composer-textarea"
          maxLength={524288}
          placeholder={
            mode === "note"
              ? "Start typing your note here..."
              : mode === "markdown"
              ? "Write Markdown (# heading, **bold**, - list)…"
              : "Paste code snippet…"
          }
          value={draft}
          disabled={isPending}
          onChange={(e) => handleDraftChange(e.target.value)}
        />

        <div className="file-attachment-section">
          <label htmlFor="file-attachment-input" className="sr-only">
            Attach file (max 10 MB)
          </label>
          <input
            type="file"
            ref={fileInputRef}
            id="file-attachment-input"
            aria-label="Attach file (max 10 MB)"
            className="sr-only"
            disabled={isPending}
            onChange={handleFileSelect}
          />
          {!attachedFile ? (
            <button
              type="button"
              className="action-button secondary-button attach-file-btn"
              disabled={isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              Attach file (max 10 MB)
            </button>
          ) : (
            <div className="attached-file-badge" role="status">
              <span className="file-info-text">
                📎 <strong>{attachedFile.name}</strong> ({formatBytes(attachedFile.size)})
              </span>
              <button
                type="button"
                className="remove-file-button"
                disabled={isPending}
                onClick={handleRemoveFile}
                aria-label="Remove attached file"
              >
                ✕ Remove
              </button>
            </div>
          )}
        </div>

        <PolicyControls
          draft={policyDraft}
          disabled={isPending}
          onChange={handlePolicyChange}
        />

        {errorMessage && (
          <div className="composer-error" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="composer-submit-row">
          <button
            type="submit"
            className="action-button primary-button submit-button"
            disabled={isPending}
          >
            {isPending ? "Creating share…" : "Create share"}
          </button>
        </div>
      </form>
    </div>
  );
}

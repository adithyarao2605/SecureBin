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
import { MAX_CONTENT_BYTES } from "../../lib/crypto/envelope";
import {
  CODE_LANGUAGES,
  type CodeLanguage,
  type ContentPayload,
} from "../../lib/crypto/payload";
import { generateShareContext, type ShareCryptoContext } from "../../lib/crypto/share-context";
import { prepareFactors, FactorError } from "../../lib/crypto/factors";
import { ProtectionControls, EMPTY_PROTECTION, type ProtectionState } from "./protection-controls";
import { PrivacyReceipt } from "./privacy-receipt";
import { ShareActions } from "./share-actions";
import { MarkdownView } from "./markdown-view";
import {
  defaultPolicyDraft,
  validatePolicyDraft,
  type PolicyDraft,
  type ProoflinePhase,
  type ValidatedPolicy,
} from "../../lib/shares/policy-ui";
import { saveShareToHistory, updateShareInHistory } from "../../lib/shares/share-history";
import { PolicyControls } from "./policy-controls";

export type ComposerMode = "note" | "markdown" | "code";
export type MarkdownViewMode = "edit" | "split" | "preview";

interface PreparedAttemptFile {
  readonly sealed: SealedFile;
  readonly uploaded: boolean;
}

interface PreparedAttempt {
  readonly context: ShareCryptoContext;
  readonly sealedContent: SealedContent;
  readonly files: PreparedAttemptFile[];
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
  const [markdownView, setMarkdownView] = useState<MarkdownViewMode>("edit");
  const [language, setLanguage] = useState<CodeLanguage>("typescript");
  const [draft, setDraft] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
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
  const [protection, setProtection] = useState<ProtectionState>(EMPTY_PROTECTION);
  const [protectionError, setProtectionError] = useState("");
  const [unlockCodeShown, setUnlockCodeShown] = useState("");
  const [receiptData, setReceiptData] = useState<{
    publicId: string;
    fingerprint: string;
    mask: string;
    hasFile: boolean;
    expiresAt: string | null;
    availableAt: string | null;
    maxReveals: number | null;
    algorithm: string;
    kdf: string;
    envelopeVersion: number;
  } | null>(null);

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
    if (newMode !== "markdown") setMarkdownView("edit");
    resetPrepared();
  }

  function handleLanguageChange(newLang: CodeLanguage) {
    setLanguage(newLang);
    resetPrepared();
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;
    for (const file of selected) {
      if (file.size > MAX_FILE_PLAINTEXT_BYTES) {
        setErrorMessage(`"${file.name}" is too large. Maximum size per file is 10 MB.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }
    setAttachedFiles((prev) => [...prev, ...selected].slice(0, 5));
    resetPrepared();
  }

  function handleRemoveFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
    resetPrepared();
  }

  function handleProtectionChange(next: ProtectionState) {
    setProtection(next);
    setProtectionError("");
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

    if (!draft.trim() && attachedFiles.length === 0) {
      setErrorMessage("Write some content or attach a file before creating a share.");
      return;
    }

    const draftBytes = new TextEncoder().encode(draft).length;
    if (draftBytes > MAX_CONTENT_BYTES) {
      setErrorMessage(`Content is too large for one share (${formatBytes(draftBytes)} of text, limit ${formatBytes(MAX_CONTENT_BYTES)}). Shorten the note or attach the rest as a file.`);
      return;
    }

    const wantsPassword = protection.password.length > 0;
    if (wantsPassword && protection.password !== protection.confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }
    const preparedFactors = prepareFactors({
      password: wantsPassword ? protection.password : undefined,
      enableUnlock: protection.enableUnlock,
    });
    const mask = preparedFactors.mask;

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

        const factorArgs = {
          mask,
          ...(preparedFactors.passwordSalt
            ? { passwordSalt: preparedFactors.passwordSalt, password: protection.password }
            : {}),
          unlockCode: preparedFactors.unlockCode ?? undefined,
        };
        const sealedContent = await sealContent(contentPayload, context, factorArgs);

        const stagedFiles: PreparedAttemptFile[] = [];
        for (const file of attachedFiles) {
          const buffer = await file.arrayBuffer();
          const sealed = await sealFile(
            {
              filename: file.name,
              mimeType: file.type || "application/octet-stream",
              data: new Uint8Array(buffer),
            },
            context,
            factorArgs
          );
          stagedFiles.push({ sealed, uploaded: false });
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
          passwordRequired: mask.includes("password"),
          unlockRequired: mask.includes("unlock"),
        };

        prepared = {
          context,
          sealedContent,
          files: stagedFiles,
          payload,
        };
        preparedRef.current = prepared;
      }

      // Staged uploads, one reservation + PUT per attachment slot. Each
      // uploaded flag persists in preparedRef so a retry never re-uploads.
      for (let index = 0; index < prepared.files.length; index += 1) {
        const entry = prepared.files[index];
        if (entry.uploaded) continue;

        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicId: prepared.context.publicId,
            idempotencyKeyHash: prepared.payload.idempotencyKeyHash,
            fileEnvelope: entry.sealed.envelope,
            expectedCiphertextSize: entry.sealed.ciphertextSize,
            attachmentSlot: index,
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
          body: new Blob([bytesToArrayBuffer(entry.sealed.ciphertext)], { type: "application/octet-stream" }),
        });

        if (!putRes.ok) {
          const putErr = await putRes.text().catch(() => "");
          console.error("[SecureBin] Storage upload failed:", putRes.status, putErr);
          throw new Error("storage_upload_failed");
        }

        prepared.files[index] = { sealed: entry.sealed, uploaded: true };
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
      setUnlockCodeShown(preparedFactors.unlockCode ?? "");
      setReceiptData({
        publicId: returnedPublicId,
        fingerprint: await digestCapability(prepared.sealedContent.envelope.ciphertext ?? ""),
        mask,
        hasFile: prepared.files.length > 0,
        availableAt: validated.availableAt,
        expiresAt: validated.expiresAt,
        maxReveals: validated.maxReveals,
        algorithm: prepared.sealedContent.envelope.algorithm,
        kdf: prepared.sealedContent.envelope.kdf,
        envelopeVersion: prepared.sealedContent.envelope.version,
      });

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
      setProtection(EMPTY_PROTECTION);
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
      updateShareInHistory(activePublicId, { status: "revoked", remainingReveals: null });
      if (onPhaseChange) onPhaseChange("unavailable");
    } catch {
      setRevokedMessage("The share could not be revoked. Try again.");
    } finally {
      setIsRevoking(false);
    }
  }

  function handleReset() {
    setUnlockCodeShown("");
    setReceiptData(null);
    setDraft("");
    setAttachedFiles([]);
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

        {unlockCodeShown && (
          <div className="unlock-code-box" role="status">
            <p className="unlock-heading">Second-channel unlock code</p>
            <p className="unlock-code">{unlockCodeShown}</p>
            <p className="policy-hint">
              Deliver this code over a different channel. It is shown once and is not stored on the server.
            </p>
          </div>
        )}

        {receiptData && <PrivacyReceipt data={receiptData} />}

        <ShareActions shareUrl={shareUrl} />

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
            {formatBytes(new TextEncoder().encode(draft).length)} / {formatBytes(MAX_CONTENT_BYTES)}
          </span>
        </div>

        {mode === "markdown" && (
          <div className="md-view-toggle" role="tablist" aria-label="Markdown editor view">
            <button
              type="button"
              role="tab"
              aria-selected={markdownView === "edit"}
              className={`md-view-option ${markdownView === "edit" ? "active" : ""}`}
              onClick={() => setMarkdownView("edit")}
            >
              Edit
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={markdownView === "split"}
              className={`md-view-option ${markdownView === "split" ? "active" : ""}`}
              onClick={() => setMarkdownView("split")}
            >
              Split
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={markdownView === "preview"}
              className={`md-view-option ${markdownView === "preview" ? "active" : ""}`}
              onClick={() => setMarkdownView("preview")}
            >
              Preview
            </button>
          </div>
        )}

        <div className={mode === "markdown" && markdownView === "split" ? "md-split" : undefined}>
          {(mode !== "markdown" || markdownView !== "preview") && (
            <>
              <label htmlFor="draft-textarea" className="sr-only">
                {mode === "note" ? "Note content" : mode === "markdown" ? "Markdown content" : "Code content"}
              </label>
              <textarea
                id="draft-textarea"
                className="composer-textarea"
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
            </>
          )}
          {mode === "markdown" && markdownView !== "edit" && (
            <div className="composer-md-preview" aria-label="Markdown preview">
              <MarkdownView markdown={draft} />
            </div>
          )}
        </div>

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
          {attachedFiles.length === 0 && (
            <button
              type="button"
              className="action-button secondary-button attach-file-btn"
              disabled={isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              Attach files (max 10 MB each, up to 5)
            </button>
          )}
          {attachedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="attached-file-badge" role="status">
              <span className="file-info-text">
                📎 <strong>{file.name}</strong> ({formatBytes(file.size)})
              </span>
              <button
                type="button"
                className="remove-file-button"
                disabled={isPending}
                onClick={() => handleRemoveFile(index)}
                aria-label={`Remove ${file.name}`}
              >
                ✕ Remove
              </button>
            </div>
          ))}
          <input
            type="file"
            ref={fileInputRef}
            id="file-attachment-input"
            aria-label="Attach files (max 10 MB each, up to 5)"
            className="sr-only"
            disabled={isPending}
            onChange={handleFileSelect}
            multiple
          />
        </div>

        <PolicyControls
          draft={policyDraft}
          disabled={isPending}
          onChange={handlePolicyChange}
        />

        <ProtectionControls
          value={protection}
          onChange={handleProtectionChange}
          disabled={isPending}
          error={protectionError}
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

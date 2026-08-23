"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import type { CodeLanguage } from "../../lib/crypto/payload";
import { MAX_FILE_PLAINTEXT_BYTES } from "../../lib/crypto/file";
import {
  defaultPolicyDraft,
  validatePolicyDraft,
  type PolicyDraft,
  type ProoflinePhase,
  type ValidatedPolicy,
} from "../../lib/shares/policy-ui";
import { updateShareInHistory } from "../../lib/shares/share-history";
import { ProtectionControls, EMPTY_PROTECTION, type ProtectionState } from "./protection-controls";
import type { PrivacyReceiptData } from "./privacy-receipt";
import { PolicyControls } from "./policy-controls";
import {
  buildContentPayload,
  prepareCreateAttempt,
  revokeShare,
  useStagedCreate,
} from "../hooks/use-staged-create";
import { ModeTabs, type ComposerMode } from "./composer/mode-tabs";
import { EditorPane, type MarkdownViewMode } from "./composer/editor-pane";
import { AttachmentZone } from "./composer/attachment-zone";
import { ShareResultCard } from "./composer/share-result-card";

export type { ComposerMode, MarkdownViewMode };

export interface ComposerProps {
  readonly onPhaseChange?: (phase: ProoflinePhase) => void;
  readonly onPolicyChange?: (policy: ValidatedPolicy) => void;
  readonly onShareCreated?: () => void;
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
  const [unlockCodeShown, setUnlockCodeShown] = useState("");
  const [receiptData, setReceiptData] = useState<PrivacyReceiptData | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { stage, discard } = useStagedCreate();

  function resetPrepared() {
    discard();
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

  function acceptFiles(candidates: File[]): boolean {
    for (const file of candidates) {
      if (file.size > MAX_FILE_PLAINTEXT_BYTES) {
        setErrorMessage(`"${file.name}" is too large. Maximum size per file is 10 MB.`);
        return false;
      }
    }
    setAttachedFiles((prev) => [...prev, ...candidates].slice(0, 5));
    resetPrepared();
    return true;
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;
    if (!acceptFiles(selected) && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRemoveFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
    resetPrepared();
  }

  function handleProtectionChange(next: ProtectionState) {
    setProtection(next);
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

    const attempt = prepareCreateAttempt({
      draft,
      hasFiles: attachedFiles.length > 0,
      protection,
      policyDraft,
    });
    if (!attempt.valid) {
      setErrorMessage(attempt.error);
      return;
    }

    setIsPending(true);
    setErrorMessage("");
    if (onPhaseChange) onPhaseChange("creating");

    try {
      const outcome = await stage({
        contentPayload: buildContentPayload(mode, draft, language),
        factorArgs: attempt.factorArgs,
        discussionCapability: null,
        files: attachedFiles,
        policy: attempt.policy,
        mask: attempt.mask,
      });

      setShareUrl(outcome.shareUrl);
      setActivePublicId(outcome.publicId);
      setActiveDeleteCapability(outcome.deleteCapability);
      setUnlockCodeShown(attempt.unlockCode);
      setReceiptData(outcome.receipt);

      discard();
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

    const revoked = await revokeShare(activePublicId, activeDeleteCapability);
    if (revoked) {
      setRevokedMessage("Share revoked. Future reveals are unavailable.");
      setShowRevokeConfirm(false);
      setActiveDeleteCapability(null);
      updateShareInHistory(activePublicId, { status: "revoked", remainingReveals: null });
      if (onPhaseChange) onPhaseChange("unavailable");
    } else {
      setRevokedMessage("The share could not be revoked. Try again.");
    }
    setIsRevoking(false);
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
    discard();
    if (onPhaseChange) onPhaseChange("draft");
  }

  if (shareUrl) {
    return (
      <ShareResultCard
        shareUrl={shareUrl}
        unlockCodeShown={unlockCodeShown}
        receiptData={receiptData}
        activeDeleteCapability={activeDeleteCapability}
        revokedMessage={revokedMessage}
        showRevokeConfirm={showRevokeConfirm}
        copyStatus={copyStatus}
        isRevoking={isRevoking}
        setShowRevokeConfirm={setShowRevokeConfirm}
        onCopyLink={handleCopyLink}
        onRevoke={handleRevoke}
        onReset={handleReset}
      />
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
        <ModeTabs
          mode={mode}
          language={language}
          draftByteCount={new TextEncoder().encode(draft).length}
          disabled={isPending}
          onModeChange={handleModeChange}
          onLanguageChange={handleLanguageChange}
        />

        <EditorPane
          mode={mode}
          markdownView={markdownView}
          draft={draft}
          disabled={isPending}
          onDraftChange={handleDraftChange}
          onMarkdownViewChange={setMarkdownView}
        />

        <AttachmentZone
          files={attachedFiles}
          disabled={isPending}
          inputRef={fileInputRef}
          onInputChange={handleFileSelect}
          onFilesDropped={acceptFiles}
          onRemoveFile={handleRemoveFile}
        />

        <PolicyControls
          draft={policyDraft}
          disabled={isPending}
          onChange={handlePolicyChange}
        />

        <ProtectionControls
          value={protection}
          onChange={handleProtectionChange}
          disabled={isPending}
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

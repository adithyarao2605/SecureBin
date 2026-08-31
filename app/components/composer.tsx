"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CodeLanguage } from "../../lib/crypto/payload";
import { DISCUSSION_CAPABILITY_BYTES } from "../../lib/crypto/payload";
import { MAX_FILE_PLAINTEXT_BYTES } from "../../lib/crypto/file";
import { randomBytes } from "../../lib/crypto/encoding";
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
  type CreateAttempt,
  type StagedCreateProgress,
} from "../hooks/use-staged-create";
import { ModeTabs, type ComposerMode } from "./composer/mode-tabs";
import { EditorPane, type MarkdownViewMode } from "./composer/editor-pane";
import { AttachmentZone } from "./composer/attachment-zone";
import { ShareResultCard } from "./composer/share-result-card";
import { detectCodeLanguage } from "../../lib/render/detect-language";

export type { ComposerMode, MarkdownViewMode };

export interface ComposerProps {
  readonly onPhaseChange?: (phase: ProoflinePhase) => void;
  readonly onPolicyChange?: (policy: ValidatedPolicy) => void;
  readonly onShareChange?: () => void;
}

const EXAMPLE_DRAFT = "Example handoff\n\nThis is sample text for trying SecureBin. Replace it with your own content before creating a share.";

function createFailureMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "rate_limited") {
    return "This share could not be created right now: too many requests. Wait a moment and try again.";
  }
  if (code === "conflict") {
    return "This share could not be created because the server rejected a conflicting retry. Try creating it again.";
  }
  if (code === "service_unavailable" || code === "Failed to fetch" || code === "NetworkError") {
    return "This share could not be created because a required service is unavailable. Your draft is still only on this device.";
  }
  if (code === "storage_upload_failed" || code === "upload_reservation_failed") {
    return "This share could not be created because an attachment upload failed. Check your connection and try again.";
  }
  return "This share could not be created. Your draft is still only on this device.";
}

export function Composer({ onPhaseChange, onPolicyChange, onShareChange }: ComposerProps = {}) {
  const [mode, setMode] = useState<ComposerMode>("note");
  const [markdownView, setMarkdownView] = useState<MarkdownViewMode>("edit");
  const [language, setLanguage] = useState<CodeLanguage>("plaintext");
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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [protection, setProtection] = useState<ProtectionState>(EMPTY_PROTECTION);
  const [enableDiscussion, setEnableDiscussion] = useState(false);
  const [unlockCodeShown, setUnlockCodeShown] = useState("");
  const [receiptData, setReceiptData] = useState<PrivacyReceiptData | null>(null);
  const [parcel, setParcel] = useState<Uint8Array | null>(null);
  const [attachmentProgress, setAttachmentProgress] = useState<StagedCreateProgress | null>(null);
  const languageWasExplicitlySelectedRef = useRef(false);
  const pasteDetectionUsedRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Discussion capability minted once per share attempt so a staged retry
  // reuses the identical capability and digest instead of invalidating the
  // already-sealed content frame.
  const discussionCapabilityRef = useRef<Uint8Array | null>(null);
  // Last valid attempt, reused until any composer input changes. Re-running
  // prepareCreateAttempt on a retry would mint a fresh unlock code that no
  // longer matches the already-sealed staged attempt.
  const lastAttemptRef = useRef<CreateAttempt | null>(null);
  const { stage, discard } = useStagedCreate();

  useEffect(() => {
    if (shareUrl || (!draft.trim() && attachedFiles.length === 0)) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [attachedFiles.length, draft, shareUrl]);

  const draftByteCount = useMemo(() => new TextEncoder().encode(draft).length, [draft]);
  const discussionEligible = policyDraft.maxReveals === null || policyDraft.maxReveals >= 3;

  useEffect(() => {
    if (!discussionEligible && enableDiscussion) {
      setEnableDiscussion(false);
      discussionCapabilityRef.current = null;
      discard();
      lastAttemptRef.current = null;
      setErrorMessage("");
    }
  }, [discard, discussionEligible, enableDiscussion]);

  useEffect(() => {
    // Desktop uses a side-by-side Markdown authoring view. Code mode is a
    // single editable IDE surface at every viewport.
    const desktop = window.matchMedia?.("(min-width: 768px)").matches ?? false;
    setMarkdownView(desktop ? "split" : "edit");
  }, []);

  function resetPrepared() {
    discard();
    lastAttemptRef.current = null;
    setErrorMessage("");
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    resetPrepared();
  }

  function handleLoadExample(): void {
    if (draft.trim() || attachedFiles.length > 0) {
      setErrorMessage("Clear the current draft before loading the example.");
      return;
    }
    setMode("note");
    setMarkdownView("edit");
    setDraft(EXAMPLE_DRAFT);
    setErrorMessage("");
    resetPrepared();
  }

  function handleModeChange(newMode: ComposerMode) {
    setMode(newMode);
    if (newMode !== "markdown") setMarkdownView("edit");
    resetPrepared();
  }

  function handleLanguageChange(newLang: CodeLanguage) {
    setLanguage(newLang);
    languageWasExplicitlySelectedRef.current = true;
    resetPrepared();
  }

  function handleCodePaste(value: string) {
    if (!value || languageWasExplicitlySelectedRef.current || pasteDetectionUsedRef.current) return;
    pasteDetectionUsedRef.current = true;
    setLanguage(detectCodeLanguage(value));
    resetPrepared();
  }

  function acceptFiles(candidates: File[]): boolean {
    for (const file of candidates) {
      if (file.size > MAX_FILE_PLAINTEXT_BYTES) {
        setErrorMessage(`"${file.name}" is too large. Maximum size per file is 10 MB.`);
        return false;
      }
    }
    const truncated = attachedFiles.length + candidates.length > 5;
    setAttachedFiles((prev) => [...prev, ...candidates].slice(0, 5));
    resetPrepared();
    if (truncated) {
      setErrorMessage("Up to 5 files per share — extra files were ignored.");
    }
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

    const cached = lastAttemptRef.current;
    const attempt =
      cached && cached.valid
        ? cached
        : prepareCreateAttempt({
            draft,
            hasFiles: attachedFiles.length > 0,
            protection,
            policyDraft,
          });
    if (!attempt.valid) {
      setErrorMessage(attempt.error);
      return;
    }
    lastAttemptRef.current = attempt;

    setIsPending(true);
    setAttachmentProgress(null);
    setErrorMessage("");
    if (onPhaseChange) onPhaseChange("creating");

    try {
      let capability = discussionCapabilityRef.current;
      if (enableDiscussion && !capability) {
        capability = randomBytes(DISCUSSION_CAPABILITY_BYTES);
        discussionCapabilityRef.current = capability;
      }
      const outcome = await stage({
        contentPayload: buildContentPayload(mode, draft, language),
        factors: attempt.factors,
        password: protection.password || undefined,
        discussionCapability: enableDiscussion ? capability : null,
        files: attachedFiles,
        policy: attempt.policy,
        mask: attempt.mask,
        onProgress: setAttachmentProgress,
      });

      setShareUrl(outcome.shareUrl);
      setActivePublicId(outcome.publicId);
      setActiveDeleteCapability(outcome.deleteCapability);
      // Show the code that sealed the share, not a freshly minted one.
      setUnlockCodeShown(outcome.unlockCode);
      setReceiptData(outcome.receipt);
      setParcel(outcome.parcel);

      discard();
      lastAttemptRef.current = null;
      setProtection(EMPTY_PROTECTION);
      if (onPhaseChange) onPhaseChange("created");
      if (onShareChange) onShareChange();
    } catch (error) {
      setErrorMessage(createFailureMessage(error));
      if (onPhaseChange) onPhaseChange("draft");
    } finally {
      setIsPending(false);
      setAttachmentProgress(null);
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("failed");
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
      if (onShareChange) onShareChange();
      if (onPhaseChange) onPhaseChange("unavailable");
    } else {
      setRevokedMessage("The share could not be revoked. Try again.");
    }
    setIsRevoking(false);
  }

  function handleReset() {
    setUnlockCodeShown("");
    setReceiptData(null);
    setParcel(null);
    setDraft("");
    setLanguage("plaintext");
    languageWasExplicitlySelectedRef.current = false;
    pasteDetectionUsedRef.current = false;
    setAttachedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShareUrl("");
    setActiveDeleteCapability(null);
    setActivePublicId(null);
    setShowRevokeConfirm(false);
    setRevokedMessage("");
    setCopyStatus("idle");
    setErrorMessage("");
    setEnableDiscussion(false);
    discussionCapabilityRef.current = null;
    discard();
    lastAttemptRef.current = null;
    if (onPhaseChange) onPhaseChange("draft");
  }

  if (shareUrl) {
    return (
      <ShareResultCard
        shareUrl={shareUrl}
        unlockCodeShown={unlockCodeShown}
        receiptData={receiptData}
        parcel={parcel}
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
        <div className="composer-heading-row">
          <h2 className="surface-heading" id="composer-heading">Create a private share</h2>
          <button type="button" className="composer-example-button" onClick={handleLoadExample} disabled={isPending}>Load safe example</button>
        </div>
        <p className="trust-line">Your browser encrypts this before it leaves the page.</p>
      </div>

      <form className="composer-form" onSubmit={createShare}>
        <ModeTabs
          mode={mode}
          language={language}
          draftByteCount={draftByteCount}
          disabled={isPending}
          onModeChange={handleModeChange}
          onLanguageChange={handleLanguageChange}
        />

        <EditorPane
          mode={mode}
          markdownView={markdownView}
          draft={draft}
          language={language}
          disabled={isPending}
          onDraftChange={handleDraftChange}
          onCodePaste={handleCodePaste}
          onMarkdownViewChange={setMarkdownView}
        />

        <AttachmentZone
          files={attachedFiles}
          disabled={isPending}
          inputRef={fileInputRef}
          progress={attachmentProgress}
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

        <fieldset className="collaboration-section">
          <legend>Collaboration</legend>
          <label className="policy-radio-label discussion-toggle">
            <input
              type="checkbox"
              checked={enableDiscussion}
              disabled={isPending || !discussionEligible}
              onChange={(e) => {
                setEnableDiscussion(e.target.checked);
                discussionCapabilityRef.current = null;
                resetPrepared();
              }}
            />
            <span>Enable encrypted discussion</span>
          </label>
          <p className="policy-hint">
            {discussionEligible
              ? "Revealed recipients can post encrypted replies. SecureBin does not provide activity or read receipts."
              : "Choose at least 3 reveals or Unlimited to enable encrypted discussion; one-time shares cannot support a thread."}
          </p>
        </fieldset>

        {errorMessage && (
          <div className="composer-error" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="composer-checklist" aria-label="Share readiness checklist">
          <p className="composer-checklist-heading">Ready when you are</p>
          <ul>
            <li className={draft.trim() || attachedFiles.length > 0 ? "complete" : ""}><span aria-hidden="true">✓</span> Add content or an attachment</li>
            <li className={validatePolicyDraft(policyDraft).valid ? "complete" : ""}><span aria-hidden="true">✓</span> Review the access policy</li>
            <li className={!protection.password || protection.password === protection.confirmPassword ? "complete" : ""}><span aria-hidden="true">✓</span> Confirm optional protection</li>
          </ul>
        </div>

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

"use client";

import { FormEvent, useRef, useState } from "react";
import { digestCapability, sealContent } from "../../lib/crypto/content";
import {
  defaultPolicyDraft,
  validatePolicyDraft,
  type PolicyDraft,
  type ProoflinePhase,
  type ValidatedPolicy,
} from "../../lib/shares/policy-ui";
import { saveShareToHistory } from "../../lib/shares/share-history";
import { PolicyControls } from "./policy-controls";

interface PreparedAttempt {
  readonly publicId: string;
  readonly linkSecret: string;
  readonly deleteCapability: string;
  readonly idempotencyKey: string;
  readonly payload: Record<string, unknown>;
}

export interface ComposerProps {
  readonly onPhaseChange?: (phase: ProoflinePhase) => void;
  readonly onPolicyChange?: (policy: ValidatedPolicy) => void;
  readonly onShareCreated?: () => void;
}

export function Composer({ onPhaseChange, onPolicyChange, onShareCreated }: ComposerProps = {}) {
  const [draft, setDraft] = useState("");
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

  const preparedRef = useRef<PreparedAttempt | null>(null);

  function handleDraftChange(value: string) {
    setDraft(value);
    preparedRef.current = null;
    setErrorMessage("");
  }

  function handlePolicyChange(updated: PolicyDraft) {
    setPolicyDraft(updated);
    preparedRef.current = null;
    setErrorMessage("");
    if (onPolicyChange) {
      onPolicyChange(validatePolicyDraft(updated));
    }
  }

  async function createShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    if (!draft.trim()) {
      setErrorMessage("Write a note before creating a share.");
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
        const sealed = await sealContent(draft);
        const [deleteTokenHash, idempotencyKeyHash] = await Promise.all([
          digestCapability(sealed.deleteCapability),
          digestCapability(sealed.idempotencyKey),
        ]);

        const payload = {
          publicId: sealed.publicId,
          contentEnvelope: sealed.envelope,
          policy: {
            availableAt: validated.availableAt,
            expiresAt: validated.expiresAt,
            maxReveals: validated.maxReveals,
          },
          deleteTokenHash,
          idempotencyKeyHash,
          passwordRequired: false,
          unlockRequired: false,
        };

        prepared = {
          publicId: sealed.publicId,
          linkSecret: sealed.linkSecret,
          deleteCapability: sealed.deleteCapability,
          idempotencyKey: sealed.idempotencyKey,
          payload,
        };
        preparedRef.current = prepared;
      }

      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepared.payload),
      });

      if (!response.ok) {
        throw new Error("create_failed");
      }

      const result = (await response.json()) as { publicId?: unknown };
      const returnedPublicId = typeof result.publicId === "string" ? result.publicId : prepared.publicId;
      const origin = window.location.origin;
      const fullUrl = `${origin}/s/${encodeURIComponent(returnedPublicId)}#${prepared.linkSecret}`;

      setShareUrl(fullUrl);
      setActivePublicId(returnedPublicId);
      setActiveDeleteCapability(prepared.deleteCapability);

      saveShareToHistory({
        publicId: returnedPublicId,
        shareUrl: fullUrl,
        createdAt: new Date().toISOString(),
        expiresAt: validated.expiresAt,
        availableAt: validated.availableAt,
        maxReveals: validated.maxReveals,
        deleteCapability: prepared.deleteCapability,
        status: "active",
        remainingReveals: validated.maxReveals,
      });

      preparedRef.current = null;
      if (onPhaseChange) onPhaseChange("created");
      if (onShareCreated) onShareCreated();
    } catch {
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
              aria-selected={true}
              className="mode-tab active"
            >
              Plain note
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={false}
              aria-disabled={true}
              disabled
              className="mode-tab disabled"
            >
              Markdown · unavailable
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={false}
              aria-disabled={true}
              disabled
              className="mode-tab disabled"
            >
              Code · unavailable
            </button>
          </div>
          <span className="character-count" aria-live="polite">
            {draft.length.toLocaleString()} / 524,288
          </span>
        </div>

        <label htmlFor="draft-textarea" className="sr-only">
          Note content
        </label>
        <textarea
          id="draft-textarea"
          className="composer-textarea"
          maxLength={524288}
          placeholder="Write something only the recipient should read…"
          value={draft}
          disabled={isPending}
          onChange={(e) => handleDraftChange(e.target.value)}
        />

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

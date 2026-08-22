"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { openContent } from "../../../lib/crypto/content";
import { bytesToBase64Url, randomBytes } from "../../../lib/crypto/encoding";
import {
  type ContentEnvelope,
  type FileEnvelope,
  validateContentEnvelope,
  validateFileEnvelope,
  validateLinkSecret,
  validatePublicId,
} from "../../../lib/crypto/envelope";
import { openFile, type FilePayload } from "../../../lib/crypto/file";
import type { ContentPayload } from "../../../lib/crypto/payload";
import { isMaxReveals, type MaxReveals } from "../../../lib/shares/contracts";
import { formatLocalizedDateTime, type ProoflinePhase } from "../../../lib/shares/policy-ui";
import { CodeView } from "../../components/code-view";
import { FilePreview } from "../../components/file-preview";
import { MarkdownView } from "../../components/markdown-view";
import { Proofline } from "../../components/proofline";

type ActiveStatus = {
  status: "active";
  availableAt: string | null;
  expiresAt: string;
  maxReveals: MaxReveals;
  remainingReveals: number | null;
  passwordRequired: boolean;
  unlockRequired: boolean;
};

type ScheduledStatus = {
  status: "scheduled";
  availableAt: string;
  expiresAt: string;
  maxReveals: MaxReveals;
  remainingReveals: number | null;
  passwordRequired: boolean;
  unlockRequired: boolean;
};

type ShareStatus = ActiveStatus | ScheduledStatus | { status: "unavailable" };

interface ParsedReveal {
  readonly contentEnvelope: ContentEnvelope;
  readonly file: {
    readonly envelope: FileEnvelope;
    readonly ciphertextSize: number;
    readonly downloadUrl: string;
  } | null;
  readonly retryExpiresAt: string;
}

class ViewerPayloadError extends Error {}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ViewerPayloadError();
  }
}

function hasOnlyKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[]) {
  const allowed = new Set([...required, ...optional]);
  if (!required.every((k) => k in value) || !Object.keys(value).every((k) => allowed.has(k))) {
    throw new ViewerPayloadError();
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRevealCounters(value: Record<string, unknown>): {
  maxReveals: MaxReveals;
  remainingReveals: number | null;
} {
  if (!isMaxReveals(value.maxReveals)) throw new ViewerPayloadError();
  const remainingReveals = value.remainingReveals;
  if (value.maxReveals === null) {
    if (remainingReveals !== null) throw new ViewerPayloadError();
    return { maxReveals: null, remainingReveals: null };
  }
  if (
    typeof remainingReveals !== "number" ||
    !Number.isInteger(remainingReveals) ||
    remainingReveals < 0 ||
    remainingReveals > value.maxReveals
  ) {
    throw new ViewerPayloadError();
  }
  return { maxReveals: value.maxReveals, remainingReveals };
}

function parseStatus(value: unknown): ShareStatus {
  if (!record(value)) throw new ViewerPayloadError();
  if (value.status === "unavailable") {
    exactKeys(value, ["status"]);
    return { status: "unavailable" };
  }

  if (value.status === "scheduled") {
    exactKeys(value, [
      "availableAt",
      "expiresAt",
      "maxReveals",
      "passwordRequired",
      "remainingReveals",
      "status",
      "unlockRequired",
    ]);
    if (
      typeof value.availableAt !== "string" ||
      typeof value.expiresAt !== "string" ||
      typeof value.passwordRequired !== "boolean" ||
      typeof value.unlockRequired !== "boolean"
    ) {
      throw new ViewerPayloadError();
    }
    const counters = parseRevealCounters(value);
    return {
      status: "scheduled",
      availableAt: value.availableAt,
      expiresAt: value.expiresAt,
      ...counters,
      passwordRequired: value.passwordRequired,
      unlockRequired: value.unlockRequired,
    };
  }

  if (value.status !== "active") {
    throw new ViewerPayloadError();
  }

  exactKeys(value, [
    "availableAt",
    "expiresAt",
    "maxReveals",
    "passwordRequired",
    "remainingReveals",
    "status",
    "unlockRequired",
  ]);
  if (
    (value.availableAt !== null && typeof value.availableAt !== "string") ||
    typeof value.expiresAt !== "string" ||
    typeof value.passwordRequired !== "boolean" ||
    typeof value.unlockRequired !== "boolean"
  ) {
    throw new ViewerPayloadError();
  }
  const counters = parseRevealCounters(value);
  return {
    status: "active",
    availableAt: value.availableAt,
    expiresAt: value.expiresAt,
    ...counters,
    passwordRequired: value.passwordRequired,
    unlockRequired: value.unlockRequired,
  };
}

function parseReveal(value: unknown): ParsedReveal {
  if (!record(value)) throw new ViewerPayloadError();
  hasOnlyKeys(value, ["contentEnvelope", "retryExpiresAt", "status"], ["file"]);
  if (value.status !== "authorized" || typeof value.retryExpiresAt !== "string") {
    throw new ViewerPayloadError();
  }
  const contentEnvelope = validateContentEnvelope(value.contentEnvelope);

  let fileMetadata: ParsedReveal["file"] = null;
  if (value.file !== undefined && value.file !== null) {
    if (!record(value.file)) throw new ViewerPayloadError();
    exactKeys(value.file, ["ciphertextSize", "downloadUrl", "envelope"]);
    if (typeof value.file.ciphertextSize !== "number" || typeof value.file.downloadUrl !== "string") {
      throw new ViewerPayloadError();
    }
    const fileEnvelope = validateFileEnvelope(value.file.envelope);
    fileMetadata = {
      envelope: fileEnvelope,
      ciphertextSize: value.file.ciphertextSize,
      downloadUrl: value.file.downloadUrl,
    };
  }

  return {
    contentEnvelope,
    file: fileMetadata,
    retryExpiresAt: value.retryExpiresAt,
  };
}

export type ViewerState =
  | "checking"
  | "incomplete"
  | "network_error"
  | "scheduled"
  | "ready_unlimited"
  | "ready_limited"
  | "confirming"
  | "pending"
  | "opened"
  | "unavailable";

export function Viewer({ publicId }: { publicId: string }) {
  const [state, setState] = useState<ViewerState>("checking");
  const [shareStatus, setShareStatus] = useState<ShareStatus | null>(null);
  const [linkSecret, setLinkSecret] = useState<string | null>(null);
  const [content, setContent] = useState<ContentPayload | null>(null);
  const [attachedFile, setAttachedFile] = useState<FilePayload | null>(null);
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [unlockInput, setUnlockInput] = useState("");
  const [factorsProvided, setFactorsProvided] = useState(false);
  const [factorError, setFactorError] = useState("");
  const requestTokenRef = useRef<string | null>(null);
  const revealInFlightRef = useRef(false);

  function clearNotice() {
    setNotice("");
  }

  /** A protected share keeps its factor gate up until factors are submitted. */
  function factorsNeeded(status: ShareStatus): boolean {
    return (
      status.status === "active" &&
      (status.passwordRequired || status.unlockRequired) &&
      !factorsProvided
    );
  }

  function currentFactorOptions() {
    if (!shareStatus || shareStatus.status !== "active") return undefined;
    if (!shareStatus.passwordRequired && !shareStatus.unlockRequired) return undefined;
    if (!factorsProvided) return undefined;
    return {
      mask: shareStatus.passwordRequired && shareStatus.unlockRequired
        ? ("link+password+unlock" as const)
        : shareStatus.passwordRequired
        ? ("link+password" as const)
        : ("link+unlock" as const),
      password: shareStatus.passwordRequired ? passwordInput : undefined,
      unlockCode: shareStatus.unlockRequired ? unlockInput.trim() : undefined,
    };
  }

  function submitFactors() {
    if (!shareStatus || shareStatus.status !== "active") return;
    if (shareStatus.passwordRequired && passwordInput.length === 0) {
      setFactorError("Enter the password.");
      return;
    }
    if (shareStatus.unlockRequired && unlockInput.trim().length === 0) {
      setFactorError("Enter the unlock code.");
      return;
    }
    setFactorError("");
    setFactorsProvided(true);
    setNotice("");
  }

  function clearRequestToken() {
    requestTokenRef.current = null;
    setRequestToken(null);
  }

  async function checkShare(quiet = false) {
    if (!quiet) setState("checking");
    try {
      validatePublicId(publicId);
      const fragment = window.location.hash.slice(1);
      if (!fragment) {
        setState("incomplete");
        return;
      }
      validateLinkSecret(fragment);
      setLinkSecret(fragment);

      const response = await fetch(`/api/shares/${encodeURIComponent(publicId)}/status`, {
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 404) {
          setState("unavailable");
          setShareStatus({ status: "unavailable" });
          return;
        }
        setState("network_error");
        return;
      }

      const status = parseStatus(await response.json());
      setShareStatus(status);

      if (status.status === "unavailable") {
        setState("unavailable");
      } else if (status.status === "scheduled") {
        setState("scheduled");
      } else if (status.maxReveals === null) {
        setState("ready_unlimited");
      } else if (state !== "opened") {
        // A quiet refresh must not yank the recipient out of the opened view.
        setState("ready_limited");
      }
    } catch {
      // Transport or payload failure is retryable; only the server's own
      // unavailable verdict may end the session. A quiet refresh keeps the
      // current view rather than forcing a retry screen.
      if (!quiet) setState("network_error");
    }
  }

  useEffect(() => {
    void checkShare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicId]);

  // Scheduled shares re-check when their availability time arrives instead of
  // leaving the recipient stuck on a static message.
  useEffect(() => {
    if (state !== "scheduled" || shareStatus?.status !== "scheduled") return;
    const delay = Math.min(
      Math.max(Date.parse(shareStatus.availableAt) + 1000 - Date.now(), 1000),
      60 * 60 * 1000
    );
    const timer = setTimeout(() => void checkShare(true), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, shareStatus]);

  async function handleReveal() {
    if (
      revealInFlightRef.current ||
      state === "pending" ||
      !linkSecret ||
      !shareStatus ||
      shareStatus.status !== "active"
    ) {
      return;
    }

    if (shareStatus.passwordRequired || shareStatus.unlockRequired) {
      if (!factorsProvided || factorsNeeded(shareStatus)) {
        submitFactors();
        return;
      }
    }
    if (state === "ready_limited") {
      setState("confirming");
      return;
    }

    const token = requestTokenRef.current ?? bytesToBase64Url(randomBytes(32));
    requestTokenRef.current = token;
    if (requestToken !== token) setRequestToken(token);

    revealInFlightRef.current = true;
    setState("pending");
    try {
      const response = await fetch(`/api/shares/${encodeURIComponent(publicId)}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestToken: token }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          setState("unavailable");
          clearRequestToken();
          return;
        }
        setNotice("The reveal could not be completed. Retrying with the same authorization…");
        setState(shareStatus.maxReveals === null ? "ready_unlimited" : "ready_limited");
        return;
      }

      const revealPayload = parseReveal(await response.json());
      const plaintext = await openContent(
        revealPayload.contentEnvelope,
        publicId,
        linkSecret,
        currentFactorOptions()
      );

      let decryptedAttachment: FilePayload | null = null;
      if (revealPayload.file) {
        const fileRes = await fetch(revealPayload.file.downloadUrl, {
          cache: "no-store",
        });
        if (!fileRes.ok) {
          throw new Error("file_download_failed");
        }
        const arrayBuf = await fileRes.arrayBuffer();
        const downloadedBytes = new Uint8Array(arrayBuf);
        if (downloadedBytes.length !== revealPayload.file.ciphertextSize) {
          throw new Error("file_size_mismatch");
        }
        decryptedAttachment = await openFile(
          revealPayload.file.envelope,
          downloadedBytes,
          publicId,
          linkSecret,
          currentFactorOptions()
        );
      }

      setContent(plaintext);
      setAttachedFile(decryptedAttachment);
      setState("opened");
      clearRequestToken();
      setPasswordInput("");
      setUnlockInput("");
    } catch {
      // Return to the ready panel immediately, surface what happened, then
      // quietly refresh authoritative counters (a consumed lease shows there).
      setState(shareStatus.maxReveals === null ? "ready_unlimited" : "ready_limited");
      // A decryption failure usually means a wrong factor: reopen the gate
      // with the previous entries kept for editing.
      if (shareStatus.passwordRequired || shareStatus.unlockRequired) {
        setFactorsProvided(false);
      }
      setFactorError("");
      setNotice(
        shareStatus.maxReveals === null
          ? "This reveal attempt failed. Check your connection and try again."
          : "This reveal attempt failed. The counts below show whether an authorization was consumed."
      );
      void checkShare(true);
    } finally {
      revealInFlightRef.current = false;
    }
  }

  const prooflinePhase: ProoflinePhase = useMemo(() => {
    switch (state) {
      case "checking":
        return "draft";
      case "incomplete":
      case "network_error":
      case "scheduled":
      case "ready_unlimited":
      case "ready_limited":
      case "confirming":
        return "created";
      case "pending":
        return "creating";
      case "opened":
        return "opened";
      case "unavailable":
        return "unavailable";
    }
  }, [state]);

  return (
    <main className="view-shell" role="main">
      <header className="brand-header">
        <h1 className="brand-title">SecureBin</h1>
        <p className="brand-subtitle">Zero-knowledge secure sharing</p>
      </header>

      <section className="evidence-rail" aria-label="Evidence rail">
        <Proofline phase={prooflinePhase} />
      </section>

      <div className="surface-card viewer-card">
        <div className="viewer-header">
          <h2 className="surface-heading">Decrypted share</h2>
          <p className="trust-line">Decrypted in your browser using the link fragment.</p>
        </div>

        {notice && state !== "opened" && (
          <div role="status">
            <p className="viewer-status-text">{notice}</p>
            <button type="button" className="action-button tertiary-button" onClick={clearNotice}>
              Dismiss
            </button>
          </div>
        )}

        {state === "checking" && (
          <div className="viewer-message-box" role="status">
            <p className="viewer-status-text">Checking share availability…</p>
          </div>
        )}

        {state === "incomplete" && (
          <div className="viewer-message-box" role="alert">
            <p className="viewer-status-text">
              The link is missing its decryption key. Ask the sender for the complete link with fragment.
            </p>
          </div>
        )}

        {state === "network_error" && (
          <div className="viewer-message-box" role="alert">
            <p className="viewer-status-text">
              Could not reach the server to verify this share.
            </p>
            <button
              type="button"
              className="action-button secondary-button"
              onClick={() => void checkShare()}
            >
              Retry
            </button>
          </div>
        )}

        {state === "scheduled" && shareStatus && shareStatus.status === "scheduled" && (
          <div className="viewer-message-box" role="status">
            <p className="viewer-status-text">
              This share is scheduled to unlock at {formatLocalizedDateTime(shareStatus.availableAt)}.
            </p>
          </div>
        )}

        {state === "ready_unlimited" && shareStatus && shareStatus.status === "active" && factorsNeeded(shareStatus) && (
          <div className="viewer-action-box factor-box">
            <p className="viewer-status-text">This share is protected. Enter the required details to continue.</p>
            {shareStatus.passwordRequired && (
              <div className="policy-input-group">
                <label htmlFor="viewer-password" className="policy-input-label">
                  Password
                </label>
                <input
                  id="viewer-password"
                  type="password"
                  autoComplete="off"
                  className="policy-number-input"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
              </div>
            )}
            {shareStatus.unlockRequired && (
              <div className="policy-input-group">
                <label htmlFor="viewer-unlock" className="policy-input-label">
                  Unlock code (sent over a separate channel)
                </label>
                <input
                  id="viewer-unlock"
                  className="policy-number-input"
                  autoComplete="off"
                  spellCheck={false}
                  value={unlockInput}
                  onChange={(e) => setUnlockInput(e.target.value)}
                />
              </div>
            )}
            {factorError && (
              <p className="viewer-status-text" role="alert">
                {factorError}
              </p>
            )}
            <button type="button" className="action-button primary-button" onClick={submitFactors}>
              Continue
            </button>
          </div>
        )}

        {state === "ready_unlimited" && shareStatus && shareStatus.status === "active" && !factorsNeeded(shareStatus) && (
          <div className="viewer-action-box">
            <div className="viewer-policy-meta">
              <span className="policy-badge">Expires {formatLocalizedDateTime(shareStatus.expiresAt)}</span>
            </div>
            <p className="viewer-status-text">Ready to reveal.</p>
            <button
              type="button"
              className="action-button primary-button"
              onClick={() => void handleReveal()}
            >
              Reveal
            </button>
          </div>
        )}

        {state === "ready_limited" && shareStatus && shareStatus.status === "active" && !factorsNeeded(shareStatus) && (
          <div className="viewer-action-box">
            <div className="viewer-policy-meta">
              <span className="policy-badge">
                {shareStatus.remainingReveals} / {shareStatus.maxReveals} reveals remaining
              </span>
              <span className="policy-badge">Expires {formatLocalizedDateTime(shareStatus.expiresAt)}</span>
            </div>
            <p className="viewer-status-text">
              This share has a reveal limit. Revealing will consume one count.
            </p>
            <button
              type="button"
              className="action-button primary-button"
              onClick={() => {
                clearNotice();
                void handleReveal();
              }}
            >
              Reveal
            </button>
          </div>
        )}

        {state === "confirming" && shareStatus && shareStatus.status === "active" && !factorsNeeded(shareStatus) && (
          <div className="viewer-action-box confirm-box" role="alert">
            <p className="viewer-status-text confirm-text">
              Consuming this reveal cannot be undone. Do you want to open it now?
            </p>
            <div className="confirm-actions-row">
              <button
                type="button"
                className="action-button primary-button"
                onClick={() => void handleReveal()}
              >
                Yes, reveal now
              </button>
              <button
                type="button"
                className="action-button secondary-button"
                onClick={() => setState("ready_limited")}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {state === "pending" && (
          <div className="viewer-action-box">
            <p className="viewer-status-text" role="status" aria-live="polite">
              Authorizing one reveal…
            </p>
            <button type="button" className="action-button primary-button" disabled>
              Opening…
            </button>
          </div>
        )}

        {state === "opened" && content !== null && (
          <div className="viewer-opened-box">
            <p className="viewer-success-note">
              Opened locally. The server released ciphertext; this browser did the decryption.
            </p>

            {content.text && (
              <div className="decrypted-content-container">
                {content.mode === "note" && (
                  <article className="decrypted-content-box" aria-label="Decrypted note">
                    <pre className="decrypted-text">{content.text}</pre>
                  </article>
                )}

                {content.mode === "markdown" && (
                  <MarkdownView markdown={content.text} />
                )}

                {content.mode === "code" && (
                  <CodeView code={content.text} language={content.language} />
                )}
              </div>
            )}

            {attachedFile && (
              <FilePreview file={attachedFile} />
            )}
          </div>
        )}

        {state === "unavailable" && (
          <div className="viewer-message-box" role="alert">
            <p className="viewer-status-text">
              This share is no longer available. Ask the sender for a new link.
            </p>
          </div>
        )}

        <div className="viewer-footer">
          <p className="public-id-tag">
            Public ID: <code>{publicId}</code>
          </p>
        </div>
      </div>
    </main>
  );
}

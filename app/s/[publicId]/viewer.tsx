"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { openContent } from "../../../lib/crypto/content";
import { base64UrlToBytes, bytesToBase64Url, randomBytes } from "../../../lib/crypto/encoding";
import { validateLinkSecret, validatePublicId } from "../../../lib/crypto/envelope";
import { openFile } from "../../../lib/crypto/file";
import type { ContentPayload } from "../../../lib/crypto/payload";
import { mergeShareStatuses, loadShareHistory } from "../../../lib/shares/share-history";
import { parseStatusBatchResponse } from "../../../lib/shares/contracts";
import {
  parseReveal,
  parseStatus,
  prooflinePhaseFor,
  type ShareStatus,
  type ViewerState,
} from "./viewer-contracts";
import { type DecryptedAttachment } from "./revealed-content";
import { ViewerView } from "./viewer-parts/viewer-view";

export type { ViewerState };

async function refreshLocalHistoryStatus(publicId: string): Promise<void> {
  if (!loadShareHistory().some((item) => item.publicId === publicId)) return;
  try {
    const response = await fetch("/api/shares/status-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicIds: [publicId] }),
      cache: "no-store",
    });
    if (!response.ok) return;
    const statuses = parseStatusBatchResponse(await response.json());
    if (statuses) mergeShareStatuses(statuses);
  } catch {
    // The desk refreshes again when it becomes visible.
  }
}

export function Viewer({ publicId }: { publicId: string }) {
  const [state, setState] = useState<ViewerState>("checking");
  const [shareStatus, setShareStatus] = useState<ShareStatus | null>(null);
  const [linkSecret, setLinkSecret] = useState<string | null>(null);
  const [content, setContent] = useState<ContentPayload | null>(null);
  const [attachments, setAttachments] = useState<DecryptedAttachment[]>([]);
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [unlockInput, setUnlockInput] = useState("");
  const [factorsProvided, setFactorsProvided] = useState(false);
  const [factorError, setFactorError] = useState("");
  const [discussionCapability, setDiscussionCapability] = useState<Uint8Array | null>(null);
  const [discussionSalt, setDiscussionSalt] = useState<Uint8Array | null>(null);
  const [releaseWindowEndsAt, setReleaseWindowEndsAt] = useState<string | null>(null);
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
          setDiscussionCapability(null);
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
          setDiscussionCapability(null);
          return;
        }
        setNotice("The reveal could not be completed. Retrying with the same authorization…");
        setState(shareStatus.maxReveals === null ? "ready_unlimited" : "ready_limited");
        return;
      }

      const revealPayload = parseReveal(await response.json());
      void refreshLocalHistoryStatus(publicId);
      const plaintext = await openContent(
        revealPayload.contentEnvelope,
        publicId,
        linkSecret,
        currentFactorOptions()
      );

      const decryptedFiles: DecryptedAttachment[] = [];
      for (const fileMeta of revealPayload.files ?? []) {
        const fileRes = await fetch(fileMeta.downloadUrl, { cache: "no-store" });
        if (!fileRes.ok) throw new Error("file_download_failed");
        const arrayBuf = await fileRes.arrayBuffer();
        const downloadedBytes = new Uint8Array(arrayBuf);
        if (downloadedBytes.length !== fileMeta.ciphertextSize) throw new Error("file_size_mismatch");
        const payload = await openFile(
          fileMeta.envelope,
          downloadedBytes,
          publicId,
          linkSecret,
          currentFactorOptions()
        );
        decryptedFiles.push({ name: payload.filename, payload });
      }

      setContent(plaintext);
      setAttachments(decryptedFiles);
      setReleaseWindowEndsAt(revealPayload.releaseWindowEndsAt);
      if (plaintext.discussionCapability) {
        setDiscussionCapability(plaintext.discussionCapability);
        setDiscussionSalt(base64UrlToBytes(revealPayload.contentEnvelope.hkdfSalt));
      } else {
        setDiscussionCapability(null);
      }
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

  const prooflinePhase = useMemo(() => prooflinePhaseFor(state), [state]);

  return (
    <ViewerView
      publicId={publicId}
      state={state}
      shareStatus={shareStatus}
      content={content}
      attachments={attachments}
      prooflinePhase={prooflinePhase}
      notice={notice}
      onDismissNotice={clearNotice}
      onRetry={() => void checkShare()}
      factorsNeeded={shareStatus !== null && factorsNeeded(shareStatus)}
      passwordValue={passwordInput}
      unlockValue={unlockInput}
      onPasswordChange={setPasswordInput}
      onUnlockChange={setUnlockInput}
      factorError={factorError}
      onSubmitFactors={submitFactors}
      onReveal={() => void handleReveal()}
      onCancelConfirm={() => setState("ready_limited")}
      discussionCapability={discussionCapability}
      discussionSalt={discussionSalt}
      discussionMask={currentFactorOptions()?.mask ?? "link"}
      releaseWindowEndsAt={releaseWindowEndsAt}
    />
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { openContent } from "../../../lib/crypto/content";
import { bytesToBase64Url, randomBytes } from "../../../lib/crypto/encoding";
import {
  type ContentEnvelope,
  validateContentEnvelope,
  validateLinkSecret,
  validatePublicId,
} from "../../../lib/crypto/envelope";
import { isMaxReveals, type MaxReveals } from "../../../lib/shares/contracts";
import { formatLocalizedDateTime, type ProoflinePhase } from "../../../lib/shares/policy-ui";
import { Proofline } from "../../components/proofline";

type ActiveStatus = {
  status: "active";
  availableAt: string | null;
  expiresAt: string;
  maxReveals: MaxReveals;
  remainingReveals: number | null;
  passwordRequired: false;
  unlockRequired: false;
};

type ScheduledStatus = {
  status: "scheduled";
  availableAt: string;
  expiresAt: string;
  maxReveals: MaxReveals;
  remainingReveals: number | null;
  passwordRequired: false;
  unlockRequired: false;
};

type ShareStatus = ActiveStatus | ScheduledStatus | { status: "unavailable" };

class ViewerPayloadError extends Error {}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
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
  if (!record(value) || typeof value.status !== "string") throw new ViewerPayloadError();
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
      value.passwordRequired !== false ||
      value.unlockRequired !== false
    ) {
      throw new ViewerPayloadError();
    }
    const counters = parseRevealCounters(value);
    return {
      status: "scheduled",
      availableAt: value.availableAt,
      expiresAt: value.expiresAt,
      ...counters,
      passwordRequired: false,
      unlockRequired: false,
    };
  }
  if (value.status !== "active") throw new ViewerPayloadError();
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
    typeof value.expiresAt !== "string" ||
    (value.availableAt !== null && typeof value.availableAt !== "string") ||
    value.passwordRequired !== false ||
    value.unlockRequired !== false
  ) {
    throw new ViewerPayloadError();
  }
  const counters = parseRevealCounters(value);
  return {
    status: "active",
    availableAt: value.availableAt,
    expiresAt: value.expiresAt,
    ...counters,
    passwordRequired: false,
    unlockRequired: false,
  };
}

function parseReveal(value: unknown): ContentEnvelope {
  if (!record(value)) throw new ViewerPayloadError();
  exactKeys(value, ["contentEnvelope", "retryExpiresAt", "status"]);
  if (value.status !== "authorized" || typeof value.retryExpiresAt !== "string") {
    throw new ViewerPayloadError();
  }
  return validateContentEnvelope(value.contentEnvelope);
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
  const [content, setContent] = useState<string | null>(null);
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const requestTokenRef = useRef<string | null>(null);
  const revealInFlightRef = useRef(false);

  function clearRequestToken() {
    requestTokenRef.current = null;
    setRequestToken(null);
  }

  async function checkShare() {
    setState("checking");
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
      } else {
        setState("ready_limited");
      }
    } catch {
      setState("unavailable");
      setShareStatus({ status: "unavailable" });
    }
  }

  useEffect(() => {
    void checkShare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicId]);

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
        setState(shareStatus.maxReveals === null ? "ready_unlimited" : "ready_limited");
        return;
      }

      const envelope = parseReveal(await response.json());
      const plaintext = await openContent(envelope, publicId, linkSecret);
      setContent(plaintext);
      setState("opened");
      clearRequestToken();
    } catch {
      setState(shareStatus.maxReveals === null ? "ready_unlimited" : "ready_limited");
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
      case "unavailable":
        return "unavailable";
      case "scheduled":
        return "scheduled";
      case "ready_unlimited":
      case "ready_limited":
      case "confirming":
        return "ready";
      case "pending":
        return "revealing";
      case "opened":
        return "opened";
    }
  }, [state]);

  return (
    <main className="viewer-shell" aria-labelledby="viewer-heading">
      <div className="viewer-header">
        <Proofline phase={prooflinePhase} compact />
      </div>

      <div className="surface-card viewer-card">
        <h1 id="viewer-heading" className="surface-heading">
          {state === "opened" ? "Decrypted note" : "View private share"}
        </h1>

        {state === "checking" && (
          <p className="viewer-status-text" role="status" aria-live="polite">
            Checking this share…
          </p>
        )}

        {state === "incomplete" && (
          <div className="viewer-message-box" role="alert">
            <p className="viewer-status-text">
              This link is incomplete. Ask the sender for the full link.
            </p>
          </div>
        )}

        {state === "network_error" && (
          <div className="viewer-message-box" role="alert">
            <p className="viewer-status-text">We could not check this share.</p>
            <button
              type="button"
              className="action-button primary-button"
              onClick={() => void checkShare()}
            >
              Try again
            </button>
          </div>
        )}

        {state === "scheduled" && shareStatus?.status === "scheduled" && (
          <div className="viewer-message-box" role="status">
            <p className="viewer-status-text">
              This share becomes available {formatLocalizedDateTime(shareStatus.availableAt)}.
            </p>
          </div>
        )}

        {state === "ready_unlimited" && (
          <div className="viewer-action-box">
            <p className="viewer-status-text">Ready to reveal</p>
            <button
              type="button"
              className="action-button primary-button"
              onClick={() => void handleReveal()}
            >
              Reveal
            </button>
          </div>
        )}

        {state === "ready_limited" && (
          <div className="viewer-action-box">
            <p className="viewer-status-text">This authorizes one ciphertext release.</p>
            <button
              type="button"
              className="action-button primary-button"
              onClick={() => void handleReveal()}
            >
              Reveal once
            </button>
          </div>
        )}

        {state === "confirming" && (
          <div className="viewer-confirm-box" role="alert">
            <p className="viewer-confirm-text">
              Continue? This cannot restore the consumed authorization.
            </p>
            <div className="viewer-confirm-actions">
              <button
                type="button"
                className="action-button primary-button"
                onClick={() => void handleReveal()}
              >
                Continue
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
            <article className="decrypted-content-box" aria-label="Decrypted note">
              <pre className="decrypted-text">{content}</pre>
            </article>
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

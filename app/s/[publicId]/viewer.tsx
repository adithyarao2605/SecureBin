"use client";

import { useEffect, useMemo, useState } from "react";
import { bytesToBase64Url, randomBytes } from "../../../lib/crypto/encoding";
import { openContent } from "../../../lib/crypto/content";
import { validateContentEnvelope, validateLinkSecret, validatePublicId } from "../../../lib/crypto/envelope";
import type { ContentEnvelope } from "../../../lib/crypto/envelope";

type ActiveStatus = {
  status: "active";
  availableAt: string | null;
  expiresAt: string;
  maxReveals: number | null;
  remainingReveals: number | null;
  passwordRequired: false;
  unlockRequired: false;
};
type ScheduledStatus = {
  status: "scheduled";
  availableAt: string;
  expiresAt: string;
  maxReveals: number | null;
  remainingReveals: number | null;
  passwordRequired: false;
  unlockRequired: false;
};
type ShareStatus = ActiveStatus | ScheduledStatus | { status: "unavailable" };

class ViewerPayloadError extends Error {}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new ViewerPayloadError();
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStatus(value: unknown): ShareStatus {
  if (!record(value) || typeof value.status !== "string") throw new ViewerPayloadError();
  if (value.status === "unavailable") {
    exactKeys(value, ["status"]);
    return { status: "unavailable" };
  }
  if (value.status === "scheduled") {
    exactKeys(value, ["availableAt", "expiresAt", "maxReveals", "passwordRequired", "remainingReveals", "status", "unlockRequired"]);
    if (typeof value.availableAt !== "string" || typeof value.expiresAt !== "string" || value.passwordRequired !== false || value.unlockRequired !== false) throw new ViewerPayloadError();
    return {
      status: "scheduled",
      availableAt: value.availableAt,
      expiresAt: value.expiresAt,
      maxReveals: typeof value.maxReveals === "number" ? value.maxReveals : null,
      remainingReveals: typeof value.remainingReveals === "number" ? value.remainingReveals : null,
      passwordRequired: false,
      unlockRequired: false
    };
  }
  if (value.status !== "active") throw new ViewerPayloadError();
  exactKeys(value, ["availableAt", "expiresAt", "maxReveals", "passwordRequired", "remainingReveals", "status", "unlockRequired"]);
  if (typeof value.expiresAt !== "string" || (value.availableAt !== null && typeof value.availableAt !== "string") || (value.maxReveals !== null && typeof value.maxReveals !== "number") || (value.remainingReveals !== null && typeof value.remainingReveals !== "number") || value.passwordRequired !== false || value.unlockRequired !== false) throw new ViewerPayloadError();
  if (value.maxReveals !== null && (![1, 3, 5, 10].includes(value.maxReveals) || value.remainingReveals === null || value.remainingReveals < 0 || value.remainingReveals > value.maxReveals)) throw new ViewerPayloadError();
  return {
    status: "active",
    availableAt: value.availableAt,
    expiresAt: value.expiresAt,
    maxReveals: value.maxReveals,
    remainingReveals: value.remainingReveals,
    passwordRequired: false,
    unlockRequired: false
  };
}

function parseReveal(value: unknown): ContentEnvelope {
  if (!record(value)) throw new ViewerPayloadError();
  exactKeys(value, ["contentEnvelope", "retryExpiresAt", "status"]);
  if (value.status !== "authorized" || typeof value.retryExpiresAt !== "string") throw new ViewerPayloadError();
  return validateContentEnvelope(value.contentEnvelope);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "an unknown time" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function Viewer({ publicId }: { publicId: string }) {
  const [shareStatus, setShareStatus] = useState<ShareStatus | null>(null);
  const [linkSecret, setLinkSecret] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [message, setMessage] = useState("Checking this sealed share…");
  const [isPending, setIsPending] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [requestToken, setRequestToken] = useState<string | null>(null);

  const needsConfirmation = shareStatus?.status === "active" && shareStatus.maxReveals !== null && !hasConfirmed;
  const actionLabel = useMemo(() => {
    if (isPending) return "Opening…";
    if (needsConfirmation) return "Confirm one reveal";
    return "Open sealed note";
  }, [isPending, needsConfirmation]);

  useEffect(() => {
    let cancelled = false;
    async function checkShare() {
      try {
        validatePublicId(publicId);
        const fragment = window.location.hash.slice(1);
        if (!fragment) {
          if (!cancelled) setMessage("This link is missing its key. Ask the sender for the complete link.");
          return;
        }
        validateLinkSecret(fragment);
        if (!cancelled) setLinkSecret(fragment);
        const response = await fetch(`/api/shares/${encodeURIComponent(publicId)}/status`, { cache: "no-store" });
        if (!response.ok) throw new ViewerPayloadError();
        const status = parseStatus(await response.json());
        if (!cancelled) {
          setShareStatus(status);
          setMessage(status.status === "unavailable" ? "This share is unavailable." : status.status === "scheduled" ? `This share becomes available ${formatDate(status.availableAt)}.` : "This share is ready when you are.");
        }
      } catch {
        if (!cancelled) {
          setShareStatus({ status: "unavailable" });
          setMessage("This share is unavailable or the link is malformed.");
        }
      }
    }
    void checkShare();
    return () => { cancelled = true; };
  }, [publicId]);

  async function reveal() {
    if (isPending || shareStatus?.status !== "active" || linkSecret === null) return;
    if (needsConfirmation) {
      setHasConfirmed(true);
      setMessage("One reveal will be authorized if you continue. This cannot be undone.");
      return;
    }
    const token = requestToken ?? bytesToBase64Url(randomBytes(32));
    if (requestToken === null) setRequestToken(token);
    setIsPending(true);
    setMessage("Requesting the sealed ciphertext…");
    try {
      const response = await fetch(`/api/shares/${encodeURIComponent(publicId)}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestToken: token })
      });
      if (!response.ok) throw new ViewerPayloadError();
      const envelope = parseReveal(await response.json());
      const plaintext = await openContent(envelope, publicId, linkSecret);
      setContent(plaintext);
      setMessage("Opened locally. The server released ciphertext; this browser did the decryption.");
      setRequestToken(null);
    } catch {
      setMessage("This link could not be opened. Check the complete link and try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="viewer-shell" aria-labelledby="viewer-heading">
      <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />SecureBin / sealed share</p>
      <section className="viewer-card">
        <h1 id="viewer-heading">A note sealed<br /><em>for the right eyes.</em></h1>
        <p className="viewer-copy">The key in this link stays in your browser. SecureBin can only authorize and release the encrypted envelope.</p>
        <p className="viewer-status" aria-live="polite" role="status">{message}</p>
        {shareStatus?.status === "active" ? (
          <>
            <button className="viewer-action" disabled={isPending} onClick={() => void reveal()} type="button">
              <span>{actionLabel}</span><span aria-hidden="true" className="button-arrow">↗</span>
            </button>
            <div className="viewer-meta" aria-label="Share policy">
              <span>Expires {formatDate(shareStatus.expiresAt)}</span>
              <span>{shareStatus.maxReveals === null ? "Unlimited reveals" : `${shareStatus.remainingReveals} reveal${shareStatus.remainingReveals === 1 ? "" : "s"} remaining`}</span>
            </div>
          </>
        ) : null}
        {content !== null ? <article className="decrypted-note" aria-label="Decrypted note"><p>{content}</p></article> : null}
        <p className="viewer-link">Public ID: <span>{publicId}</span></p>
      </section>
    </main>
  );
}

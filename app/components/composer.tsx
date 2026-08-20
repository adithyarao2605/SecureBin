"use client";

import { FormEvent, useState } from "react";
import { digestCapability, sealContent } from "../../lib/crypto/content";

type ContentKind = "note" | "markdown" | "code";
type Protection = "standard" | "password" | "two-channel";

const contentKinds: readonly { value: ContentKind; label: string; disabled?: boolean }[] = [
  { value: "note", label: "Plain note" },
  { value: "markdown", label: "Markdown · coming next", disabled: true },
  { value: "code", label: "Code · coming next", disabled: true }
];

const protections: readonly { value: Protection; label: string; detail: string }[] = [
  { value: "standard", label: "Private link", detail: "Browser-sealed" },
  { value: "password", label: "Password · coming next", detail: "Upcoming factor" },
  { value: "two-channel", label: "Two-channel · coming next", detail: "Upcoming factor" }
];

export function Composer() {
  const [contentKind, setContentKind] = useState<ContentKind>("note");
  const [protection, setProtection] = useState<Protection>("standard");
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function sealDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (!draft.trim()) {
      setShareUrl("");
      setMessage("Write a note before sealing it.");
      return;
    }

    setIsPending(true);
    setShareUrl("");
    setMessage("Sealing locally…");
    try {
      const sealed = await sealContent(draft);
      const [deleteTokenHash, idempotencyKeyHash] = await Promise.all([
        digestCapability(sealed.deleteCapability),
        digestCapability(sealed.idempotencyKey)
      ]);
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: sealed.publicId,
          contentEnvelope: sealed.envelope,
          policy: {
            availableAt: null,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            maxReveals: null
          },
          deleteTokenHash,
          idempotencyKeyHash,
          passwordRequired: false,
          unlockRequired: false
        })
      });
      if (!response.ok) throw new Error("share_creation_failed");
      const origin = window.location.origin;
      const result = (await response.json()) as { publicId?: unknown };
      const publicId = typeof result.publicId === "string" ? result.publicId : sealed.publicId;
      const url = `${origin}/s/${encodeURIComponent(publicId)}#${sealed.linkSecret}`;
      setShareUrl(url);
      setMessage("Sealed in this browser. Share the link below; the key stays in its fragment.");
    } catch {
      setMessage("This share could not be created. Your draft is still only on this device.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="composer-wrap" aria-labelledby="composer-heading">
      <div className="composer-heading-row">
        <div>
          <p className="section-kicker">Your workspace</p>
          <h2 id="composer-heading">Start a sealed note</h2>
        </div>
        <span className="local-badge"><span className="local-dot" aria-hidden="true" />local draft</span>
      </div>

      <form className="composer-card" onSubmit={sealDraft}>
        <div className="composer-toolbar">
          <div className="choice-tabs" role="tablist" aria-label="Content type">
            {contentKinds.map((kind) => (
              <button
                aria-selected={contentKind === kind.value}
                aria-disabled={kind.disabled || undefined}
                className="choice-tab"
                data-selected={contentKind === kind.value}
                disabled={kind.disabled}
                key={kind.value}
                onClick={() => setContentKind(kind.value)}
                role="tab"
                type="button"
              >
                {kind.label}
              </button>
            ))}
          </div>
          <span className="character-count" aria-live="polite">{draft.length.toLocaleString()} / 524,288</span>
        </div>
        <label className="sr-only" htmlFor="draft-content">Content to share</label>
        <textarea
          id="draft-content"
          maxLength={524288}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={contentKind === "code" ? "Paste a snippet worth protecting…" : "Write something only the right person should read…"}
          value={draft}
        />
        <div className="composer-bottom">
          <div className="protection-choice">
            <span className="field-label">Protection</span>
            <div className="protection-options" role="radiogroup" aria-label="Protection preset">
              {protections.map((option) => (
                <button
                  aria-disabled={option.value !== "standard" || undefined}
                  aria-checked={protection === option.value}
                  className="protection-option"
                  data-selected={protection === option.value}
                  disabled={option.value !== "standard"}
                  key={option.value}
                  onClick={() => setProtection(option.value)}
                  role="radio"
                  type="button"
                >
                  <span>{option.label}</span>
                  <small>{option.detail}</small>
                </button>
              ))}
            </div>
          </div>
          <button className="seal-button" disabled={isPending} type="submit">
            <span>{isPending ? "Sealing…" : "Seal this draft"}</span>
            <span aria-hidden="true" className="button-arrow">↗</span>
          </button>
        </div>
        <p className="composer-status" aria-live="polite" role="status">{message}</p>
        {shareUrl ? (
          <div className="share-result" aria-label="Created share">
            <span className="field-label">Your private link</span>
            <a href={shareUrl}>{shareUrl}</a>
            <p>Keep the full link. The fragment is the key and never went to SecureBin.</p>
          </div>
        ) : null}
      </form>
      <p className="composer-note"><span aria-hidden="true">✦</span> Plaintext and keys stay in your browser; only an authenticated envelope is sent.</p>
    </section>
  );
}

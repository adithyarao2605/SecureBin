"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deriveDiscussionKey,
  openDiscussionText,
  sealDiscussionText,
} from "../../lib/crypto/discussion";
import { bytesToBase64Url, randomBytes } from "../../lib/crypto/encoding";
import type { FactorMask } from "../../lib/crypto/factors";
import { isDigest, parseShareCommentRows, type ShareCommentRow } from "../../lib/shares/contracts";
import { formatLocalizedDateTime } from "../../lib/shares/policy-ui";

export type DiscussionThreadProps = {
  readonly publicId: string;
  readonly capability: Uint8Array;
  readonly hkdfSalt: Uint8Array;
  readonly mask: FactorMask;
  readonly onCapabilityUsed?: () => void;
};

interface DecryptedComment {
  readonly id: string;
  readonly parentId: string | null;
  readonly body: string;
  readonly nickname: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

const COMMENT_TOKEN_STORAGE_KEY = "securebin_comment_tokens_v1";

function loadCommentTokens(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(COMMENT_TOKEN_STORAGE_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && isDigest(entry[1])
      )
    );
  } catch {
    return {};
  }
}

function saveCommentTokens(tokens: Record<string, string>): void {
  try {
    window.localStorage.setItem(COMMENT_TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // A storage quota or privacy-mode failure leaves the comment read-only.
  }
}

function parseComments(value: unknown): ShareCommentRow[] | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as { comments?: unknown }).comments)
  ) {
    return null;
  }
  return parseShareCommentRows((value as { comments: unknown[] }).comments);
}

export function DiscussionThread({
  publicId,
  capability,
  hkdfSalt,
  mask,
  onCapabilityUsed,
}: DiscussionThreadProps) {
  // A detached rejection handler keeps an unawaited key derivation from
  // becoming an unhandled rejection; awaiting the original promise below
  // still surfaces the failure to the caller.
  const keyPromise = useMemo(() => {
    const promise = deriveDiscussionKey({ capability, hkdfSalt, mask });
    promise.catch(() => {});
    return promise;
  }, [capability, hkdfSalt, mask]);
  const [comments, setComments] = useState<DecryptedComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [nickname, setNickname] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postStatus, setPostStatus] = useState("");
  const [commentTokens, setCommentTokens] = useState<Record<string, string>>(loadCommentTokens);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [mutating, setMutating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Monotonic sequence for list loads: a slower earlier response must never
  // clobber the result of a newer one (poll vs. post-edit-delete refetch).
  const loadSeq = useRef(0);

  const loadComments = useCallback(async () => {
    const seq = ++loadSeq.current;
    setIsLoading(true);
    try {
      const key = await keyPromise;
      const response = await fetch(
        `/api/shares/${encodeURIComponent(publicId)}/comments`,
        {
          cache: "no-store",
          headers: { "x-discussion-capability": bytesToBase64Url(capability) },
        }
      );
      if (seq !== loadSeq.current) return;
      if (!response.ok) throw new Error("comments_fetch_failed");
      const raw = parseComments(await response.json());
      if (!raw) throw new Error("comments_response_invalid");
      if (seq !== loadSeq.current) return;
      const decrypted: DecryptedComment[] = [];
      for (const entry of raw) {
        try {
          const body = await openDiscussionText(key, entry.body_envelope);
          let nicknameText: string | null = null;
          if (entry.nickname_envelope) {
            nicknameText = await openDiscussionText(key, entry.nickname_envelope);
          }
          decrypted.push({
            id: entry.comment_id,
            parentId: entry.parent_comment_id,
            body,
            nickname: nicknameText,
            createdAt: entry.created_at,
            editedAt: entry.edited_at,
          });
        } catch {
          // Undecryptable entries are skipped; the key is share-bound so this
          // cannot happen for comments posted under the same discussion key.
        }
      }
      if (seq !== loadSeq.current) return;
      setComments(decrypted);
      setLoadError("");
    } catch (error) {
      if (seq === loadSeq.current) {
        setLoadError(
          error instanceof Error && error.message === "comments_fetch_failed"
            ? "Discussion is unavailable because this share or its discussion access is no longer valid. This can happen after expiry, revocation, reveal exhaustion, scheduling, or a closed release window."
            : "Discussion could not be loaded because the encrypted response was invalid. Retry if the share is still available."
        );
      }
    } finally {
      if (seq === loadSeq.current) setIsLoading(false);
    }
  }, [keyPromise, publicId, capability]);

  useEffect(() => {
    if (onCapabilityUsed) onCapabilityUsed();
    void loadComments();
    const timer = setInterval(() => {
      if (!document.hidden) void loadComments();
    }, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadComments]);

  async function handlePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bodyText = replyText.trim();
    if (!bodyText || posting) return;
    setPosting(true);
    try {
      const key = await keyPromise;
      const editToken = bytesToBase64Url(randomBytes(32));
      const payload: Record<string, unknown> = {
        capability: bytesToBase64Url(capability),
        editToken,
        bodyEnvelope: await sealDiscussionText(key, bodyText),
      };
      const trimmedNickname = nickname.trim();
      if (trimmedNickname) {
        payload.nicknameEnvelope = await sealDiscussionText(key, trimmedNickname);
      }
      if (parentId) payload.parentCommentId = parentId;
      const response = await fetch(
        `/api/shares/${encodeURIComponent(publicId)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) throw new Error("comment_post_failed");
      const created: unknown = await response.json();
      if (typeof created !== "object" || created === null || typeof (created as { commentId?: unknown }).commentId !== "string") {
        throw new Error("comment_post_response_invalid");
      }
      const nextTokens = { ...commentTokens, [(created as { commentId: string }).commentId]: editToken };
      setCommentTokens(nextTokens);
      saveCommentTokens(nextTokens);
      setReplyText("");
      setParentId(null);
      setPostStatus("");
      await loadComments();
    } catch {
      setPostStatus("The reply could not be posted. Try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !editText.trim() || mutating) return;
    const editToken = commentTokens[editingId];
    if (!editToken) return;
    setMutating(true);
    try {
      const key = await keyPromise;
      const response = await fetch(
        `/api/shares/${encodeURIComponent(publicId)}/comments/${encodeURIComponent(editingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capability: bytesToBase64Url(capability),
            editToken,
            bodyEnvelope: await sealDiscussionText(key, editText.trim()),
          }),
        }
      );
      if (!response.ok) throw new Error("comment_edit_failed");
      setEditingId(null);
      setEditText("");
      setPostStatus("");
      await loadComments();
    } catch {
      setPostStatus("The edit could not be saved. Try again.");
    } finally {
      setMutating(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (mutating) return;
    const editToken = commentTokens[commentId];
    if (!editToken) return;
    setMutating(true);
    try {
      const response = await fetch(
        `/api/shares/${encodeURIComponent(publicId)}/comments/${encodeURIComponent(commentId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ capability: bytesToBase64Url(capability), editToken }),
        }
      );
      if (!response.ok) throw new Error("comment_delete_failed");
      const nextTokens = { ...commentTokens };
      delete nextTokens[commentId];
      setCommentTokens(nextTokens);
      saveCommentTokens(nextTokens);
      if (editingId === commentId) {
        setEditingId(null);
        setEditText("");
      }
      setDeleteConfirmId(null);
      setPostStatus("");
      await loadComments();
    } catch {
      setPostStatus("The comment could not be deleted. Try again.");
    } finally {
      setMutating(false);
    }
  }

  const topLevel = comments.filter(
    (comment) => comment.parentId === null || !comments.some((parent) => parent.id === comment.parentId)
  );

  function renderComment(comment: DecryptedComment) {
    const replies = comments.filter((candidate) => candidate.parentId === comment.id);
    const orphaned = comment.parentId !== null && !comments.some((parent) => parent.id === comment.parentId);
    const token = commentTokens[comment.id];
    const isEditing = editingId === comment.id;
    return (
      <li key={comment.id} className="discussion-comment">
        {orphaned && <p className="discussion-meta">Comment deleted</p>}
        <p className="discussion-meta">
          <strong>{comment.nickname ?? "Anonymous"}</strong>{" "}
          <time dateTime={comment.createdAt}>
            {formatLocalizedDateTime(comment.createdAt)}
          </time>
          {comment.editedAt && <span> (edited)</span>}
        </p>
        {isEditing ? (
          <form className="discussion-form" onSubmit={(event) => void handleEdit(event)}>
            <label htmlFor={`discussion-edit-${comment.id}`} className="sr-only">
              Edit comment
            </label>
            <textarea
              id={`discussion-edit-${comment.id}`}
              className="composer-textarea discussion-reply-input"
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
            />
            <button type="submit" className="action-button primary-button" disabled={mutating}>
              {mutating ? "Saving…" : "Save edit"}
            </button>
            <button
              type="button"
              className="action-button tertiary-button"
              onClick={() => {
                setEditingId(null);
                setEditText("");
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <p className="discussion-body">{comment.body}</p>
        )}
        <div className="discussion-actions">
          <button
            type="button"
            className="discussion-reply-button action-button tertiary-button"
            onClick={() => setParentId(comment.id)}
          >
            Reply
          </button>
          {token && !isEditing && (
            <>
              <button
                type="button"
                className="discussion-reply-button action-button tertiary-button"
                onClick={() => {
                  setEditingId(comment.id);
                  setEditText(comment.body);
                }}
              >
                Edit comment
              </button>
              {deleteConfirmId === comment.id ? (
                <span className="discussion-delete-confirm" role="group" aria-label="Confirm comment deletion">
                  <span className="discussion-meta">Delete this comment?</span>
                  <button
                    type="button"
                    className="discussion-reply-button action-button tertiary-button"
                    onClick={() => void handleDelete(comment.id)}
                    disabled={mutating}
                  >
                    {mutating ? "Deleting…" : "Delete comment"}
                  </button>
                  <button
                    type="button"
                    className="discussion-reply-button action-button tertiary-button"
                    onClick={() => setDeleteConfirmId(null)}
                    disabled={mutating}
                  >
                    Keep comment
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="discussion-reply-button action-button tertiary-button"
                  onClick={() => setDeleteConfirmId(comment.id)}
                  disabled={mutating}
                >
                  Delete comment
                </button>
              )}
            </>
          )}
        </div>
        {replies.length > 0 && <ul className="discussion-replies">{replies.map(renderComment)}</ul>}
      </li>
    );
  }

  return (
    <section className="discussion-thread" aria-label="Encrypted discussion" aria-busy={posting || mutating || isLoading}>
      <div className="discussion-heading-row">
        <div>
          <h3 className="surface-heading">Encrypted discussion</h3>
          <p className="discussion-intro">Replies are sealed in your browser and available only while this share remains available.</p>
        </div>
        <span className="discussion-proof-badge">Client encrypted</span>
      </div>

      {loadError && (
        <div className="discussion-error" role="alert" aria-live="polite">
          <p className="viewer-status-text">{loadError}</p>
          <button type="button" className="action-button secondary-button" onClick={() => void loadComments()}>
            Retry discussion
          </button>
        </div>
      )}

      {postStatus && !loadError && (
        <p className="viewer-status-text" role="alert" aria-live="polite">
          {postStatus}
        </p>
      )}

      <ul className="discussion-list">
        {topLevel.map(renderComment)}
        {isLoading && comments.length === 0 && !loadError && (
          <li className="discussion-empty" role="status">Loading encrypted replies…</li>
        )}
        {!isLoading && topLevel.length === 0 && !loadError && (
          <li className="discussion-empty">No comments yet.</li>
        )}
      </ul>

      <form className="discussion-form" onSubmit={(e) => void handlePost(e)}>
        {parentId && (
          <div className="discussion-reply-context">
            <p className="policy-hint">Replying to an earlier comment.</p>
            <button type="button" className="discussion-reply-button action-button tertiary-button" onClick={() => setParentId(null)}>
              Cancel reply
            </button>
          </div>
        )}
        <label htmlFor="discussion-reply-text" className="sr-only">
          Reply
        </label>
        <textarea
          id="discussion-reply-text"
          className="composer-textarea discussion-reply-input"
          placeholder="Write a reply…"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
        />
        <label htmlFor="discussion-nickname" className="sr-only">
          Nickname (optional)
        </label>
        <input
          id="discussion-nickname"
          className="policy-number-input discussion-nickname-input"
          type="text"
          autoComplete="off"
          placeholder="Nickname (optional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <button type="submit" className="action-button primary-button" disabled={posting}>
          {posting ? "Posting…" : "Post"}
        </button>
        <p className="policy-hint">
          Comments are encrypted locally; the server stores opaque ciphertext.
        </p>
      </form>
    </section>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deriveDiscussionKey,
  openDiscussionText,
  sealDiscussionText,
} from "../../lib/crypto/discussion";
import { bytesToBase64Url, randomBytes } from "../../lib/crypto/encoding";
import type { FactorMask } from "../../lib/crypto/factors";
import { isDigest } from "../../lib/shares/contracts";
import { formatLocalizedDateTime } from "../../lib/shares/policy-ui";

export type DiscussionThreadProps = {
  readonly publicId: string;
  readonly capability: Uint8Array;
  readonly hkdfSalt: Uint8Array;
  readonly mask: FactorMask;
  readonly onCapabilityUsed?: () => void;
};

interface RawComment {
  comment_id: unknown;
  parent_comment_id: unknown;
  body_envelope: unknown;
  nickname_envelope: unknown;
  created_at: unknown;
  edited_at: unknown;
}

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

function parseComments(value: unknown): RawComment[] {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as { comments?: unknown }).comments)
  ) {
    return [];
  }
  return ((value as { comments: unknown[] }).comments).filter(
    (entry): entry is RawComment =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as RawComment).comment_id === "string"
  );
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
  const loadInFlight = useRef(false);

  const loadComments = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    try {
      const key = await keyPromise;
      const response = await fetch(
        `/api/shares/${encodeURIComponent(publicId)}/comments`,
        {
          cache: "no-store",
          headers: { "x-discussion-capability": bytesToBase64Url(capability) },
        }
      );
      if (!response.ok) throw new Error("comments_fetch_failed");
      const raw = parseComments(await response.json());
      const decrypted: DecryptedComment[] = [];
      for (const entry of raw) {
        try {
          const body = await openDiscussionText(key, entry.body_envelope);
          let nicknameText: string | null = null;
          if (entry.nickname_envelope) {
            nicknameText = await openDiscussionText(key, entry.nickname_envelope);
          }
          decrypted.push({
            id: entry.comment_id as string,
            parentId:
              typeof entry.parent_comment_id === "string" ? entry.parent_comment_id : null,
            body,
            nickname: nicknameText,
            createdAt:
              typeof entry.created_at === "string" ? entry.created_at : new Date().toISOString(),
            editedAt: typeof entry.edited_at === "string" ? entry.edited_at : null,
          });
        } catch {
          // Undecryptable entries are skipped; the key is share-bound so this
          // cannot happen for comments posted under the same discussion key.
        }
      }
      setComments(decrypted);
      setLoadError("");
    } catch {
      setLoadError("Comments could not be loaded right now.");
    } finally {
      loadInFlight.current = false;
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
        {orphaned && <p className="discussion-meta">[comment removed]</p>}
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
                Edit
              </button>
              <button
                type="button"
                className="discussion-reply-button action-button tertiary-button"
                onClick={() => void handleDelete(comment.id)}
                disabled={mutating}
              >
                Delete
              </button>
            </>
          )}
        </div>
        {replies.length > 0 && <ul className="discussion-replies">{replies.map(renderComment)}</ul>}
      </li>
    );
  }

  return (
    <section className="discussion-thread" aria-label="Encrypted discussion">
      <h3 className="surface-heading">Encrypted discussion</h3>

      {(loadError || postStatus) && (
        <p className="viewer-status-text" role="status">
          {loadError || postStatus}
        </p>
      )}

      <ul className="discussion-list">
        {topLevel.map(renderComment)}
        {topLevel.length === 0 && !loadError && (
          <li className="discussion-empty">No comments yet.</li>
        )}
      </ul>

      <form className="discussion-form" onSubmit={(e) => void handlePost(e)}>
        {parentId && (
          <p className="policy-hint">Replying to an earlier comment.</p>
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

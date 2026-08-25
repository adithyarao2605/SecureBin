"use client";

import { useRef } from "react";
import {
  digestCapability,
  sealContent,
  type SealedContent,
  type SealedFactorArgs,
} from "../../lib/crypto/content";
import { bytesToArrayBuffer, randomBytes, sha256Base64Url } from "../../lib/crypto/encoding";
import { MAX_CONTENT_BYTES } from "../../lib/crypto/envelope";
import { sealFile, type SealedFile } from "../../lib/crypto/file";
import { prepareFactors, type PreparedFactors } from "../../lib/crypto/factors";
import type { CodeLanguage, ContentPayload } from "../../lib/crypto/payload";
import { generateShareContext, type ShareCryptoContext } from "../../lib/crypto/share-context";
import {
  validatePolicyDraft,
  type PolicyDraft,
  type ValidatedPolicy,
} from "../../lib/shares/policy-ui";
import { saveShareToHistory } from "../../lib/shares/share-history";
import { encodeParcel } from "../../lib/shares/parcel";
import type { PrivacyReceiptData } from "../components/privacy-receipt";
import type { ProtectionState } from "../components/protection-controls";
import type { ComposerMode } from "../components/composer/mode-tabs";
import { formatBytes } from "../components/composer/format";

interface PreparedAttemptFile {
  readonly sealed: SealedFile;
  readonly uploaded: boolean;
}

interface PreparedAttempt {
  readonly context: ShareCryptoContext;
  /** The factors actually used for sealing; reused verbatim on retries. */
  readonly factors: PreparedFactors;
  readonly sealedContent: SealedContent;
  readonly files: PreparedAttemptFile[];
  readonly payload: Record<string, unknown>;
}

export interface StagedCreateRequest {
  readonly contentPayload: ContentPayload;
  readonly factors: PreparedFactors;
  /** Sender password; only mixed in when the mask includes the password factor. */
  readonly password?: string;
  readonly discussionCapability: Uint8Array | null;
  readonly files: readonly File[];
  readonly policy: {
    readonly availableAt: string | null;
    readonly expiresAt: string | null;
    readonly maxReveals: number | null;
    readonly revealWindowSeconds?: number | null;
  };
  readonly mask: string;
  readonly onProgress?: (progress: StagedCreateProgress) => void;
}

export interface StagedCreateProgress {
  readonly phase: "sealing" | "uploading" | "finalizing";
  readonly current: number;
  readonly total: number;
}

export interface StagedCreateOutcome {
  readonly publicId: string;
  readonly shareUrl: string;
  readonly deleteCapability: string;
  /** The unlock code that actually sealed this share; "" when unused. */
  readonly unlockCode: string;
  readonly receipt: PrivacyReceiptData;
  /** Portable .securebin parcel of the encrypted material (no secrets). */
  readonly parcel: Uint8Array | null;
}

export type CreateAttempt =
  | { readonly valid: false; readonly error: string }
  | {
      readonly valid: true;
      readonly mask: PreparedFactors["mask"];
      readonly unlockCode: string;
      readonly factors: PreparedFactors;
      readonly policy: Extract<ValidatedPolicy, { valid: true }>;
    };

/** Derive sealing arguments from the prepared factors; password only joins the password mask. */
function factorArgsFor(factors: PreparedFactors, password: string | undefined): SealedFactorArgs {
  return {
    mask: factors.mask,
    ...(factors.passwordSalt && password
      ? { passwordSalt: factors.passwordSalt, password }
      : {}),
    ...(factors.unlockCode ? { unlockCode: factors.unlockCode } : {}),
  };
}

export function buildContentPayload(
  mode: ComposerMode,
  draft: string,
  language: CodeLanguage
): ContentPayload {
  if (mode === "code") return { mode: "code", text: draft, language };
  return { mode, text: draft };
}

/**
 * Synchronous sender-side pre-flight, in the exact order the composer always
 * used: empty draft, UTF-8 byte budget, password match, factor preparation
 * (which may still throw FactorError), then policy validation.
 */
export function prepareCreateAttempt(options: {
  draft: string;
  hasFiles: boolean;
  protection: ProtectionState;
  policyDraft: PolicyDraft;
}): CreateAttempt {
  const { draft, hasFiles, protection } = options;

  if (!draft.trim() && !hasFiles) {
    return { valid: false, error: "Write some content or attach a file before creating a share." };
  }

  const draftBytes = new TextEncoder().encode(draft).length;
  if (draftBytes > MAX_CONTENT_BYTES) {
    return {
      valid: false,
      error: `Content is too large for one share (${formatBytes(draftBytes)} of text, limit ${formatBytes(MAX_CONTENT_BYTES)}). Shorten the note or attach the rest as a file.`,
    };
  }

  const wantsPassword = protection.password.length > 0;
  if (wantsPassword && protection.password !== protection.confirmPassword) {
    return { valid: false, error: "The passwords do not match." };
  }

  const preparedFactors = prepareFactors({
    password: wantsPassword ? protection.password : undefined,
    enableUnlock: protection.enableUnlock,
  });

  const validated = validatePolicyDraft(options.policyDraft);
  if (!validated.valid) {
    return { valid: false, error: validated.error };
  }

  return {
    valid: true,
    mask: preparedFactors.mask,
    unlockCode: preparedFactors.unlockCode ?? "",
    factors: preparedFactors,
    policy: validated,
  };
}

/** Revoke via the deletion capability held on this device. */
export async function revokeShare(publicId: string, deleteCapability: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/shares/${encodeURIComponent(publicId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteCapability }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Sender-side staged creation: seal content and attachments in the browser,
 * reserve + PUT each attachment, then create the share record. The prepared
 * attempt is memoized so a retry after a network failure reuses the identical
 * idempotency hash and the identical factors (unlock code, password salt)
 * instead of minting a second share or redisplaying a mismatched code.
 */
export function useStagedCreate() {
  const preparedRef = useRef<PreparedAttempt | null>(null);

  function discard() {
    preparedRef.current = null;
  }

  async function stage(request: StagedCreateRequest): Promise<StagedCreateOutcome> {
    let prepared = preparedRef.current;

    if (!prepared) {
      const context = generateShareContext();
      const factors = request.factors;
      const factorArgs = factorArgsFor(factors, request.password);
      const sealedContent = await sealContent(
        request.contentPayload,
        context,
        factorArgs,
        request.discussionCapability
          ? { discussionCapability: request.discussionCapability }
          : undefined
      );

      const stagedFiles: PreparedAttemptFile[] = [];
      for (const file of request.files) {
        request.onProgress?.({
          phase: "sealing",
          current: stagedFiles.length + 1,
          total: request.files.length,
        });
        const buffer = await file.arrayBuffer();
        const sealed = await sealFile(
          {
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            data: new Uint8Array(buffer),
          },
          context,
          factorArgs
        );
        stagedFiles.push({ sealed, uploaded: false });
      }

      const [deleteTokenHash, idempotencyKeyHash] = await Promise.all([
        digestCapability(context.deleteCapability),
        digestCapability(context.idempotencyKey),
      ]);

      const payload: Record<string, unknown> = {
        publicId: context.publicId,
        contentEnvelope: sealedContent.envelope,
        policy: {
          availableAt: request.policy.availableAt,
          expiresAt: request.policy.expiresAt,
          maxReveals: request.policy.maxReveals,
        },
        deleteTokenHash,
        idempotencyKeyHash,
        passwordRequired: request.mask.includes("password"),
        unlockRequired: request.mask.includes("unlock"),
        revealWindowSeconds: request.policy.revealWindowSeconds,
      };

      if (request.discussionCapability) {
        // The server stores sha256 over the RAW capability bytes; hash the
        // bytes, never their base64url encoding.
        payload.discussionCapabilityHash = await sha256Base64Url(request.discussionCapability);
      }

      prepared = { context, factors, sealedContent, files: stagedFiles, payload };
      preparedRef.current = prepared;
    }

    // Staged uploads, one reservation + PUT per attachment slot. Each
    // uploaded flag persists in preparedRef so a retry never re-uploads.
    for (let index = 0; index < prepared.files.length; index += 1) {
      const entry = prepared.files[index];
      if (entry.uploaded) continue;

      request.onProgress?.({
        phase: "uploading",
        current: index + 1,
        total: prepared.files.length,
      });

      const uploadRes = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: prepared.context.publicId,
          idempotencyKeyHash: prepared.payload.idempotencyKeyHash,
          fileEnvelope: entry.sealed.envelope,
          expectedCiphertextSize: entry.sealed.ciphertextSize,
          attachmentSlot: index,
        }),
      });

      if (!uploadRes.ok) {
        throw new Error("upload_reservation_failed");
      }

      const uploadData = (await uploadRes.json()) as {
        uploadUrl?: unknown;
        alreadyUploaded?: unknown;
      };
      if (uploadData.alreadyUploaded === true) {
        // The PUT may have succeeded while its response was lost. The
        // reservation RPC verified the exact object size, so the browser can
        // safely recover without issuing a second PUT.
      } else {
        if (typeof uploadData.uploadUrl !== "string" || uploadData.uploadUrl.length === 0) {
          throw new Error("missing_upload_url");
        }

        const putRes = await fetch(uploadData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: new Blob([bytesToArrayBuffer(entry.sealed.ciphertext)], { type: "application/octet-stream" }),
        });

        if (!putRes.ok) {
          throw new Error("storage_upload_failed");
        }
      }

      prepared.files[index] = { sealed: entry.sealed, uploaded: true };
      preparedRef.current = prepared;
    }

    // Create the share
    request.onProgress?.({ phase: "finalizing", current: 1, total: 1 });
    const response = await fetch("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prepared.payload),
    });

    if (!response.ok) {
      throw new Error("create_failed");
    }

    const result = (await response.json()) as { publicId?: unknown };
    const returnedPublicId =
      typeof result.publicId === "string" ? result.publicId : prepared.context.publicId;
    const origin = window.location.origin;
    const fullUrl = `${origin}/s/${encodeURIComponent(returnedPublicId)}#${prepared.context.linkSecret}`;

    saveShareToHistory({
      publicId: returnedPublicId,
      shareUrl: fullUrl,
      createdAt: new Date().toISOString(),
      expiresAt: request.policy.expiresAt,
      availableAt: request.policy.availableAt,
      maxReveals: request.policy.maxReveals,
      revealWindowSeconds: request.policy.revealWindowSeconds ?? null,
      deleteCapability: prepared.context.deleteCapability,
      status: "active",
      remainingReveals: request.policy.maxReveals,
    });

    let parcel: Uint8Array | null = null;
    try {
      parcel = encodeParcel({
        publicId: prepared.context.publicId,
        policy: {
          availableAt: request.policy.availableAt,
          expiresAt: request.policy.expiresAt,
          maxReveals: request.policy.maxReveals,
          revealWindowSeconds: request.policy.revealWindowSeconds ?? null,
          createdAt: new Date().toISOString(),
        },
        contentEnvelope: prepared.sealedContent.envelope,
        attachments: prepared.files.map((entry, index) => ({
          slot: index,
          envelope: entry.sealed.envelope,
          ciphertext: entry.sealed.ciphertext,
        })),
      });
    } catch {
      // Parcel export is best-effort; the share itself is unaffected.
    }

    return {
      publicId: returnedPublicId,
      shareUrl: fullUrl,
      deleteCapability: prepared.context.deleteCapability,
      unlockCode: prepared.factors.unlockCode ?? "",
      receipt: {
        publicId: returnedPublicId,
        fingerprint: await digestCapability(prepared.sealedContent.envelope.ciphertext),
        mask: request.mask,
        hasFile: prepared.files.length > 0,
        availableAt: request.policy.availableAt,
        expiresAt: request.policy.expiresAt,
        maxReveals: request.policy.maxReveals,
        algorithm: prepared.sealedContent.envelope.algorithm,
        kdf: prepared.sealedContent.envelope.kdf,
        envelopeVersion: prepared.sealedContent.envelope.version,
        contentType:
          request.contentPayload.mode === "code"
            ? `Code (${request.contentPayload.language})`
            : request.contentPayload.mode === "markdown"
            ? "Markdown"
            : "Note",
        fileCount: prepared.files.length,
        discussionEnabled: request.discussionCapability !== null,
        revealWindowSeconds: request.policy.revealWindowSeconds ?? null,
      },
      parcel,
    };
  }

  return { stage, discard };
}

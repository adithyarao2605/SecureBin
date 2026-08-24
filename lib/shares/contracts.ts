import {
  MAX_DISCUSSION_BODY_CIPHERTEXT_BYTES,
  MAX_DISCUSSION_NICKNAME_CIPHERTEXT_BYTES,
  validateDiscussionEnvelope,
} from "../crypto/discussion";

/**
 * Server-facing share contracts.
 *
 * This module deliberately has no Node or Supabase imports. It is safe to
 * reuse the strict validators at a browser/API boundary, while the server
 * still performs the same checks before calling the database.
 */

export const PUBLIC_ID_LENGTH = 22;
export const PUBLIC_ID_BYTES = 16;
export const DIGEST_LENGTH = 43;

export const MAX_CONTENT_CIPHERTEXT_CHARS_V1 = 699_072;
export const MAX_CONTENT_CIPHERTEXT_BYTES_V1 = 524_304;

export const MAX_CONTENT_CIPHERTEXT_CHARS_V2 = 699_087;
export const MAX_CONTENT_CIPHERTEXT_BYTES_V2 = 524_315;

export const MAX_CONTENT_CIPHERTEXT_CHARS = MAX_CONTENT_CIPHERTEXT_CHARS_V2;
export const MAX_FILE_CIPHERTEXT_SIZE = 10_486_422;
export const MAX_EXPIRY_DAYS = 30;

const ISO_UTC_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]00(?::?00)?)$/;

export type FactorMask =
  | "link"
  | "link+password"
  | "link+unlock"
  | "link+password+unlock";

export type ObjectType = "content" | "file";

export interface Envelope {
  readonly version: 1 | 2;
  readonly objectType: ObjectType;
  readonly algorithm: "AES-256-GCM";
  readonly nonce: string;
  readonly hkdfSalt: string;
  readonly passwordSalt: string | null;
  readonly kdf: "none" | "PBKDF2-HMAC-SHA-256";
  readonly kdfParameters: Readonly<Record<string, 600000>> | Readonly<Record<string, never>>;
  readonly factorMask: FactorMask;
  readonly ciphertext?: string;
}

export type MaxReveals = number | null;
export const VALID_MAX_REVEALS = [1, 3, 5, 10, null] as const;
export const MIN_MAX_REVEALS = 1;
export const MAX_MAX_REVEALS = 100;

export interface CreateShareInput {
  readonly publicId: string;
  readonly contentEnvelope: Envelope & { readonly objectType: "content"; readonly ciphertext: string };
  readonly availableAt: string | null;
  /** Null means the share never expires (it remains revocable). */
  readonly expiresAt: string | null;
  readonly maxReveals: MaxReveals;
  readonly deleteTokenHash: string;
  readonly passwordRequired: boolean;
  readonly unlockRequired: boolean;
  readonly idempotencyKeyHash: string;
  /** SHA-256 digest of the raw discussion capability; null disables threads. */
  readonly discussionCapabilityHash: string | null;
  /**
   * Sender-chosen reveal window in seconds, counted from the FIRST successful
   * release; null keeps releases open until normal expiry.
   */
  readonly revealWindowSeconds: number | null;
}

/** Bounds for a sender-chosen release window (10 s … 24 h). */
export const MIN_REVEAL_WINDOW_SECONDS = 10;
export const MAX_REVEAL_WINDOW_SECONDS = 86_400;

export function isRevealWindowSeconds(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_REVEAL_WINDOW_SECONDS &&
    value <= MAX_REVEAL_WINDOW_SECONDS
  );
}

export type FileEnvelopeV2 = Envelope & {
  readonly objectType: "file";
  readonly version: 2;
  readonly ciphertext?: never;
};

export interface UploadReservationInput {
  readonly publicId: string;
  readonly idempotencyKeyHash: string;
  readonly fileEnvelope: FileEnvelopeV2;
  readonly expectedCiphertextSize: number;
  readonly attachmentSlot: number;
}

export interface RevealAttachment {
  readonly slot: number;
  readonly envelope: FileEnvelopeV2;
  readonly ciphertextSize: number;
  readonly downloadUrl: string;
}

export interface RevealInput {
  readonly requestToken: string;
}

export interface DeleteInput {
  readonly deleteCapability: string;
}

export interface AddCommentInput {
  readonly capability: string;
  readonly editToken: string;
  readonly bodyEnvelope: Record<string, unknown>;
  readonly nicknameEnvelope?: Record<string, unknown> | null;
  readonly parentCommentId?: string | null;
}

export interface EditCommentInput {
  readonly capability: string;
  readonly editToken: string;
  readonly bodyEnvelope: Record<string, unknown>;
}

export interface DeleteCommentInput {
  readonly capability: string;
  readonly editToken: string;
}

export interface SharePolicy {
  readonly availableAt: string | null;
  readonly expiresAt: string | null;
  readonly maxReveals: MaxReveals;
  readonly passwordRequired: boolean;
  readonly unlockRequired: boolean;
  readonly remainingReveals: number | null;
}

export interface ShareStatusActive extends SharePolicy {
  readonly status: "active";
}

export interface ShareStatusScheduled extends SharePolicy {
  readonly status: "scheduled";
  readonly availableAt: string;
}

export interface ShareStatusUnavailable {
  readonly status: "unavailable";
}

export type ShareStatus =
  | ShareStatusActive
  | ShareStatusScheduled
  | ShareStatusUnavailable;

export const MAX_STATUS_BATCH_IDS = 50;

export interface ShareStatusBatchInput {
  readonly publicIds: string[];
}

export interface ShareStatusBatchItem {
  readonly publicId: string;
  readonly status: ShareStatus;
}

export interface RevealResult {
  readonly status: "authorized" | "unavailable" | "request_expired";
  readonly contentEnvelope: (Envelope & { readonly objectType: "content"; readonly ciphertext: string }) | null;
  readonly files: RevealAttachment[];
  readonly retryExpiresAt: string | null;
  /** When the sender's release window closes; null when no window was set. */
  readonly releaseWindowEndsAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function hasOnlyKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[]): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => key in value) && Object.keys(value).every((key) => allowed.has(key));
}

function isBase64Url(value: unknown, length: number): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const decoded = decodeBase64Url(value);
  return decoded !== null && decoded.length === length;
}

export function isDigest(value: unknown): value is string {
  return isBase64Url(value, 32);
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (value.length === 0 || value.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const decoded = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    let canonicalBinary = "";
    for (const byte of decoded) canonicalBinary += String.fromCharCode(byte);
    const canonical = btoa(canonicalBinary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    return canonical === value ? decoded : null;
  } catch {
    return null;
  }
}

export function parseIsoUtc(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_UTC_PATTERN.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function parseFactorMask(value: unknown): value is FactorMask {
  return value === "link" || value === "link+password" || value === "link+unlock" || value === "link+password+unlock";
}

export function isMaxReveals(value: unknown): value is MaxReveals {
  return (
    value === null ||
    (typeof value === "number" && Number.isInteger(value) && value >= MIN_MAX_REVEALS && value <= MAX_MAX_REVEALS)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseEnvelope(value: unknown, objectType: ObjectType, requireCiphertext: boolean): Envelope | null {
  if (!isRecord(value)) return null;
  const keys = requireCiphertext
    ? ["algorithm", "ciphertext", "factorMask", "hkdfSalt", "kdf", "kdfParameters", "nonce", "objectType", "passwordSalt", "version"]
    : ["algorithm", "factorMask", "hkdfSalt", "kdf", "kdfParameters", "nonce", "objectType", "passwordSalt", "version"];
  if (!hasExactKeys(value, keys)) return null;

  if (objectType === "content") {
    if (value.version !== 1 && value.version !== 2) return null;
  } else if (objectType === "file") {
    if (value.version !== 2) return null; // File envelopes MUST be version 2
  } else {
    return null;
  }

  if (
    value.objectType !== objectType ||
    value.algorithm !== "AES-256-GCM" ||
    !isBase64Url(value.nonce, 12) ||
    !isBase64Url(value.hkdfSalt, 16) ||
    (value.passwordSalt !== null && !isBase64Url(value.passwordSalt, 16)) ||
    !parseFactorMask(value.factorMask)
  ) return null;

  const expectedKdf = value.factorMask === "link" || value.factorMask === "link+unlock" ? "none" : "PBKDF2-HMAC-SHA-256";
  if (value.kdf !== expectedKdf || !isRecord(value.kdfParameters)) return null;
  if (expectedKdf === "none" && !hasExactKeys(value.kdfParameters, [])) return null;
  if (expectedKdf !== "none" && (!hasExactKeys(value.kdfParameters, ["iterations"]) || value.kdfParameters.iterations !== 600000)) return null;
  if (expectedKdf === "none" && value.passwordSalt !== null) return null;
  if (expectedKdf !== "none" && value.passwordSalt === null) return null;

  if (requireCiphertext) {
    const maxChars = value.version === 1 ? MAX_CONTENT_CIPHERTEXT_CHARS_V1 : MAX_CONTENT_CIPHERTEXT_CHARS_V2;
    const maxBytes = value.version === 1 ? MAX_CONTENT_CIPHERTEXT_BYTES_V1 : MAX_CONTENT_CIPHERTEXT_BYTES_V2;

    if (typeof value.ciphertext !== "string" || value.ciphertext.length > maxChars) return null;
    const ciphertextBytes = decodeBase64Url(value.ciphertext);
    if (ciphertextBytes === null || ciphertextBytes.length < 16 || ciphertextBytes.length > maxBytes) return null;
  }
  return value as unknown as Envelope;
}

export function parseContentEnvelope(value: unknown): CreateShareInput["contentEnvelope"] | null {
  const envelope = parseEnvelope(value, "content", true);
  return envelope as CreateShareInput["contentEnvelope"] | null;
}

export function parseFileEnvelope(value: unknown): FileEnvelopeV2 | null {
  // Metadata-only file envelopes carry one fewer field (no ciphertext).
  const envelope = parseEnvelope(value, "file", false);
  return envelope as FileEnvelopeV2 | null;
}

export function parseCreateShareInput(value: unknown, nowMillis: number = Date.now()): CreateShareInput | null {
  if (!isRecord(value) || !hasOnlyKeys(value,
    ["contentEnvelope", "deleteTokenHash", "idempotencyKeyHash", "passwordRequired", "policy", "publicId", "unlockRequired"],
    ["discussionCapabilityHash", "revealWindowSeconds"]
  )) return null;
  if (!isRecord(value.policy) || !hasExactKeys(value.policy, ["availableAt", "expiresAt", "maxReveals"])) return null;
  if (!isBase64Url(value.publicId, PUBLIC_ID_BYTES)) return null;
  const contentEnvelope = parseContentEnvelope(value.contentEnvelope);
  if (!contentEnvelope) return null;
  if (!isDigest(value.deleteTokenHash) || !isDigest(value.idempotencyKeyHash)) return null;
  if (typeof value.passwordRequired !== "boolean" || typeof value.unlockRequired !== "boolean") return null;
  const expectedPassword = contentEnvelope.factorMask === "link+password" || contentEnvelope.factorMask === "link+password+unlock";
  const expectedUnlock = contentEnvelope.factorMask === "link+unlock" || contentEnvelope.factorMask === "link+password+unlock";
  if (value.passwordRequired !== expectedPassword || value.unlockRequired !== expectedUnlock) return null;
  const maxReveals = value.policy.maxReveals;
  if (!isMaxReveals(maxReveals)) return null;
  const availableAt = value.policy.availableAt === null ? null : parseIsoUtc(value.policy.availableAt);
  // Never expiry: the client signals it with an explicit null expiresAt.
  const expiresAt =
    value.policy.expiresAt === null ? null : parseIsoUtc(value.policy.expiresAt);
  if ((value.policy.availableAt !== null && availableAt === null) || (value.policy.expiresAt !== null && expiresAt === null)) {
    return null;
  }
  if (expiresAt !== null) {
    const expiryMillis = Date.parse(expiresAt);
    if (expiryMillis <= nowMillis || expiryMillis > nowMillis + MAX_EXPIRY_DAYS * 86_400_000) return null;
    if (availableAt !== null && Date.parse(availableAt) >= expiryMillis) return null;
  }
  if (value.fileEnvelope !== undefined || value.fileCiphertextSize !== undefined) return null;
  if (
    value.revealWindowSeconds !== undefined &&
    value.revealWindowSeconds !== null &&
    !isRevealWindowSeconds(value.revealWindowSeconds)
  ) {
    return null;
  }
  if (value.discussionCapabilityHash !== undefined && value.discussionCapabilityHash !== null && !isDigest(value.discussionCapabilityHash)) {
    return null;
  }

  return {
    publicId: value.publicId,
    contentEnvelope,
    availableAt,
    expiresAt,
    maxReveals,
    deleteTokenHash: value.deleteTokenHash,
    passwordRequired: value.passwordRequired,
    unlockRequired: value.unlockRequired,
    idempotencyKeyHash: value.idempotencyKeyHash,
    discussionCapabilityHash:
      value.discussionCapabilityHash === undefined || value.discussionCapabilityHash === null
        ? null
        : value.discussionCapabilityHash,
    revealWindowSeconds:
      value.revealWindowSeconds === undefined || value.revealWindowSeconds === null
        ? null
        : value.revealWindowSeconds,
  };
}

export function parseUploadReservationInput(value: unknown): UploadReservationInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ["attachmentSlot", "expectedCiphertextSize", "fileEnvelope", "idempotencyKeyHash", "publicId"])) return null;
  if (!isBase64Url(value.publicId, PUBLIC_ID_BYTES)) return null;
  if (!isDigest(value.idempotencyKeyHash)) return null;
  const fileEnvelope = parseFileEnvelope(value.fileEnvelope);
  if (!fileEnvelope) return null;
  if (typeof value.expectedCiphertextSize !== "number" || !isNonNegativeInteger(value.expectedCiphertextSize)) return null;
  if (value.expectedCiphertextSize < 16 || value.expectedCiphertextSize > MAX_FILE_CIPHERTEXT_SIZE) return null;
  if (typeof value.attachmentSlot !== "number" || !Number.isInteger(value.attachmentSlot) || value.attachmentSlot < 0 || value.attachmentSlot > 4) return null;

  return {
    publicId: value.publicId,
    idempotencyKeyHash: value.idempotencyKeyHash,
    fileEnvelope,
    expectedCiphertextSize: value.expectedCiphertextSize,
    attachmentSlot: value.attachmentSlot,
  };
}

export function parseRevealInput(value: unknown): RevealInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ["requestToken"]) || !isDigest(value.requestToken)) return null;
  return { requestToken: value.requestToken };
}

export function parseDeleteInput(value: unknown): DeleteInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ["deleteCapability"]) || !isDigest(value.deleteCapability)) return null;
  return { deleteCapability: value.deleteCapability };
}

export function parseAddCommentInput(value: unknown): AddCommentInput | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["capability", "bodyEnvelope", "editToken"], ["nicknameEnvelope", "parentCommentId"]) ||
    !isDigest(value.capability) ||
    !isDigest(value.editToken) ||
    !isRecord(value.bodyEnvelope)
  ) return null;
  if (value.nicknameEnvelope !== undefined && value.nicknameEnvelope !== null && !isRecord(value.nicknameEnvelope)) return null;
  try {
    validateDiscussionEnvelope(value.bodyEnvelope, MAX_DISCUSSION_BODY_CIPHERTEXT_BYTES);
    if (value.nicknameEnvelope !== undefined && value.nicknameEnvelope !== null) {
      validateDiscussionEnvelope(value.nicknameEnvelope, MAX_DISCUSSION_NICKNAME_CIPHERTEXT_BYTES);
    }
  } catch {
    return null;
  }
  if (value.parentCommentId !== undefined && value.parentCommentId !== null && typeof value.parentCommentId !== "string") return null;
  return value as unknown as AddCommentInput;
}

export function parseEditCommentInput(value: unknown): EditCommentInput | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["bodyEnvelope", "capability", "editToken"]) ||
    !isDigest(value.capability) ||
    !isDigest(value.editToken) ||
    !isRecord(value.bodyEnvelope)
  ) return null;
  try {
    validateDiscussionEnvelope(value.bodyEnvelope, MAX_DISCUSSION_BODY_CIPHERTEXT_BYTES);
  } catch {
    return null;
  }
  return value as unknown as EditCommentInput;
}

export function parseDeleteCommentInput(value: unknown): DeleteCommentInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ["capability", "editToken"]) || !isDigest(value.capability) || !isDigest(value.editToken)) return null;
  return value as unknown as DeleteCommentInput;
}

export function isPublicId(value: string): boolean {
  return isBase64Url(value, PUBLIC_ID_BYTES);
}

export function parseStatusBatchInput(value: unknown): ShareStatusBatchInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ["publicIds"]) || !Array.isArray(value.publicIds)) return null;
  if (value.publicIds.length === 0 || value.publicIds.length > MAX_STATUS_BATCH_IDS) return null;
  if (!value.publicIds.every((publicId): publicId is string => typeof publicId === "string" && isPublicId(publicId))) return null;
  if (new Set(value.publicIds).size !== value.publicIds.length) return null;
  return { publicIds: value.publicIds };
}

export function parseRpcEnvelope(value: unknown): CreateShareInput["contentEnvelope"] | null {
  return parseContentEnvelope(value);
}

export function parseRpcFileEnvelope(value: unknown): FileEnvelopeV2 | null {
  return parseFileEnvelope(value);
}

export function parseStatus(value: unknown): ShareStatus | null {
  if (!isRecord(value) || typeof value.status !== "string") return null;
  if (value.status === "unavailable") return { status: "unavailable" };
  if (value.status !== "active" && value.status !== "scheduled") return null;
  const expiresAt = value.expires_at === null ? null : parseIsoUtc(value.expires_at);
  const availableAt = value.available_at === null ? null : parseIsoUtc(value.available_at);
  const remainingReveals = value.remaining_reveals === null ? null : value.remaining_reveals;
  const maxReveals = value.max_reveals === null ? null : value.max_reveals;
  if ((value.expires_at !== null && !expiresAt) || (value.available_at !== null && !availableAt) ||
      (value.password_required !== true && value.password_required !== false) ||
      (value.unlock_required !== true && value.unlock_required !== false) ||
      !isMaxReveals(maxReveals) ||
      (maxReveals === null
        ? remainingReveals !== null
        : remainingReveals === null ||
          !isNonNegativeInteger(remainingReveals) ||
          remainingReveals > maxReveals)) return null;
  if (value.status === "scheduled" && !availableAt) return null;
  return {
    status: value.status,
    availableAt,
    expiresAt,
    passwordRequired: value.password_required,
    unlockRequired: value.unlock_required,
    maxReveals,
    remainingReveals,
  } as ShareStatus;
}

export function parseStatusBatchResponse(value: unknown): ShareStatusBatchItem[] | null {
  if (!isRecord(value) || !hasExactKeys(value, ["statuses"]) || !Array.isArray(value.statuses)) return null;
  if (value.statuses.length === 0 || value.statuses.length > MAX_STATUS_BATCH_IDS) return null;

  const parsed: ShareStatusBatchItem[] = [];
  const seen = new Set<string>();
  for (const entry of value.statuses) {
    if (!isRecord(entry) || typeof entry.publicId !== "string" || !isPublicId(entry.publicId) || seen.has(entry.publicId)) return null;
    seen.add(entry.publicId);
    if (entry.status === "unavailable") {
      if (!hasExactKeys(entry, ["publicId", "status"])) return null;
      parsed.push({ publicId: entry.publicId, status: { status: "unavailable" } });
      continue;
    }
    if (!hasExactKeys(entry, [
      "publicId", "status", "availableAt", "expiresAt", "passwordRequired", "unlockRequired", "maxReveals", "remainingReveals",
    ])) return null;
    const status = parseStatus({
      status: entry.status,
      available_at: entry.availableAt,
      expires_at: entry.expiresAt,
      password_required: entry.passwordRequired,
      unlock_required: entry.unlockRequired,
      max_reveals: entry.maxReveals,
      remaining_reveals: entry.remainingReveals,
    });
    if (!status) return null;
    parsed.push({ publicId: entry.publicId, status });
  }
  return parsed;
}

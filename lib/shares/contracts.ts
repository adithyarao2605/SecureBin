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

export type MaxReveals = 1 | 3 | 5 | 10 | null;
export const VALID_MAX_REVEALS = [1, 3, 5, 10, null] as const;

export interface CreateShareInput {
  readonly publicId: string;
  readonly contentEnvelope: Envelope & { readonly objectType: "content"; readonly ciphertext: string };
  readonly availableAt: string | null;
  readonly expiresAt: string;
  readonly maxReveals: MaxReveals;
  readonly deleteTokenHash: string;
  readonly passwordRequired: boolean;
  readonly unlockRequired: boolean;
  readonly idempotencyKeyHash: string;
  readonly fileEnvelope: (Envelope & { readonly objectType: "file"; readonly version: 2; readonly ciphertext?: never }) | null;
  readonly fileCiphertextSize: number | null;
}

export interface UploadReservationInput {
  readonly publicId: string;
  readonly idempotencyKeyHash: string;
  readonly fileEnvelope: Envelope & { readonly objectType: "file"; readonly version: 2; readonly ciphertext?: never };
  readonly expectedCiphertextSize: number;
}

export interface RevealInput {
  readonly requestToken: string;
}

export interface DeleteInput {
  readonly deleteCapability: string;
}

export interface SharePolicy {
  readonly availableAt: string | null;
  readonly expiresAt: string;
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

export interface RevealFileMetadata {
  readonly envelope: Envelope & { readonly objectType: "file"; readonly version: 2; readonly ciphertext?: never };
  readonly ciphertextSize: number;
  readonly downloadUrl: string;
}

export interface RevealResult {
  readonly status: "authorized" | "unavailable" | "request_expired";
  readonly contentEnvelope: (Envelope & { readonly objectType: "content"; readonly ciphertext: string }) | null;
  readonly file?: RevealFileMetadata | null;
  readonly retryExpiresAt: string | null;
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

function isDigest(value: unknown): value is string {
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
  return value === null || value === 1 || value === 3 || value === 5 || value === 10;
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

export function parseFileEnvelope(value: unknown): NonNullable<CreateShareInput["fileEnvelope"]> | null {
  const envelope = parseEnvelope(value, "file", false);
  return envelope as NonNullable<CreateShareInput["fileEnvelope"]> | null;
}

export function parseCreateShareInput(value: unknown, nowMillis: number = Date.now()): CreateShareInput | null {
  if (!isRecord(value) || !hasOnlyKeys(value,
    ["contentEnvelope", "deleteTokenHash", "idempotencyKeyHash", "passwordRequired", "policy", "publicId", "unlockRequired"],
    ["fileCiphertextSize", "fileEnvelope"],
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
  const expiresAt = parseIsoUtc(value.policy.expiresAt);
  if (value.policy.availableAt !== null && availableAt === null || expiresAt === null) return null;
  const expiryMillis = Date.parse(expiresAt);
  if (expiryMillis <= nowMillis || expiryMillis > nowMillis + MAX_EXPIRY_DAYS * 86_400_000) return null;
  if (availableAt !== null && Date.parse(availableAt) >= expiryMillis) return null;
  const fileEnvelope = value.fileEnvelope === undefined || value.fileEnvelope === null ? null : parseFileEnvelope(value.fileEnvelope);
  const fileCiphertextSize = value.fileCiphertextSize === undefined || value.fileCiphertextSize === null ? null : value.fileCiphertextSize;
  const normalizedFileCiphertextSize = fileCiphertextSize === null || !isNonNegativeInteger(fileCiphertextSize) ? null : fileCiphertextSize;
  if (value.fileEnvelope !== undefined && value.fileEnvelope !== null && !fileEnvelope) return null;
  if (fileEnvelope === null && fileCiphertextSize !== null) return null;
  if (fileEnvelope !== null && (normalizedFileCiphertextSize === null || normalizedFileCiphertextSize < 16 || normalizedFileCiphertextSize > MAX_FILE_CIPHERTEXT_SIZE)) return null;
  if (fileEnvelope !== null && fileEnvelope.factorMask !== contentEnvelope.factorMask) return null;

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
    fileEnvelope,
    fileCiphertextSize: normalizedFileCiphertextSize,
  };
}

export function parseUploadReservationInput(value: unknown): UploadReservationInput | null {
  if (!isRecord(value) || !hasExactKeys(value, ["expectedCiphertextSize", "fileEnvelope", "idempotencyKeyHash", "publicId"])) return null;
  if (!isBase64Url(value.publicId, PUBLIC_ID_BYTES)) return null;
  if (!isDigest(value.idempotencyKeyHash)) return null;
  const fileEnvelope = parseFileEnvelope(value.fileEnvelope);
  if (!fileEnvelope) return null;
  if (typeof value.expectedCiphertextSize !== "number" || !isNonNegativeInteger(value.expectedCiphertextSize)) return null;
  if (value.expectedCiphertextSize < 16 || value.expectedCiphertextSize > MAX_FILE_CIPHERTEXT_SIZE) return null;

  return {
    publicId: value.publicId,
    idempotencyKeyHash: value.idempotencyKeyHash,
    fileEnvelope,
    expectedCiphertextSize: value.expectedCiphertextSize,
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

export function isPublicId(value: string): boolean {
  return isBase64Url(value, PUBLIC_ID_BYTES);
}

export function parseRpcEnvelope(value: unknown): CreateShareInput["contentEnvelope"] | null {
  return parseContentEnvelope(value);
}

export function parseRpcFileEnvelope(value: unknown): NonNullable<CreateShareInput["fileEnvelope"]> | null {
  return parseFileEnvelope(value);
}

export function parseStatus(value: unknown): ShareStatus | null {
  if (!isRecord(value) || typeof value.status !== "string") return null;
  if (value.status === "unavailable") return { status: "unavailable" };
  if (value.status !== "active" && value.status !== "scheduled") return null;
  const expiresAt = parseIsoUtc(value.expires_at);
  const availableAt = value.available_at === null ? null : parseIsoUtc(value.available_at);
  const remainingReveals = value.remaining_reveals === null ? null : value.remaining_reveals;
  const maxReveals = value.max_reveals === null ? null : value.max_reveals;
  if (!expiresAt || (value.available_at !== null && !availableAt) ||
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

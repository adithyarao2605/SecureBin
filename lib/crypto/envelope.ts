import { base64UrlToBytes, bytesToBase64Url, utf8Encode } from "./encoding";

export const CONTENT_FORMAT_VERSION = 1 as const;
export const CONTENT_OBJECT_TYPE = "content" as const;
export const CONTENT_ALGORITHM = "AES-256-GCM" as const;
export const CONTENT_KDF = "none" as const;
export const CONTENT_KDF_PARAMETERS = {} as const;
export const CONTENT_FACTOR_MASK = "link" as const;
export const CONTENT_HKDF_LABEL = "securebin/v1/link/content" as const;
export const MAX_CONTENT_BYTES = 512 * 1024;
export const MAX_CIPHERTEXT_BYTES = MAX_CONTENT_BYTES + 16;

export type ContentEnvelope = {
  version: typeof CONTENT_FORMAT_VERSION;
  objectType: typeof CONTENT_OBJECT_TYPE;
  algorithm: typeof CONTENT_ALGORITHM;
  nonce: string;
  hkdfSalt: string;
  passwordSalt: null;
  kdf: typeof CONTENT_KDF;
  kdfParameters: typeof CONTENT_KDF_PARAMETERS;
  factorMask: typeof CONTENT_FACTOR_MASK;
  ciphertext: string;
};

export class EnvelopeValidationError extends Error {
  readonly code = "invalid_envelope";

  constructor(message = "The encrypted envelope is not supported.") {
    super(message);
    this.name = "EnvelopeValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    throw new EnvelopeValidationError("The encrypted envelope contains unsupported fields.");
  }
}

function decodeBytes(value: unknown, field: string): Uint8Array {
  if (typeof value !== "string") throw new EnvelopeValidationError(`Invalid ${field}.`);
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(value);
  } catch {
    throw new EnvelopeValidationError(`Invalid ${field}.`);
  }
  return bytes;
}

function requireBytes(value: unknown, expectedLength: number, field: string): Uint8Array {
  const bytes = decodeBytes(value, field);
  if (bytes.length !== expectedLength) throw new EnvelopeValidationError(`Invalid ${field} length.`);
  return bytes;
}

export function validatePublicId(publicId: string): Uint8Array {
  return requireBytes(publicId, 16, "public ID");
}

export function validateLinkSecret(linkSecret: string): Uint8Array {
  return requireBytes(linkSecret, 32, "link secret");
}

export function validateContentEnvelope(value: unknown): ContentEnvelope {
  if (!isRecord(value)) throw new EnvelopeValidationError();
  requireExactKeys(value, ["version", "objectType", "algorithm", "nonce", "hkdfSalt", "passwordSalt", "kdf", "kdfParameters", "factorMask", "ciphertext"]);
  if (value.version !== CONTENT_FORMAT_VERSION || value.objectType !== CONTENT_OBJECT_TYPE || value.algorithm !== CONTENT_ALGORITHM || value.passwordSalt !== null || value.kdf !== CONTENT_KDF || !isRecord(value.kdfParameters) || Object.keys(value.kdfParameters).length !== 0 || value.factorMask !== CONTENT_FACTOR_MASK) {
    throw new EnvelopeValidationError();
  }
  requireBytes(value.nonce, 12, "nonce");
  requireBytes(value.hkdfSalt, 16, "HKDF salt");
  const ciphertext = decodeBytes(value.ciphertext, "ciphertext");
  if (ciphertext.length > MAX_CIPHERTEXT_BYTES || ciphertext.length < 16) throw new EnvelopeValidationError("Ciphertext size is outside the supported range.");
  if (typeof value.nonce !== "string" || typeof value.hkdfSalt !== "string" || typeof value.ciphertext !== "string") throw new EnvelopeValidationError();
  return {
    version: CONTENT_FORMAT_VERSION,
    objectType: CONTENT_OBJECT_TYPE,
    algorithm: CONTENT_ALGORITHM,
    nonce: value.nonce,
    hkdfSalt: value.hkdfSalt,
    passwordSalt: null,
    kdf: CONTENT_KDF,
    kdfParameters: {},
    factorMask: CONTENT_FACTOR_MASK,
    ciphertext: value.ciphertext
  };
}

export function canonicalAad(publicId: string, envelope: Pick<ContentEnvelope, "version" | "objectType" | "algorithm" | "kdf" | "kdfParameters" | "factorMask">): Uint8Array {
  validatePublicId(publicId);
  if (!isRecord(envelope.kdfParameters) || Object.keys(envelope.kdfParameters).length !== 0) throw new EnvelopeValidationError("Unsupported KDF parameters.");
  const values: readonly (string | number)[] = ["securebin", envelope.version, publicId, envelope.objectType, envelope.algorithm, envelope.kdf, JSON.stringify(envelope.kdfParameters), envelope.factorMask];
  return utf8Encode(JSON.stringify(values));
}

export function newContentEnvelope(nonce: Uint8Array, hkdfSalt: Uint8Array, ciphertext: Uint8Array): ContentEnvelope {
  return {
    version: CONTENT_FORMAT_VERSION,
    objectType: CONTENT_OBJECT_TYPE,
    algorithm: CONTENT_ALGORITHM,
    nonce: bytesToBase64Url(nonce),
    hkdfSalt: bytesToBase64Url(hkdfSalt),
    passwordSalt: null,
    kdf: CONTENT_KDF,
    kdfParameters: CONTENT_KDF_PARAMETERS,
    factorMask: CONTENT_FACTOR_MASK,
    ciphertext: bytesToBase64Url(ciphertext)
  };
}

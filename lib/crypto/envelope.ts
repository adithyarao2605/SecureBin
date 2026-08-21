import { base64UrlToBytes, bytesToBase64Url, utf8Encode } from "./encoding";

export const CONTENT_FORMAT_VERSION_V1 = 1 as const;
export const CONTENT_FORMAT_VERSION_V2 = 2 as const;
export const FILE_FORMAT_VERSION_V2 = 2 as const;

export const CONTENT_OBJECT_TYPE = "content" as const;
export const FILE_OBJECT_TYPE = "file" as const;

export const CONTENT_ALGORITHM = "AES-256-GCM" as const;
export const CONTENT_KDF = "none" as const;
export const CONTENT_KDF_PARAMETERS = {} as const;
export const CONTENT_FACTOR_MASK = "link" as const;

export const CONTENT_HKDF_LABEL_V1 = "securebin/v1/link/content" as const;
export const CONTENT_HKDF_LABEL_V2 = "securebin/v2/link/content" as const;
export const FILE_HKDF_LABEL_V2 = "securebin/v2/link/file" as const;

export const MAX_CONTENT_BYTES = 512 * 1024; // 524,288 bytes
export const MAX_CONTENT_CIPHERTEXT_BYTES_V1 = 524_304; // 524,288 + 16
export const MAX_CONTENT_CIPHERTEXT_BYTES_V2 = 524_315; // 524,288 + 11 (SBCT frame) + 16 (GCM tag)
export const MAX_FILE_CIPHERTEXT_BYTES = 10_486_422;

export type ContentEnvelope = {
  version: 1 | 2;
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

export type FileEnvelope = {
  version: 2;
  objectType: typeof FILE_OBJECT_TYPE;
  algorithm: typeof CONTENT_ALGORITHM;
  nonce: string;
  hkdfSalt: string;
  passwordSalt: null;
  kdf: typeof CONTENT_KDF;
  kdfParameters: typeof CONTENT_KDF_PARAMETERS;
  factorMask: typeof CONTENT_FACTOR_MASK;
  ciphertext?: string;
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
  requireExactKeys(value, [
    "algorithm",
    "ciphertext",
    "factorMask",
    "hkdfSalt",
    "kdf",
    "kdfParameters",
    "nonce",
    "objectType",
    "passwordSalt",
    "version",
  ]);

  if (
    (value.version !== 1 && value.version !== 2) ||
    value.objectType !== CONTENT_OBJECT_TYPE ||
    value.algorithm !== CONTENT_ALGORITHM ||
    value.passwordSalt !== null ||
    value.kdf !== CONTENT_KDF ||
    !isRecord(value.kdfParameters) ||
    Object.keys(value.kdfParameters).length !== 0 ||
    value.factorMask !== CONTENT_FACTOR_MASK
  ) {
    throw new EnvelopeValidationError();
  }

  requireBytes(value.nonce, 12, "nonce");
  requireBytes(value.hkdfSalt, 16, "HKDF salt");

  const ciphertext = decodeBytes(value.ciphertext, "ciphertext");
  const maxCiphertext =
    value.version === 1 ? MAX_CONTENT_CIPHERTEXT_BYTES_V1 : MAX_CONTENT_CIPHERTEXT_BYTES_V2;

  if (ciphertext.length > maxCiphertext || ciphertext.length < 16) {
    throw new EnvelopeValidationError("Ciphertext size is outside the supported range.");
  }

  if (
    typeof value.nonce !== "string" ||
    typeof value.hkdfSalt !== "string" ||
    typeof value.ciphertext !== "string"
  ) {
    throw new EnvelopeValidationError();
  }

  return {
    version: value.version,
    objectType: CONTENT_OBJECT_TYPE,
    algorithm: CONTENT_ALGORITHM,
    nonce: value.nonce,
    hkdfSalt: value.hkdfSalt,
    passwordSalt: null,
    kdf: CONTENT_KDF,
    kdfParameters: {},
    factorMask: CONTENT_FACTOR_MASK,
    ciphertext: value.ciphertext,
  };
}

export function validateFileEnvelope(value: unknown, requireCiphertext = false): FileEnvelope {
  if (!isRecord(value)) throw new EnvelopeValidationError();
  const expectedKeys = requireCiphertext
    ? [
        "algorithm",
        "ciphertext",
        "factorMask",
        "hkdfSalt",
        "kdf",
        "kdfParameters",
        "nonce",
        "objectType",
        "passwordSalt",
        "version",
      ]
    : [
        "algorithm",
        "factorMask",
        "hkdfSalt",
        "kdf",
        "kdfParameters",
        "nonce",
        "objectType",
        "passwordSalt",
        "version",
      ];

  requireExactKeys(value, expectedKeys);

  // File envelopes MUST be version 2 in Day 3
  if (
    value.version !== 2 ||
    value.objectType !== FILE_OBJECT_TYPE ||
    value.algorithm !== CONTENT_ALGORITHM ||
    value.passwordSalt !== null ||
    value.kdf !== CONTENT_KDF ||
    !isRecord(value.kdfParameters) ||
    Object.keys(value.kdfParameters).length !== 0 ||
    value.factorMask !== CONTENT_FACTOR_MASK
  ) {
    throw new EnvelopeValidationError("Invalid file envelope metadata.");
  }

  requireBytes(value.nonce, 12, "nonce");
  requireBytes(value.hkdfSalt, 16, "HKDF salt");

  if (requireCiphertext) {
    const ciphertext = decodeBytes(value.ciphertext, "ciphertext");
    if (ciphertext.length > MAX_FILE_CIPHERTEXT_BYTES || ciphertext.length < 16) {
      throw new EnvelopeValidationError("File ciphertext size is outside the supported range.");
    }
  }

  if (typeof value.nonce !== "string" || typeof value.hkdfSalt !== "string") {
    throw new EnvelopeValidationError();
  }

  const result: FileEnvelope = {
    version: 2,
    objectType: FILE_OBJECT_TYPE,
    algorithm: CONTENT_ALGORITHM,
    nonce: value.nonce,
    hkdfSalt: value.hkdfSalt,
    passwordSalt: null,
    kdf: CONTENT_KDF,
    kdfParameters: {},
    factorMask: CONTENT_FACTOR_MASK,
  };

  if (requireCiphertext && typeof value.ciphertext === "string") {
    return {
      ...result,
      ciphertext: value.ciphertext,
    };
  }

  return result;
}

export function canonicalAad(
  publicId: string,
  envelope: {
    readonly version: number;
    readonly objectType: string;
    readonly algorithm: string;
    readonly kdf: string;
    readonly kdfParameters: Readonly<Record<string, unknown>>;
    readonly factorMask: string;
  }
): Uint8Array {
  validatePublicId(publicId);
  if (!isRecord(envelope.kdfParameters) || Object.keys(envelope.kdfParameters).length !== 0) {
    throw new EnvelopeValidationError("Unsupported KDF parameters.");
  }
  const values: readonly (string | number)[] = [
    "securebin",
    envelope.version,
    publicId,
    envelope.objectType,
    envelope.algorithm,
    envelope.kdf,
    JSON.stringify(envelope.kdfParameters),
    envelope.factorMask,
  ];
  return utf8Encode(JSON.stringify(values));
}

export function newContentEnvelope(
  nonce: Uint8Array,
  hkdfSalt: Uint8Array,
  ciphertext: Uint8Array,
  version: 1 | 2 = 2
): ContentEnvelope {
  return {
    version,
    objectType: CONTENT_OBJECT_TYPE,
    algorithm: CONTENT_ALGORITHM,
    nonce: bytesToBase64Url(nonce),
    hkdfSalt: bytesToBase64Url(hkdfSalt),
    passwordSalt: null,
    kdf: CONTENT_KDF,
    kdfParameters: CONTENT_KDF_PARAMETERS,
    factorMask: CONTENT_FACTOR_MASK,
    ciphertext: bytesToBase64Url(ciphertext),
  };
}

export function newFileEnvelope(
  nonce: Uint8Array,
  hkdfSalt: Uint8Array,
  ciphertext?: Uint8Array
): FileEnvelope {
  const envelope: FileEnvelope = {
    version: 2,
    objectType: FILE_OBJECT_TYPE,
    algorithm: CONTENT_ALGORITHM,
    nonce: bytesToBase64Url(nonce),
    hkdfSalt: bytesToBase64Url(hkdfSalt),
    passwordSalt: null,
    kdf: CONTENT_KDF,
    kdfParameters: CONTENT_KDF_PARAMETERS,
    factorMask: CONTENT_FACTOR_MASK,
  };

  if (ciphertext !== undefined) {
    return {
      ...envelope,
      ciphertext: bytesToBase64Url(ciphertext),
    };
  }

  return envelope;
}

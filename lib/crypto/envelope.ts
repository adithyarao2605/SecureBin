import { base64UrlToBytes, bytesToBase64Url, utf8Encode } from "./encoding";

export const PBKDF2_ITERATIONS = 600000 as const;
export const PASSWORD_SALT_BYTES = 16 as const;

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

export type EnvelopeFactorMask =
  | typeof CONTENT_FACTOR_MASK
  | "link+password"
  | "link+unlock"
  | "link+password+unlock";

export type EnvelopeKdf = typeof CONTENT_KDF | "PBKDF2-HMAC-SHA-256";

interface EnvelopeBase {
  version: 1 | 2;
  objectType: typeof CONTENT_OBJECT_TYPE | typeof FILE_OBJECT_TYPE;
  algorithm: typeof CONTENT_ALGORITHM;
  nonce: string;
  hkdfSalt: string;
  passwordSalt: string | null;
  kdf: EnvelopeKdf;
  kdfParameters: Readonly<Record<string, number>>;
  factorMask: EnvelopeFactorMask;
}

export type ContentEnvelope = EnvelopeBase & {
  version: 1 | 2;
  objectType: typeof CONTENT_OBJECT_TYPE;
  ciphertext: string;
};

export type FileEnvelope = Omit<EnvelopeBase, "version" | "objectType"> & {
  version: 2;
  objectType: typeof FILE_OBJECT_TYPE;
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
    typeof value.kdf !== "string" ||
    !isRecord(value.kdfParameters)
  ) {
    throw new EnvelopeValidationError();
  }

  // Factor-mask rules mirror lib/shares/contracts.parseEnvelope exactly:
  // link/link+unlock use no KDF and no salt; password masks require PBKDF2
  // with the locked iteration count and a 16-byte salt.
  const mask = value.factorMask;
  const hasPassword = mask === "link+password" || mask === "link+password+unlock";
  const expectedKdf = hasPassword ? "PBKDF2-HMAC-SHA-256" : "none";
  const validMask =
    mask === "link" || mask === "link+password" || mask === "link+unlock" || mask === "link+password+unlock";
  const kdfOk =
    value.kdf === expectedKdf &&
    (hasPassword
      ? Object.keys(value.kdfParameters).length === 1 &&
        value.kdfParameters.iterations === PBKDF2_ITERATIONS
      : Object.keys(value.kdfParameters).length === 0);
  const saltOk = hasPassword
    ? typeof value.passwordSalt === "string" && base64UrlToBytes(value.passwordSalt).length === PASSWORD_SALT_BYTES
    : value.passwordSalt === null;

  if (
    !validMask ||
    !kdfOk ||
    !saltOk ||
    typeof value.nonce !== "string" ||
    typeof value.hkdfSalt !== "string"
  ) {
    throw new EnvelopeValidationError();
  }

  const nonceBytes = requireBytes(value.nonce, 12, "nonce");
  const hkdfSaltBytes = requireBytes(value.hkdfSalt, 16, "HKDF salt");
  void hkdfSaltBytes;

  const ciphertext = decodeBytes(value.ciphertext, "ciphertext");
  const maxCiphertext =
    value.version === 1 ? MAX_CONTENT_CIPHERTEXT_BYTES_V1 : MAX_CONTENT_CIPHERTEXT_BYTES_V2;

  if (ciphertext.length > maxCiphertext || ciphertext.length < 16) {
    throw new EnvelopeValidationError("Ciphertext size is outside the supported range.");
  }

  return {
    version: value.version as 1 | 2,
    objectType: CONTENT_OBJECT_TYPE,
    algorithm: CONTENT_ALGORITHM,
    nonce: bytesToBase64Url(nonceBytes),
    hkdfSalt: bytesToBase64Url(hkdfSaltBytes),
    passwordSalt: hasPassword ? bytesToBase64Url(base64UrlToBytes(value.passwordSalt as string)) : null,
    kdf: expectedKdf as EnvelopeKdf,
    kdfParameters: hasPassword ? { iterations: PBKDF2_ITERATIONS } : {},
    factorMask: mask as EnvelopeFactorMask,
    ciphertext: bytesToBase64Url(ciphertext),
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
    (value.factorMask !== "link" && value.factorMask !== "link+password" && value.factorMask !== "link+unlock" && value.factorMask !== "link+password+unlock")
  ) {
    throw new EnvelopeValidationError("Invalid file envelope metadata.");
  }

  const nonce = requireBytes(value.nonce, 12, "nonce");
  const hkdfSalt = requireBytes(value.hkdfSalt, 16, "HKDF salt");

  // Masked file envelopes carry a PBKDF2 block exactly like the server and
  // sealFile produce; link-masked ones must not.
  const expectsKdf = value.factorMask === "link+password" || value.factorMask === "link+password+unlock";
  if (value.kdf !== (expectsKdf ? "PBKDF2-HMAC-SHA-256" : "none")) {
    throw new EnvelopeValidationError("Invalid file envelope KDF.");
  }
  if (!isRecord(value.kdfParameters)) throw new EnvelopeValidationError("Invalid file envelope KDF parameters.");
  if (expectsKdf) {
    const kdfKeys = Object.keys(value.kdfParameters).sort();
    if (
      kdfKeys.length !== 1 ||
      kdfKeys[0] !== "iterations" ||
      (value.kdfParameters as Record<string, unknown>).iterations !== 600000 ||
      typeof value.passwordSalt !== "string"
    ) {
      throw new EnvelopeValidationError("Invalid file envelope PBKDF2 block.");
    }
    decodeBytes(value.passwordSalt, "password salt");
  } else {
    if (Object.keys(value.kdfParameters).length !== 0 || value.passwordSalt !== null) {
      throw new EnvelopeValidationError("Invalid file envelope factor metadata.");
    }
  }

  const ciphertext = requireCiphertext ? decodeBytes(value.ciphertext, "ciphertext") : null;
  if (ciphertext && (ciphertext.length > MAX_FILE_CIPHERTEXT_BYTES || ciphertext.length < 16)) {
    throw new EnvelopeValidationError("File ciphertext size is outside the supported range.");
  }

  const result: FileEnvelope = {
    version: 2,
    objectType: FILE_OBJECT_TYPE,
    algorithm: CONTENT_ALGORITHM,
    nonce: bytesToBase64Url(nonce),
    hkdfSalt: bytesToBase64Url(hkdfSalt),
    // Preserve the masked factor block exactly as sealed — the AAD binds to
    // it, and openFile derives its IKM from it.
    passwordSalt:
      expectsKdf ? bytesToBase64Url(decodeBytes(value.passwordSalt, "password salt")) : null,
    kdf: expectsKdf ? "PBKDF2-HMAC-SHA-256" : "none",
    kdfParameters: expectsKdf ? { iterations: 600000 } : {},
    factorMask: value.factorMask,
  };

  if (ciphertext) {
    return {
      ...result,
      ciphertext: bytesToBase64Url(ciphertext),
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
  if (!isRecord(envelope.kdfParameters)) {
    throw new EnvelopeValidationError("Unsupported KDF parameters.");
  }
  const keys = Object.keys(envelope.kdfParameters).sort();
  const allowed: Record<string, unknown> = { iterations: PBKDF2_ITERATIONS };
  for (const key of keys) {
    if (allowed[key] !== envelope.kdfParameters[key]) {
      throw new EnvelopeValidationError("Unsupported KDF parameters.");
    }
  }
  // Canonical serialization: sorted keys, so the AAD is byte-stable.
  const canonicalParameters = JSON.stringify(
    Object.fromEntries(keys.map((key) => [key, envelope.kdfParameters[key]]))
  );
  const values: readonly (string | number)[] = [
    "securebin",
    envelope.version,
    publicId,
    envelope.objectType,
    envelope.algorithm,
    envelope.kdf,
    canonicalParameters,
    envelope.factorMask,
  ];
  return utf8Encode(JSON.stringify(values));
}

export type EnvelopeKdfOptions = {
  readonly factorMask?: "link" | "link+password" | "link+unlock" | "link+password+unlock";
  /** PBKDF2 salt (bytes or base64url); required when the mask includes a password. */
  readonly passwordSalt?: Uint8Array | string | null;
  readonly kdf?: "none" | "PBKDF2-HMAC-SHA-256";
  readonly kdfParameters?: Readonly<Record<string, number>>;
};

function kdfFields(options?: EnvelopeKdfOptions): {
  factorMask: EnvelopeFactorMask;
  passwordSalt: string | null;
  kdf: EnvelopeKdf;
  kdfParameters: Readonly<Record<string, number>>;
} {
  const factorMask: EnvelopeFactorMask = options?.factorMask ?? CONTENT_FACTOR_MASK;
  const hasPassword = factorMask.includes("password");
  const rawSalt = options?.passwordSalt ?? null;
  const passwordSalt =
    hasPassword && rawSalt ? (typeof rawSalt === "string" ? rawSalt : bytesToBase64Url(rawSalt)) : null;
  return {
    factorMask,
    passwordSalt,
    kdf: (hasPassword ? "PBKDF2-HMAC-SHA-256" : "none") as "none" | "PBKDF2-HMAC-SHA-256",
    kdfParameters: hasPassword ? { iterations: 600000 } : {},
  };
}

export function newContentEnvelope(
  nonce: Uint8Array,
  hkdfSalt: Uint8Array,
  ciphertext: Uint8Array,
  version: 1 | 2 = 2,
  options?: EnvelopeKdfOptions
): ContentEnvelope {
  return {
    version,
    objectType: CONTENT_OBJECT_TYPE,
    algorithm: CONTENT_ALGORITHM,
    nonce: bytesToBase64Url(nonce),
    hkdfSalt: bytesToBase64Url(hkdfSalt),
    ...kdfFields(options),
    ciphertext: bytesToBase64Url(ciphertext),
  };
}

export function newFileEnvelope(
  nonce: Uint8Array,
  hkdfSalt: Uint8Array,
  ciphertext?: Uint8Array,
  options?: EnvelopeKdfOptions
): FileEnvelope {
  const envelope: FileEnvelope = {
    version: 2,
    objectType: FILE_OBJECT_TYPE,
    algorithm: CONTENT_ALGORITHM,
    nonce: bytesToBase64Url(nonce),
    hkdfSalt: bytesToBase64Url(hkdfSalt),
    ...kdfFields(options),
  };

  if (ciphertext !== undefined) {
    return {
      ...envelope,
      ciphertext: bytesToBase64Url(ciphertext),
    };
  }

  return envelope;
}

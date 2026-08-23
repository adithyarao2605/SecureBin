import {
  base64UrlToBytes,
  bytesToArrayBuffer,
  bytesToBase64Url,
  randomBytes,
  sha256Base64Url,
  utf8Decode,
  utf8Encode,
} from "./encoding";
import {
  canonicalAad,
  CONTENT_HKDF_LABEL_V1,
  CONTENT_HKDF_LABEL_V2,
  MAX_CONTENT_BYTES,
  newContentEnvelope,
  validateContentEnvelope,
  validateLinkSecret,
  validatePublicId,
  type ContentEnvelope,
} from "./envelope";
import {
  decodeContentPayload,
  decodeContentPayloadWithCapability,
  encodeContentPayload,
  type ContentPayload,
} from "./payload";
import { generateShareContext, type ShareCryptoContext } from "./share-context";
import { buildFactorIkm, type FactorInputs, type FactorMask } from "./factors";

export type SealedContent = {
  readonly publicId: string;
  readonly linkSecret: string;
  readonly deleteCapability: string;
  readonly idempotencyKey: string;
  readonly envelope: ContentEnvelope;
  readonly context: ShareCryptoContext;
};

export class ContentCryptoError extends Error {
  readonly code: "content_too_large" | "wrong_key" | "invalid_content";

  constructor(code: ContentCryptoError["code"], message: string) {
    super(message);
    this.name = "ContentCryptoError";
    this.code = code;
  }
}

async function deriveContentKey(
  linkSecret: string,
  hkdfSalt: Uint8Array,
  version: 1 | 2,
  options?: { mask?: FactorMask; ikmOverride?: Uint8Array }
): Promise<CryptoKey> {
  const mask: FactorMask = options?.mask ?? "link";
  const label = `securebin/v${version}/${mask}/content`;
  const rawIkm = options?.ikmOverride
    ? bytesToArrayBuffer(options.ikmOverride)
    : bytesToArrayBuffer(validateLinkSecret(linkSecret));
  const ikm = await crypto.subtle.importKey("raw", rawIkm, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: bytesToArrayBuffer(hkdfSalt),
      info: bytesToArrayBuffer(utf8Encode(label)),
    },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface ContentFactorOptions {
  /** Factor mask; defaults to the context's mask (link-only shares). */
  readonly mask?: FactorMask;
  readonly passwordSalt?: Uint8Array | string | null;
  readonly password?: string;
  readonly unlockCode?: string;
  readonly unlockBytes?: Uint8Array;
}

/** Build the masked IKM for a share, honoring its factor mask. */
export async function contentIkm(
  linkSecret: string,
  options: ContentFactorOptions = {}
): Promise<Uint8Array> {
  if (!options.mask || options.mask === "link") {
    return validateLinkSecret(linkSecret);
  }
  return buildFactorIkm(linkSecret, options.mask, {
    password: options.password,
    passwordSalt: options.passwordSalt ?? undefined,
    unlockCode: options.unlockCode,
    unlockBytes: options.unlockBytes,
  });
}

export type SealedFactorArgs = ContentFactorOptions & { mask: FactorMask };

export async function sealContent(
  input: string | ContentPayload,
  customContext?: ShareCryptoContext,
  factors?: SealedFactorArgs,
  options?: { readonly discussionCapability?: Uint8Array }
): Promise<SealedContent> {
  const payload: ContentPayload =
    typeof input === "string" ? { mode: "note", text: input } : input;

  const framedBytes = encodeContentPayload(payload, {
    discussionCapability: options?.discussionCapability,
  });
  const context = customContext ?? generateShareContext();

  const nonce = randomBytes(12);
  const ikm = await contentIkm(context.linkSecret, {
    ...factors,
    passwordSalt: factors?.passwordSalt ?? null,
  });
  const key = await deriveContentKey(context.linkSecret, context.hkdfSalt, 2, { ikmOverride: ikm });

  const shape = newContentEnvelope(
    nonce,
    context.hkdfSalt,
    new Uint8Array(16),
    2,
    factors
      ? {
          factorMask: factors.mask,
          passwordSalt:
            factors.mask.includes("password") ? factors.passwordSalt ?? null : null,
          kdf: factors.mask.includes("password") ? ("PBKDF2-HMAC-SHA-256" as const) : ("none" as const),
          kdfParameters: factors.mask.includes("password") ? { iterations: 600000 } : {},
        }
      : undefined
  );
  const aad = canonicalAad(context.publicId, shape);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bytesToArrayBuffer(nonce), additionalData: bytesToArrayBuffer(aad) },
    key,
    bytesToArrayBuffer(framedBytes)
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);
  const envelope = newContentEnvelope(nonce, context.hkdfSalt, ciphertext, 2, factors
    ? {
        factorMask: factors.mask,
        passwordSalt:
          factors.mask.includes("password") ? factors.passwordSalt ?? null : null,
        kdf: factors.mask.includes("password") ? ("PBKDF2-HMAC-SHA-256" as const) : ("none" as const),
        kdfParameters: factors.mask.includes("password") ? { iterations: 600000 } : {},
      }
    : undefined);

  return {
    publicId: context.publicId,
    linkSecret: context.linkSecret,
    deleteCapability: context.deleteCapability,
    idempotencyKey: context.idempotencyKey,
    envelope,
    context,
  };
}

export async function openContent(
  envelopeValue: unknown,
  publicId: string,
  linkSecret: string,
  factors?: ContentFactorOptions
): Promise<ContentPayload & { readonly discussionCapability?: Uint8Array | null }> {
  const envelope = validateContentEnvelope(envelopeValue);
  validatePublicId(publicId);
  validateLinkSecret(linkSecret);

  const nonce = base64UrlToBytes(envelope.nonce);
  const hkdfSalt = base64UrlToBytes(envelope.hkdfSalt);
  const ciphertext = base64UrlToBytes(envelope.ciphertext);
  const ikm = await contentIkm(linkSecret, {
    ...factors,
    mask: envelope.factorMask as FactorMask,
    passwordSalt: envelope.passwordSalt,
  });
  const key = await deriveContentKey(linkSecret, hkdfSalt, envelope.version, { ikmOverride: ikm });
  const aad = canonicalAad(publicId, envelope);

  let plaintextBytes: Uint8Array;
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytesToArrayBuffer(nonce), additionalData: bytesToArrayBuffer(aad) },
      key,
      bytesToArrayBuffer(ciphertext)
    );
    plaintextBytes = new Uint8Array(decrypted);
  } catch {
    throw new ContentCryptoError("wrong_key", "The link key could not open this share.");
  }
  void plaintextBytes;

  // v2 frames may carry a discussion capability block (SBCT payload 0x02).
  if (envelope.version === 2) {
    let decoded: ReturnType<typeof decodeContentPayloadWithCapability>;
    try {
      decoded = decodeContentPayloadWithCapability(plaintextBytes);
    } catch {
      throw new ContentCryptoError("invalid_content", "The decrypted content payload format is invalid.");
    }
    return decoded.discussionCapability
      ? { ...decoded.payload, discussionCapability: decoded.discussionCapability }
      : decoded.payload;
  }

  // Version 1 is legacy whole-note UTF-8 plaintext
  if (envelope.version === 1) {
    try {
      const text = utf8Decode(plaintextBytes);
      if (utf8Encode(text).length > MAX_CONTENT_BYTES) {
        throw new ContentCryptoError("invalid_content", "The decrypted text is too large.");
      }
      return { mode: "note", text };
    } catch (error) {
      if (error instanceof ContentCryptoError) throw error;
      throw new ContentCryptoError("invalid_content", "Legacy note is not valid UTF-8.");
    }
  }

  // Version 2 uses SBCT binary framing
  try {
    return decodeContentPayload(plaintextBytes);
  } catch (error) {
    throw new ContentCryptoError(
      "invalid_content",
      error instanceof Error ? error.message : "Invalid content payload framing."
    );
  }
}

export async function digestCapability(capability: string): Promise<string> {
  return sha256Base64Url(capability);
}

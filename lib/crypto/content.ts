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
  encodeContentPayload,
  type ContentPayload,
} from "./payload";
import { generateShareContext, type ShareCryptoContext } from "./share-context";

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
  version: 1 | 2
): Promise<CryptoKey> {
  const label = version === 1 ? CONTENT_HKDF_LABEL_V1 : CONTENT_HKDF_LABEL_V2;
  const ikm = await crypto.subtle.importKey(
    "raw",
    bytesToArrayBuffer(validateLinkSecret(linkSecret)),
    "HKDF",
    false,
    ["deriveKey"]
  );
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

export async function sealContent(
  input: string | ContentPayload,
  customContext?: ShareCryptoContext
): Promise<SealedContent> {
  const payload: ContentPayload =
    typeof input === "string" ? { mode: "note", text: input } : input;

  const framedBytes = encodeContentPayload(payload);
  const context = customContext ?? generateShareContext();

  const nonce = randomBytes(12);
  const key = await deriveContentKey(context.linkSecret, context.hkdfSalt, 2);

  const shape = newContentEnvelope(nonce, context.hkdfSalt, new Uint8Array(16), 2);
  const aad = canonicalAad(context.publicId, shape);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bytesToArrayBuffer(nonce), additionalData: bytesToArrayBuffer(aad) },
    key,
    bytesToArrayBuffer(framedBytes)
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);
  const envelope = newContentEnvelope(nonce, context.hkdfSalt, ciphertext, 2);

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
  linkSecret: string
): Promise<ContentPayload> {
  const envelope = validateContentEnvelope(envelopeValue);
  validatePublicId(publicId);
  validateLinkSecret(linkSecret);

  const nonce = base64UrlToBytes(envelope.nonce);
  const hkdfSalt = base64UrlToBytes(envelope.hkdfSalt);
  const ciphertext = base64UrlToBytes(envelope.ciphertext);
  const key = await deriveContentKey(linkSecret, hkdfSalt, envelope.version);
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

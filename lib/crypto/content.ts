import { base64UrlToBytes, bytesToArrayBuffer, bytesToBase64Url, randomBytes, sha256Base64Url, utf8Decode, utf8Encode } from "./encoding";
import { canonicalAad, ContentEnvelope, CONTENT_HKDF_LABEL, MAX_CONTENT_BYTES, newContentEnvelope, validateContentEnvelope, validateLinkSecret, validatePublicId } from "./envelope";

export type SealedContent = {
  publicId: string;
  linkSecret: string;
  deleteCapability: string;
  idempotencyKey: string;
  envelope: ContentEnvelope;
};

export class ContentCryptoError extends Error {
  readonly code: "content_too_large" | "wrong_key" | "invalid_content";

  constructor(code: ContentCryptoError["code"], message: string) {
    super(message);
    this.name = "ContentCryptoError";
    this.code = code;
  }
}

async function deriveContentKey(linkSecret: string, publicId: string, hkdfSalt: Uint8Array): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey("raw", bytesToArrayBuffer(validateLinkSecret(linkSecret)), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: bytesToArrayBuffer(hkdfSalt), info: bytesToArrayBuffer(utf8Encode(CONTENT_HKDF_LABEL)) }, ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function sealContent(plaintext: string): Promise<SealedContent> {
  const plaintextBytes = utf8Encode(plaintext);
  if (plaintextBytes.length > MAX_CONTENT_BYTES) throw new ContentCryptoError("content_too_large", "Text is larger than the 512 KiB limit.");
  const publicIdBytes = randomBytes(16);
  const linkSecretBytes = randomBytes(32);
  const publicId = bytesToBase64Url(publicIdBytes);
  const linkSecret = bytesToBase64Url(linkSecretBytes);
  const deleteCapability = bytesToBase64Url(randomBytes(32));
  const idempotencyKey = bytesToBase64Url(randomBytes(32));
  const nonce = randomBytes(12);
  const hkdfSalt = randomBytes(16);
  const shape = newContentEnvelope(nonce, hkdfSalt, new Uint8Array(16));
  const key = await deriveContentKey(linkSecret, publicId, hkdfSalt);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: bytesToArrayBuffer(nonce), additionalData: bytesToArrayBuffer(canonicalAad(publicId, shape)) }, key, bytesToArrayBuffer(plaintextBytes)));
  const envelope = newContentEnvelope(nonce, hkdfSalt, ciphertext);
  return { publicId, linkSecret, deleteCapability, idempotencyKey, envelope };
}

export async function openContent(envelopeValue: unknown, publicId: string, linkSecret: string): Promise<string> {
  const envelope = validateContentEnvelope(envelopeValue);
  validatePublicId(publicId);
  validateLinkSecret(linkSecret);
  const nonce = base64UrlToBytes(envelope.nonce);
  const hkdfSalt = base64UrlToBytes(envelope.hkdfSalt);
  const ciphertext = base64UrlToBytes(envelope.ciphertext);
  const key = await deriveContentKey(linkSecret, publicId, hkdfSalt);
  try {
    const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytesToArrayBuffer(nonce), additionalData: bytesToArrayBuffer(canonicalAad(publicId, envelope)) }, key, bytesToArrayBuffer(ciphertext)));
    const result = utf8Decode(plaintext);
    if (utf8Encode(result).length > MAX_CONTENT_BYTES) throw new ContentCryptoError("invalid_content", "The decrypted text is too large.");
    return result;
  } catch (error) {
    if (error instanceof ContentCryptoError) throw error;
    throw new ContentCryptoError("wrong_key", "The link key could not open this share.");
  }
}

export async function digestCapability(capability: string): Promise<string> {
  return sha256Base64Url(capability);
}

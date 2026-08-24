import { base64UrlToBytes, bytesToArrayBuffer, bytesToBase64Url, randomBytes, utf8Decode } from "./encoding";
import type { FactorMask } from "./factors";

/**
 * Discussion thread cryptography.
 *
 * The discussion key is derived from the raw capability (which only revealed
 * recipients possess) under a dedicated HKDF label, salted with the share's
 * hkdfSalt so it is bound to this specific share. Bodies and nicknames are
 * sealed independently with fresh nonces; the server stores opaque jsonb.
 */

export const DISCUSSION_HKDF_LABEL_SUFFIX = "/discussion";
export const MAX_DISCUSSION_BODY_PLAINTEXT_BYTES = 4_096;
export const MAX_DISCUSSION_NICKNAME_PLAINTEXT_BYTES = 1_024;
export const MAX_DISCUSSION_BODY_CIPHERTEXT_BYTES = MAX_DISCUSSION_BODY_PLAINTEXT_BYTES + 16;
export const MAX_DISCUSSION_NICKNAME_CIPHERTEXT_BYTES = MAX_DISCUSSION_NICKNAME_PLAINTEXT_BYTES + 16;

export interface DiscussionEnvelope {
  readonly version: 1;
  readonly objectType: "discussion";
  readonly algorithm: "AES-256-GCM";
  readonly nonce: string;
  readonly ciphertext: string;
}

const ENCODER = new TextEncoder();

async function importRaw(bytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", bytesToArrayBuffer(bytes), "HKDF", false, ["deriveKey"]);
}

export async function deriveDiscussionKey(options: {
  capability: Uint8Array;
  hkdfSalt: Uint8Array;
  mask: FactorMask;
}): Promise<CryptoKey> {
  const ikm = await importRaw(options.capability);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: bytesToArrayBuffer(options.hkdfSalt),
      info: ENCODER.encode(`securebin/v2/${options.mask}${DISCUSSION_HKDF_LABEL_SUFFIX}`),
    },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function envelopeShape(nonceB64: string, ctB64: string): DiscussionEnvelope {
  return {
    version: 1,
    objectType: "discussion",
    algorithm: "AES-256-GCM",
    nonce: nonceB64,
    ciphertext: ctB64,
  };
}

export function validateDiscussionEnvelope(
  value: unknown,
  maxCiphertextBytes = MAX_DISCUSSION_BODY_CIPHERTEXT_BYTES
): DiscussionEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("invalid discussion envelope");
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(",") !== "algorithm,ciphertext,nonce,objectType,version") throw new Error("invalid discussion envelope");
  if (record.version !== 1 || record.objectType !== "discussion" || record.algorithm !== "AES-256-GCM") throw new Error("invalid discussion envelope");
  if (typeof record.nonce !== "string" || typeof record.ciphertext !== "string") throw new Error("invalid discussion envelope");
  let nonce: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    nonce = base64UrlToBytes(record.nonce);
    ciphertext = base64UrlToBytes(record.ciphertext);
  } catch {
    throw new Error("invalid discussion envelope");
  }
  if (nonce.length !== 12 || ciphertext.length < 16 || ciphertext.length > maxCiphertextBytes) throw new Error("invalid discussion envelope");
  return { version: 1, objectType: "discussion", algorithm: "AES-256-GCM", nonce: bytesToBase64Url(nonce), ciphertext: bytesToBase64Url(ciphertext) };
}

export async function sealDiscussionText(
  key: CryptoKey,
  plaintext: string
): Promise<DiscussionEnvelope> {
  const nonce = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bytesToArrayBuffer(nonce) },
    key,
    bytesToArrayBuffer(ENCODER.encode(plaintext))
  );
  return envelopeShape(
    btoa(String.fromCharCode(...nonce)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""),
    btoa(String.fromCharCode(...new Uint8Array(ct)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
  );
}

export async function openDiscussionText(key: CryptoKey, envelope: unknown): Promise<string> {
  const record = validateDiscussionEnvelope(envelope);
  const nonce = base64UrlToBytes(record.nonce);
  const ciphertext = base64UrlToBytes(record.ciphertext);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesToArrayBuffer(nonce) },
    key,
    bytesToArrayBuffer(ciphertext)
  );
  return utf8Decode(new Uint8Array(plain));
}

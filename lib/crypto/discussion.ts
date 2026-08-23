import { base64UrlToBytes, bytesToArrayBuffer, randomBytes, utf8Decode } from "./encoding";
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

function envelopeShape(nonceB64: string, ctB64: string): Record<string, unknown> {
  return {
    version: 1,
    objectType: "discussion",
    algorithm: "AES-256-GCM",
    nonce: nonceB64,
    ciphertext: ctB64,
  };
}

export async function sealDiscussionText(
  key: CryptoKey,
  plaintext: string
): Promise<Record<string, unknown>> {
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
  if (typeof envelope !== "object" || envelope === null) {
    throw new Error("invalid discussion envelope");
  }
  const record = envelope as Record<string, unknown>;
  const nonce = base64UrlToBytes(record.nonce as string);
  const ciphertext = base64UrlToBytes(record.ciphertext as string);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesToArrayBuffer(nonce) },
    key,
    bytesToArrayBuffer(ciphertext)
  );
  return utf8Decode(new Uint8Array(plain));
}

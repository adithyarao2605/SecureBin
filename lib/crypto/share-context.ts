import { bytesToBase64Url, randomBytes } from "./encoding";
import { validateLinkSecret, validatePublicId } from "./envelope";

export interface ShareCryptoContext {
  readonly publicId: string;
  readonly linkSecret: string;
  readonly deleteCapability: string;
  readonly idempotencyKey: string;
  readonly hkdfSalt: Uint8Array;
  readonly factorMask: "link";
}

export function generateShareContext(): ShareCryptoContext {
  const publicId = bytesToBase64Url(randomBytes(16));
  const linkSecret = bytesToBase64Url(randomBytes(32));
  const deleteCapability = bytesToBase64Url(randomBytes(32));
  const idempotencyKey = bytesToBase64Url(randomBytes(32));
  const hkdfSalt = randomBytes(16);

  return {
    publicId,
    linkSecret,
    deleteCapability,
    idempotencyKey,
    hkdfSalt,
    factorMask: "link",
  };
}

export function validateShareContextInput(publicId: string, linkSecret: string): {
  publicIdBytes: Uint8Array;
  linkSecretBytes: Uint8Array;
} {
  return {
    publicIdBytes: validatePublicId(publicId),
    linkSecretBytes: validateLinkSecret(linkSecret),
  };
}

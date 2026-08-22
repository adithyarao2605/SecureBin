import {
  base64UrlToBytes,
  bytesToArrayBuffer,
  bytesToBase64Url,
  randomBytes,
  utf8Decode,
  utf8Encode,
} from "./encoding";
import {
  canonicalAad,
  FILE_HKDF_LABEL_V2,
  newFileEnvelope,
  validateFileEnvelope,
  validateLinkSecret,
  validatePublicId,
  type FileEnvelope,
} from "./envelope";
import type { ShareCryptoContext } from "./share-context";
import { buildFactorIkm, type FactorMask } from "./factors";

export const MAX_FILE_PLAINTEXT_BYTES = 10_485_760; // 10 MiB
export const MAX_FILENAME_BYTES = 512;
export const MAX_MIME_BYTES = 128;
export const FILE_HEADER_BYTES = 6;
export const GCM_TAG_BYTES = 16;
export const MAX_FILE_CIPHERTEXT_SIZE = 10_486_422; // 10_485_760 + 512 + 128 + 6 + 16

export interface FilePayload {
  readonly filename: string;
  readonly mimeType: string;
  readonly data: Uint8Array;
}

export interface SealedFile {
  readonly envelope: FileEnvelope;
  readonly ciphertext: Uint8Array;
  readonly ciphertextSize: number;
}

export class FileCryptoError extends Error {
  readonly code:
    | "file_too_large"
    | "filename_too_large"
    | "mime_too_large"
    | "invalid_file_frame"
    | "wrong_key"
    | "invalid_envelope";

  constructor(code: FileCryptoError["code"], message: string) {
    super(message);
    this.name = "FileCryptoError";
    this.code = code;
  }
}

export function encodeFileFrame(filename: string, mimeType: string, data: Uint8Array): Uint8Array {
  const filenameBytes = utf8Encode(filename);
  if (filenameBytes.length > MAX_FILENAME_BYTES) {
    throw new FileCryptoError("filename_too_large", `Filename UTF-8 exceeds ${MAX_FILENAME_BYTES} bytes limit.`);
  }

  const mimeBytes = utf8Encode(mimeType);
  if (mimeBytes.length > MAX_MIME_BYTES) {
    throw new FileCryptoError("mime_too_large", `MIME UTF-8 exceeds ${MAX_MIME_BYTES} bytes limit.`);
  }

  if (data.length > MAX_FILE_PLAINTEXT_BYTES) {
    throw new FileCryptoError("file_too_large", `File exceeds ${MAX_FILE_PLAINTEXT_BYTES} bytes limit.`);
  }

  const totalLength = FILE_HEADER_BYTES + filenameBytes.length + mimeBytes.length + data.length;
  const result = new Uint8Array(totalLength);
  const view = new DataView(result.buffer, result.byteOffset, result.byteLength);

  // uint32 filename length
  view.setUint32(0, filenameBytes.length, false);
  // uint16 MIME length
  view.setUint16(4, mimeBytes.length, false);

  let offset = FILE_HEADER_BYTES;
  result.set(filenameBytes, offset);
  offset += filenameBytes.length;

  result.set(mimeBytes, offset);
  offset += mimeBytes.length;

  result.set(data, offset);

  return result;
}

export function decodeFileFrame(framedBytes: Uint8Array): FilePayload {
  if (framedBytes.length < FILE_HEADER_BYTES) {
    throw new FileCryptoError("invalid_file_frame", "Framed file data is shorter than the 6-byte header.");
  }

  const view = new DataView(framedBytes.buffer, framedBytes.byteOffset, framedBytes.byteLength);
  const filenameLength = view.getUint32(0, false);
  const mimeLength = view.getUint16(4, false);

  if (filenameLength > MAX_FILENAME_BYTES) {
    throw new FileCryptoError("invalid_file_frame", "Filename length in header exceeds limit.");
  }

  if (mimeLength > MAX_MIME_BYTES) {
    throw new FileCryptoError("invalid_file_frame", "MIME length in header exceeds limit.");
  }

  const headerAndMetaLength = FILE_HEADER_BYTES + filenameLength + mimeLength;
  if (framedBytes.length < headerAndMetaLength) {
    throw new FileCryptoError("invalid_file_frame", "Framed file data is truncated.");
  }

  const filenameBytes = framedBytes.subarray(FILE_HEADER_BYTES, FILE_HEADER_BYTES + filenameLength);
  const mimeBytes = framedBytes.subarray(
    FILE_HEADER_BYTES + filenameLength,
    headerAndMetaLength
  );
  const data = framedBytes.subarray(headerAndMetaLength);

  if (data.length > MAX_FILE_PLAINTEXT_BYTES) {
    throw new FileCryptoError("invalid_file_frame", "Original file data exceeds limit.");
  }

  let filename: string;
  let mimeType: string;
  try {
    filename = utf8Decode(filenameBytes);
  } catch {
    throw new FileCryptoError("invalid_file_frame", "Filename is not valid UTF-8.");
  }

  try {
    mimeType = utf8Decode(mimeBytes);
  } catch {
    throw new FileCryptoError("invalid_file_frame", "MIME is not valid UTF-8.");
  }

  return { filename, mimeType, data };
}

async function deriveFileKey(
  linkSecret: string,
  hkdfSalt: Uint8Array,
  options?: { mask?: FactorMask; ikmOverride?: Uint8Array }
): Promise<CryptoKey> {
  const mask: FactorMask = options?.mask ?? "link";
  const label = mask === "link" ? FILE_HKDF_LABEL_V2 : `securebin/v2/${mask}/file`;
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

export interface FileFactorOptions {
  readonly mask?: FactorMask;
  readonly passwordSalt?: Uint8Array | string | null;
  readonly password?: string;
  readonly unlockCode?: string;
  readonly unlockBytes?: Uint8Array;
}

export type SealedFileFactorArgs = FileFactorOptions & { mask: FactorMask };

export async function sealFile(
  file: FilePayload,
  context: ShareCryptoContext,
  factors?: SealedFileFactorArgs
): Promise<SealedFile> {
  const framedBytes = encodeFileFrame(file.filename, file.mimeType, file.data);
  const nonce = randomBytes(12);
  const ikmOverride =
    factors && factors.mask !== "link"
      ? await buildFactorIkm(context.linkSecret, factors.mask, {
          password: factors.password,
          passwordSalt: factors.passwordSalt,
          unlockCode: factors.unlockCode,
          unlockBytes: factors.unlockBytes,
        })
      : undefined;
  const key = await deriveFileKey(context.linkSecret, context.hkdfSalt, { ikmOverride });

  const hasPassword = factors?.mask.includes("password") ?? false;
  const envelope = newFileEnvelope(nonce, context.hkdfSalt, undefined, {
    factorMask: factors?.mask ?? "link",
    passwordSalt: hasPassword ? factors?.passwordSalt ?? null : null,
  });
  const aad = canonicalAad(context.publicId, envelope);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bytesToArrayBuffer(nonce), additionalData: bytesToArrayBuffer(aad) },
    key,
    bytesToArrayBuffer(framedBytes)
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);
  if (ciphertext.length > MAX_FILE_CIPHERTEXT_SIZE) {
    throw new FileCryptoError("file_too_large", "Encrypted file exceeds maximum ciphertext size.");
  }

  return {
    envelope,
    ciphertext,
    ciphertextSize: ciphertext.length,
  };
}

export async function openFile(
  envelopeValue: unknown,
  ciphertext: Uint8Array,
  publicId: string,
  linkSecret: string,
  factors?: FileFactorOptions
): Promise<FilePayload> {
  const envelope = validateFileEnvelope(envelopeValue);
  validatePublicId(publicId);
  validateLinkSecret(linkSecret);

  if (ciphertext.length < 16 || ciphertext.length > MAX_FILE_CIPHERTEXT_SIZE) {
    throw new FileCryptoError("invalid_file_frame", "File ciphertext size is outside valid bounds.");
  }

  const nonce = base64UrlToBytes(envelope.nonce);
  const hkdfSalt = base64UrlToBytes(envelope.hkdfSalt);
  const ikmOverride =
    factors && factors.mask && factors.mask !== "link"
      ? await buildFactorIkm(linkSecret, factors.mask, {
          password: factors.password,
          passwordSalt: factors.passwordSalt ?? envelope.passwordSalt,
          unlockCode: factors.unlockCode,
          unlockBytes: factors.unlockBytes,
        })
      : undefined;
  const key = await deriveFileKey(linkSecret, hkdfSalt, { ikmOverride });
  const aad = canonicalAad(publicId, envelope);

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytesToArrayBuffer(nonce), additionalData: bytesToArrayBuffer(aad) },
      key,
      bytesToArrayBuffer(ciphertext)
    );
  } catch {
    throw new FileCryptoError("wrong_key", "The link key could not decrypt this file.");
  }

  return decodeFileFrame(new Uint8Array(decryptedBuffer));
}

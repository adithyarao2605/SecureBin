const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

export class EncodingError extends Error {
  readonly code = "invalid_encoding";

  constructor(message = "The value is not valid base64url.") {
    super(message);
    this.name = "EncodingError";
  }
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

/** Copy bytes into a true ArrayBuffer for strict Web Crypto BufferSource types. */
export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function base64UrlToBytes(value: string): Uint8Array {
  if (!BASE64URL_PATTERN.test(value) || value.length % 4 === 1) {
    throw new EncodingError();
  }

  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  let decoded: string;
  try {
    decoded = atob(padded);
  } catch {
    throw new EncodingError();
  }

  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  if (bytesToBase64Url(bytes) !== value) throw new EncodingError("The value is not canonically encoded.");
  return bytes;
}

export function utf8Encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function utf8Decode(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new EncodingError("The decrypted value was not valid UTF-8.");
  }
}

export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 1 || length > 65536) {
    throw new RangeError("Random byte length is outside the supported range.");
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function sha256Base64Url(value: Uint8Array | string): Promise<string> {
  const input = typeof value === "string" ? utf8Encode(value) : value;
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", bytesToArrayBuffer(input))));
}

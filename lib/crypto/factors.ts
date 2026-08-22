import { base64UrlToBytes, bytesToBase64Url, randomBytes } from "./encoding";
import { validateLinkSecret } from "./envelope";

/**
 * Day 4 factor model.
 *
 * Every share still carries the random 32-byte link secret. Optional factors
 * mix additional key material into the HKDF input key material, and the
 * factor mask is bound into the canonical AAD, so a share sealed under one
 * mask cannot be opened under another even if key material ever coincided.
 *
 * IKM = linkSecret(32) || passwordKey(32, when mask includes password)
 *                     || unlockBytes(16, when mask includes unlock)
 *
 * passwordKey = PBKDF2-HMAC-SHA-256(password, passwordSalt, 600000, 32 bytes)
 * unlockBytes = the 128-bit unlock secret decoded from its Crockford code.
 */

export const FACTOR_MASKS = ["link", "link+password", "link+unlock", "link+password+unlock"] as const;
export type FactorMask = (typeof FACTOR_MASKS)[number];

export const PASSWORD_MIN_BYTES = 1;
export const PASSWORD_MAX_BYTES = 1024;
import { PBKDF2_ITERATIONS } from "./envelope";

export { PBKDF2_ITERATIONS };
export const PASSWORD_SALT_BYTES = 16;

const ENCODER = new TextEncoder();

export function factorMaskHasPassword(mask: FactorMask): boolean {
  return mask === "link+password" || mask === "link+password+unlock";
}

export function factorMaskHasUnlock(mask: FactorMask): boolean {
  return mask === "link+unlock" || mask === "link+password+unlock";
}

export class FactorError extends Error {
  readonly code:
    | "password_too_short"
    | "password_too_long"
    | "invalid_unlock_code"
    | "invalid_mask"
    | "missing_factor";

  constructor(code: FactorError["code"], message: string) {
    super(message);
    this.name = "FactorError";
    this.code = code;
  }
}

export function validatePassword(password: string): Uint8Array {
  const bytes = ENCODER.encode(password);
  if (bytes.length < PASSWORD_MIN_BYTES) {
    throw new FactorError("password_too_short", "Enter a password of at least one character.");
  }
  if (bytes.length > PASSWORD_MAX_BYTES) {
    throw new FactorError("password_too_long", `Password must be at most ${PASSWORD_MAX_BYTES} bytes.`);
  }
  return bytes;
}

/**
 * Crockford-style code: 26 symbols of 5 bits each plus one check symbol,
 * encoding exactly 128 bits. Ambiguous glyphs (I L O U) never appear.
 */
export const UNLOCK_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const DECODE_MAP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < UNLOCK_ALPHABET.length; i += 1) map[UNLOCK_ALPHABET[i]] = i;
  map.O = 0;
  map.I = 1;
  map.L = 1;
  return map;
})();

export function generateUnlockCode(): { code: string; bytes: Uint8Array } {
  // 26 base-28 symbols carry ~125 bits, so clear the top nibble to fit.
  const bytes = randomBytes(16);
  bytes[0] &= 0b00001111;
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  const digits: number[] = [];
  for (let i = 0; i < 26; i += 1) {
    digits.push(Number(value % 28n));
    value /= 28n;
  }
  // Check symbol: sum of body digits mod 28 (order-independent, detects typos).
  const checkSum = digits.reduce((sum, d) => sum + d, 0) % UNLOCK_ALPHABET.length;
  const body = digits.reverse().map((d) => UNLOCK_ALPHABET[d]).join("");
  const check = UNLOCK_ALPHABET[checkSum];
  const grouped = body.match(/.{1,5}/g)?.join("-") ?? body;
  return { code: `${grouped}${check}`, bytes };
}

export function unlockCodeToBytes(code: string): Uint8Array {
  const cleaned = code.toUpperCase().replace(/[-\s]/g, "");
  if (cleaned.length !== 27) throw new FactorError("invalid_unlock_code", "Unlock codes are 27 characters.");
  const body = cleaned.slice(0, 26);
  const check = cleaned[26];
  let value = 0n;
  let checkSum = 0;
  for (const symbol of body) {
    const digit = DECODE_MAP[symbol];
    if (digit === undefined) throw new FactorError("invalid_unlock_code", "The unlock code contains an invalid character.");
    value = value * 28n + BigInt(digit);
    checkSum += digit;
  }
  const expectedCheck = UNLOCK_ALPHABET[checkSum % UNLOCK_ALPHABET.length];
  if (expectedCheck !== check) {
    throw new FactorError("invalid_unlock_code", "The unlock code failed its check symbol.");
  }
  const bytes = new Uint8Array(16);
  for (let i = 15; i >= 0; i -= 1) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  if ((bytes[0] & 0b11110000) !== 0) {
    throw new FactorError("invalid_unlock_code", "The unlock code is out of range.");
  }
  return bytes;
}

async function derivePasswordKeyBytes(passwordBytes: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const buffer = (bytes: Uint8Array): ArrayBuffer =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const baseKey = await crypto.subtle.importKey("raw", buffer(passwordBytes), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: buffer(salt), iterations: PBKDF2_ITERATIONS },
    baseKey,
    256
  );
  return new Uint8Array(bits);
}

export interface FactorInputs {
  readonly password?: string;
  readonly passwordSalt?: Uint8Array | string | null;
  readonly unlockCode?: string;
  readonly unlockBytes?: Uint8Array;
}

function saltBytes(salt: Uint8Array | string | null | undefined): Uint8Array | null {
  if (!salt) return null;
  return typeof salt === "string" ? base64UrlToBytes(salt) : salt;
}

/** Build the HKDF input key material for a share's mask. */
export async function buildFactorIkm(linkSecret: string, mask: FactorMask, inputs: FactorInputs): Promise<Uint8Array> {
  if (!FACTOR_MASKS.includes(mask)) throw new FactorError("invalid_mask", "Unsupported factor mask.");
  const link = validateLinkSecret(linkSecret);
  const chunks: Uint8Array[] = [link];

  if (factorMaskHasPassword(mask)) {
    const salt = saltBytes(inputs.passwordSalt);
    if (!inputs.password || !salt || salt.length !== PASSWORD_SALT_BYTES) {
      throw new FactorError("missing_factor", "Password material missing.");
    }
    chunks.push(await derivePasswordKeyBytes(validatePassword(inputs.password), salt));
  } else if (inputs.password) {
    throw new FactorError("invalid_mask", "This share does not take a password.");
  }
  if (factorMaskHasUnlock(mask)) {
    const unlock = inputs.unlockBytes ?? (inputs.unlockCode ? unlockCodeToBytes(inputs.unlockCode) : undefined);
    if (!unlock || unlock.length !== 16) throw new FactorError("missing_factor", "Unlock material missing.");
    chunks.push(unlock);
  } else if (inputs.unlockCode || inputs.unlockBytes) {
    throw new FactorError("invalid_mask", "This share does not take an unlock code.");
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const ikm = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    ikm.set(chunk, offset);
    offset += chunk.length;
  }
  return ikm;
}

export interface PreparedFactors {
  readonly mask: FactorMask;
  /** base64url of the fresh 16-byte PBKDF2 salt; null without password. */
  readonly passwordSalt: string | null;
  /** Crockford code shown once to the sender; never stored server-side. */
  readonly unlockCode: string | null;
  readonly unlockBytes: Uint8Array | null;
}

/** Sender-side preparation: choose mask, mint salt and unlock code. */
export function prepareFactors(options: { password?: string; enableUnlock?: boolean }): PreparedFactors {
  const wantsPassword = typeof options.password === "string" && options.password.length > 0;
  if (wantsPassword) validatePassword(options.password as string);
  const unlock = options.enableUnlock ? generateUnlockCode() : null;

  const mask: FactorMask =
    wantsPassword && unlock ? "link+password+unlock"
    : wantsPassword ? "link+password"
    : unlock ? "link+unlock"
    : "link";

  return {
    mask,
    passwordSalt: wantsPassword ? bytesToBase64Url(randomBytes(PASSWORD_SALT_BYTES)) : null,
    unlockCode: unlock?.code ?? null,
    unlockBytes: unlock?.bytes ?? null,
  };
}

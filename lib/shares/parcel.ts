import { utf8Decode, utf8Encode } from "../crypto/encoding";
import { validateContentEnvelope, validateFileEnvelope, validatePublicId } from "../crypto/envelope";
import { MAX_FILE_CIPHERTEXT_SIZE } from "../crypto/file";

/**
 * .securebin parcel (Day 6 §5): a portable container of exactly the encrypted
 * material a share holds — content envelope (with ciphertext), attachment
 * envelopes plus their ciphertexts, and non-secret policy metadata.
 *
 * Never exported: the link secret, passwords, unlock codes, deletion or
 * discussion capabilities. Import is fully offline; any magic/version/length
 * violation fails closed.
 */

export const PARCEL_MAGIC = new Uint8Array([0x53, 0x42, 0x50, 0x58]); // "SBPX"
export const PARCEL_VERSION = 0x01;

export const MAX_PARCEL_BYTES = 64 * 1024 * 1024; // 10 MiB plaintext cap × 5 + envelopes
const MAX_POLICY_JSON_BYTES = 4 * 1024;
// A maximal content envelope (512 KiB ciphertext base64url + metadata) is
// ~700 KB; allow headroom so every share the composer can seal also imports.
const MAX_CONTENT_ENVELOPE_JSON_BYTES = 1024 * 1024;

export interface ParcelAttachment {
  readonly slot: number;
  readonly envelope: ReturnType<typeof validateFileEnvelope>;
  readonly ciphertext: Uint8Array;
}

export interface Parcel {
  readonly version: typeof PARCEL_VERSION;
  readonly policy: {
    /** Public-ID context required as the envelopes' AES-GCM additional data.
     *  Not a capability: without the link secret it opens nothing. */
    readonly publicId: string;
    readonly availableAt: string | null;
    readonly expiresAt: string | null;
    readonly maxReveals: number | null;
    readonly revealWindowSeconds: number | null;
    readonly createdAt: string | null;
  };
  readonly contentEnvelope: ReturnType<typeof validateContentEnvelope>;
  readonly attachments: ParcelAttachment[];
}

export class ParcelError extends Error {
  constructor(message = "This parcel is not a valid SecureBin parcel.") {
    super(message);
    this.name = "ParcelError";
  }
}

interface ParcelInput {
  readonly publicId: string;
  readonly policy: Omit<Parcel["policy"], "publicId">;
  readonly contentEnvelope: unknown;
  readonly attachments: ReadonlyArray<{
    readonly slot: number;
    readonly envelope: unknown;
    readonly ciphertext: Uint8Array;
  }>;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
}

function validatePolicy(value: unknown): asserts value is Parcel["policy"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ParcelError("Parcel metadata is invalid.");
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(",") !== "availableAt,createdAt,expiresAt,maxReveals,publicId,revealWindowSeconds") throw new ParcelError("Parcel metadata is invalid.");
  try { validatePublicId(record.publicId as string); } catch { throw new ParcelError("Parcel metadata is invalid."); }
  for (const key of ["availableAt", "expiresAt", "createdAt"]) {
    const item = record[key];
    if (item !== null && !validTimestamp(item)) throw new ParcelError("Parcel metadata is invalid.");
  }
  if (record.maxReveals !== null && (typeof record.maxReveals !== "number" || !Number.isInteger(record.maxReveals) || record.maxReveals < 1 || record.maxReveals > 100)) throw new ParcelError("Parcel metadata is invalid.");
  if (record.revealWindowSeconds !== null && (typeof record.revealWindowSeconds !== "number" || !Number.isInteger(record.revealWindowSeconds) || record.revealWindowSeconds < 10 || record.revealWindowSeconds > 86_400)) throw new ParcelError("Parcel metadata is invalid.");
  if (record.availableAt !== null && record.expiresAt !== null && Date.parse(record.availableAt as string) >= Date.parse(record.expiresAt as string)) throw new ParcelError("Parcel metadata is invalid.");
}

function validateFactorConsistency(
  contentEnvelope: ReturnType<typeof validateContentEnvelope>,
  attachments: ReadonlyArray<{ envelope: ReturnType<typeof validateFileEnvelope> }>
): void {
  for (const attachment of attachments) {
    if (attachment.envelope.factorMask !== contentEnvelope.factorMask) {
      throw new ParcelError("Parcel encrypted objects use different factor policies.");
    }
    if (attachment.envelope.passwordSalt !== contentEnvelope.passwordSalt) {
      throw new ParcelError("Parcel encrypted objects use different password salts.");
    }
  }
}

function writeU32(target: Uint8Array, offset: number, value: number): number {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setUint32(offset, value, false);
  return offset + 4;
}

function writeU16(target: Uint8Array, offset: number, value: number): number {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setUint16(offset, value, false);
  return offset + 2;
}

function lengthPrefixed(bytes: Uint8Array): Uint8Array[] {
  const header = new Uint8Array(4);
  writeU32(header, 0, bytes.length);
  return [header, bytes];
}

/** Encode a parcel from validated share material. Throws ParcelError on overflow. */
export function encodeParcel(input: ParcelInput): Uint8Array {
  try { validatePublicId(input.publicId); } catch { throw new ParcelError("Invalid public id."); }
  const policy = { ...input.policy, publicId: input.publicId };
  validatePolicy(policy);
  const policyBytes = utf8Encode(JSON.stringify(policy));
  if (policyBytes.length > MAX_POLICY_JSON_BYTES) throw new ParcelError("Parcel policy metadata too large.");

  const contentEnvelope = validateContentEnvelope(input.contentEnvelope);
  const contentEnvelopeBytes = utf8Encode(JSON.stringify(contentEnvelope));

  if (input.attachments.length > 5) throw new ParcelError("Too many attachments.");
  const slots = new Set<number>();
  const attachments = input.attachments.map((attachment, index) => {
    const envelope = validateFileEnvelope(attachment.envelope);
    if (!Number.isInteger(attachment.slot) || attachment.slot < 0 || attachment.slot > 4) {
      throw new ParcelError("Attachment slot out of range.");
    }
    if (slots.has(attachment.slot)) throw new ParcelError("Duplicate attachment slot.");
    slots.add(attachment.slot);
    if (attachment.ciphertext.length < 16 || attachment.ciphertext.length > MAX_FILE_CIPHERTEXT_SIZE) {
      throw new ParcelError(`Attachment ${index} ciphertext size out of bounds.`);
    }
    return {
      slot: attachment.slot,
      envelope,
      envelopeBytes: utf8Encode(JSON.stringify(envelope)),
      ciphertext: attachment.ciphertext,
    };
  });
  validateFactorConsistency(contentEnvelope, attachments);

  const chunks: Uint8Array[] = [];
  chunks.push(PARCEL_MAGIC);
  const versionByte = new Uint8Array([PARCEL_VERSION]);
  chunks.push(versionByte);
  chunks.push(...lengthPrefixed(policyBytes));
  chunks.push(...lengthPrefixed(contentEnvelopeBytes));
  const countHeader = new Uint8Array(2);
  writeU16(countHeader, 0, attachments.length);
  chunks.push(countHeader);
  for (const attachment of attachments) {
    const slotByte = new Uint8Array([attachment.slot]);
    chunks.push(slotByte);
    chunks.push(...lengthPrefixed(attachment.envelopeBytes));
    chunks.push(...lengthPrefixed(attachment.ciphertext));
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  if (total > MAX_PARCEL_BYTES) throw new ParcelError("Parcel exceeds the size limit.");
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, false);
}

/**
 * Strict offline parse: exact magic, supported version, every declared length
 * must consume exactly; trailing bytes are rejected.
 */
export function decodeParcel(bytes: Uint8Array): Parcel {
  try {
    if (bytes.length > MAX_PARCEL_BYTES) throw new ParcelError();
    if (
      bytes.length < 4 + 1 + 4 ||
      bytes[0] !== PARCEL_MAGIC[0] ||
      bytes[1] !== PARCEL_MAGIC[1] ||
      bytes[2] !== PARCEL_MAGIC[2] ||
      bytes[3] !== PARCEL_MAGIC[3]
    ) {
      throw new ParcelError("Not a SecureBin parcel.");
    }
    const version = bytes[4];
    if (version !== PARCEL_VERSION) {
      throw new ParcelError(`Unsupported parcel version: ${version}.`);
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let cursor = 5;

    const policyLength = readU32(view, cursor);
    cursor += 4;
    if (policyLength > MAX_POLICY_JSON_BYTES || cursor + policyLength > bytes.length) throw new ParcelError();
    const policy = JSON.parse(utf8Decode(bytes.subarray(cursor, cursor + policyLength))) as Parcel["policy"];
    cursor += policyLength;
    validatePolicy(policy);

    const envelopeLength = readU32(view, cursor);
    cursor += 4;
    if (envelopeLength > MAX_CONTENT_ENVELOPE_JSON_BYTES || cursor + envelopeLength > bytes.length) throw new ParcelError();
    const contentEnvelope = validateContentEnvelope(JSON.parse(utf8Decode(bytes.subarray(cursor, cursor + envelopeLength))));
    cursor += envelopeLength;

    const attachmentCount = readU16(view, cursor);
    cursor += 2;
    if (attachmentCount > 5) throw new ParcelError();

    const attachments: ParcelAttachment[] = [];
    for (let index = 0; index < attachmentCount; index += 1) {
      if (cursor + 1 > bytes.length) throw new ParcelError();
      const slot = bytes[cursor];
      if (slot > 4) throw new ParcelError();
      cursor += 1;
      const attachmentEnvelopeLength = readU32(view, cursor);
      cursor += 4;
      if (cursor + attachmentEnvelopeLength > bytes.length) throw new ParcelError();
      const envelope = validateFileEnvelope(JSON.parse(utf8Decode(bytes.subarray(cursor, cursor + attachmentEnvelopeLength))));
      cursor += attachmentEnvelopeLength;
      const ciphertextLength = readU32(view, cursor);
      cursor += 4;
      if (ciphertextLength < 16 || ciphertextLength > MAX_FILE_CIPHERTEXT_SIZE || ciphertextLength > bytes.length - cursor) throw new ParcelError();
      const ciphertext = bytes.slice(cursor, cursor + ciphertextLength);
      cursor += ciphertextLength;
      attachments.push({ slot, envelope, ciphertext });
    }

    if (new Set(attachments.map((attachment) => attachment.slot)).size !== attachments.length) throw new ParcelError();
    validateFactorConsistency(contentEnvelope, attachments);

    if (cursor !== bytes.length) throw new ParcelError();

    return { version: PARCEL_VERSION, policy, contentEnvelope, attachments };
  } catch (error) {
    if (error instanceof ParcelError) throw error;
    throw new ParcelError();
  }
}

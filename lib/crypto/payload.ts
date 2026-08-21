import { utf8Decode, utf8Encode } from "./encoding";
import { MAX_CONTENT_BYTES } from "./envelope";

export const CONTENT_PAYLOAD_MAGIC = new Uint8Array([0x53, 0x42, 0x43, 0x54]); // "SBCT"
export const CONTENT_PAYLOAD_VERSION = 0x01;

export const CONTENT_MODE_NOTE = 0x00;
export const CONTENT_MODE_MARKDOWN = 0x01;
export const CONTENT_MODE_CODE = 0x02;

export const CODE_LANGUAGES = [
  "plaintext",
  "javascript",
  "typescript",
  "json",
  "python",
  "bash",
  "sql",
  "css",
  "html",
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const LANGUAGE_TO_ID: Record<CodeLanguage, number> = {
  plaintext: 0,
  javascript: 1,
  typescript: 2,
  json: 3,
  python: 4,
  bash: 5,
  sql: 6,
  css: 7,
  html: 8,
};

export const ID_TO_LANGUAGE: Record<number, CodeLanguage> = {
  0: "plaintext",
  1: "javascript",
  2: "typescript",
  3: "json",
  4: "python",
  5: "bash",
  6: "sql",
  7: "css",
  8: "html",
};

export type ContentPayload =
  | { readonly mode: "note"; readonly text: string }
  | { readonly mode: "markdown"; readonly text: string }
  | { readonly mode: "code"; readonly text: string; readonly language: CodeLanguage };

export class PayloadCodecError extends Error {
  readonly code = "invalid_payload_frame";

  constructor(message = "The decrypted content payload format is invalid.") {
    super(message);
    this.name = "PayloadCodecError";
  }
}

export function encodeContentPayload(payload: ContentPayload): Uint8Array {
  const textBytes = utf8Encode(payload.text);
  if (textBytes.length > MAX_CONTENT_BYTES) {
    throw new PayloadCodecError("Text exceeds the 512 KiB limit.");
  }

  let modeByte: number;
  let langId: number;

  switch (payload.mode) {
    case "note":
      modeByte = CONTENT_MODE_NOTE;
      langId = 0;
      break;
    case "markdown":
      modeByte = CONTENT_MODE_MARKDOWN;
      langId = 0;
      break;
    case "code":
      modeByte = CONTENT_MODE_CODE;
      if (!(payload.language in LANGUAGE_TO_ID)) {
        throw new PayloadCodecError(`Unsupported code language: ${payload.language}`);
      }
      langId = LANGUAGE_TO_ID[payload.language];
      break;
    default:
      throw new PayloadCodecError("Unsupported content mode.");
  }

  // 4 (magic) + 1 (version) + 1 (mode) + 1 (langId) + 4 (text length) = 11 header bytes
  const headerLength = 11;
  const totalLength = headerLength + textBytes.length;
  const result = new Uint8Array(totalLength);
  const view = new DataView(result.buffer, result.byteOffset, result.byteLength);

  // Magic
  result.set(CONTENT_PAYLOAD_MAGIC, 0);
  // Version
  result[4] = CONTENT_PAYLOAD_VERSION;
  // Mode
  result[5] = modeByte;
  // Language ID
  result[6] = langId;
  // Text length
  view.setUint32(7, textBytes.length, false); // big-endian
  // Text bytes
  result.set(textBytes, headerLength);

  return result;
}

export function decodeContentPayload(bytes: Uint8Array): ContentPayload {
  if (bytes.length < 11) {
    throw new PayloadCodecError("Payload frame is shorter than the 11-byte header.");
  }

  // Check magic: "SBCT"
  if (
    bytes[0] !== CONTENT_PAYLOAD_MAGIC[0] ||
    bytes[1] !== CONTENT_PAYLOAD_MAGIC[1] ||
    bytes[2] !== CONTENT_PAYLOAD_MAGIC[2] ||
    bytes[3] !== CONTENT_PAYLOAD_MAGIC[3]
  ) {
    throw new PayloadCodecError("Invalid payload magic marker.");
  }

  const version = bytes[4];
  if (version !== CONTENT_PAYLOAD_VERSION) {
    throw new PayloadCodecError(`Unsupported payload version: ${version}`);
  }

  const modeByte = bytes[5];
  const langId = bytes[6];

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const textLength = view.getUint32(7, false); // big-endian

  if (textLength > MAX_CONTENT_BYTES) {
    throw new PayloadCodecError("Declared text length exceeds 512 KiB limit.");
  }

  const expectedTotal = 11 + textLength;
  if (bytes.length !== expectedTotal) {
    throw new PayloadCodecError(
      `Payload frame length mismatch: expected ${expectedTotal} bytes, got ${bytes.length} bytes.`
    );
  }

  const textBytes = bytes.subarray(11, 11 + textLength);
  let text: string;
  try {
    text = utf8Decode(textBytes);
  } catch {
    throw new PayloadCodecError("Payload text is not valid UTF-8.");
  }

  if (modeByte === CONTENT_MODE_NOTE) {
    if (langId !== 0) {
      throw new PayloadCodecError("Note mode must have language ID 0.");
    }
    return { mode: "note", text };
  }

  if (modeByte === CONTENT_MODE_MARKDOWN) {
    if (langId !== 0) {
      throw new PayloadCodecError("Markdown mode must have language ID 0.");
    }
    return { mode: "markdown", text };
  }

  if (modeByte === CONTENT_MODE_CODE) {
    if (!(langId in ID_TO_LANGUAGE)) {
      throw new PayloadCodecError(`Unknown code language ID: ${langId}`);
    }
    return { mode: "code", text, language: ID_TO_LANGUAGE[langId] };
  }

  throw new PayloadCodecError(`Unsupported mode byte: ${modeByte}`);
}

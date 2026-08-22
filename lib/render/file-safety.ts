import { utf8Decode } from "../crypto/encoding";

export type SafeImageMime = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export type FilePreviewKind =
  | { readonly type: "image"; readonly mimeType: SafeImageMime }
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "download_only" };

export function sanitizeFilename(rawFilename: string): string {
  // Strip null bytes, control chars, replace path separators with underscores
  let sanitized = rawFilename
    .replace(/[\0\x00-\x1f\x7f]/g, "")
    .replace(/[/\\]+/g, "_")
    .trim();

  // Strip leading dots from hidden files
  sanitized = sanitized.replace(/^\.+([a-zA-Z0-9])/, "$1");

  if (!sanitized || sanitized === "." || sanitized === "..") {
    return "download.bin";
  }

  return sanitized;
}

export function detectSafeImageMime(bytes: Uint8Array): SafeImageMime | null {
  if (bytes.length < 8) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF: 47 49 46 38 (37|39) 61 ("GIF87a" or "GIF89a")
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  // WebP: RIFF (bytes 0..3: 52 49 46 46) and WEBP (bytes 8..11: 57 45 42 50)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function isSafePlainText(bytes: Uint8Array): string | null {
  // Reject files larger than 1 MB from inline text preview (they remain downloadable)
  if (bytes.length > 1024 * 1024) return null;

  // Reject executable or structured container headers
  if (bytes.length >= 4) {
    // PDF: %PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return null;
    }
    // ELF: \x7fELF
    if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
      return null;
    }
    // Windows PE: MZ
    if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
      return null;
    }
    // Mach-O
    if (
      (bytes[0] === 0xca && bytes[1] === 0xfe && bytes[2] === 0xba && bytes[3] === 0xbe) ||
      (bytes[0] === 0xfe && bytes[1] === 0xed && bytes[2] === 0xfa && bytes[3] === 0xce) ||
      (bytes[0] === 0xfe && bytes[1] === 0xed && bytes[2] === 0xfa && bytes[3] === 0xcf) ||
      (bytes[0] === 0xcf && bytes[1] === 0xfa && bytes[2] === 0xed && bytes[3] === 0xfe)
    ) {
      return null;
    }
  }

  let text: string;
  try {
    text = utf8Decode(bytes);
  } catch {
    return null;
  }

  const trimmedLower = text.trimStart().toLowerCase();
  // Markup ambiguity: any leading "<" (tags, declarations, comments) goes to
  // download-only instead of inline text preview.
  if (trimmedLower.startsWith("<")) {
    return null;
  }

  // Check for binary/control characters (allow newline, carriage return, tab)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      return null;
    }
  }

  return text;
}

export function inspectFileForPreview(bytes: Uint8Array): FilePreviewKind {
  const imageMime = detectSafeImageMime(bytes);
  if (imageMime) {
    return { type: "image", mimeType: imageMime };
  }

  const plainText = isSafePlainText(bytes);
  if (plainText !== null) {
    return { type: "text", text: plainText };
  }

  return { type: "download_only" };
}

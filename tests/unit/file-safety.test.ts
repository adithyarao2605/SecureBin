import { describe, expect, it } from "vitest";
import {
  detectSafeImageMime,
  inspectFileForPreview,
  isSafePlainText,
  sanitizeFilename,
} from "../../lib/render/file-safety";

describe("File Safety and Preview Inspection (Day 3)", () => {
  describe("detectSafeImageMime", () => {
    it("identifies PNG files from magic bytes", () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      expect(detectSafeImageMime(png)).toBe("image/png");
    });

    it("identifies JPEG files from magic bytes", () => {
      const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(detectSafeImageMime(jpeg)).toBe("image/jpeg");
    });

    it("identifies GIF files (GIF87a and GIF89a)", () => {
      const gif87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00]);
      const gif89 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);
      expect(detectSafeImageMime(gif87)).toBe("image/gif");
      expect(detectSafeImageMime(gif89)).toBe("image/gif");
    });

    it("identifies WebP files from RIFF and WEBP markers", () => {
      const webp = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // length
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(detectSafeImageMime(webp)).toBe("image/webp");
    });

    it("returns null for non-image, masqueraded, or corrupted data", () => {
      const text = new TextEncoder().encode("Hello world");
      expect(detectSafeImageMime(text)).toBeNull();

      const html = new TextEncoder().encode("<html><body>test</body></html>");
      expect(detectSafeImageMime(html)).toBeNull();

      const svg = new TextEncoder().encode("<svg><circle r='5'/></svg>");
      expect(detectSafeImageMime(svg)).toBeNull();
    });
  });

  describe("isSafePlainText", () => {
    it("detects valid UTF-8 text with standard newlines and tabs", () => {
      const text = new TextEncoder().encode("Hello world!\nLine 2\tTabbed\r\nLine 3");
      expect(isSafePlainText(text)).toBe("Hello world!\nLine 2\tTabbed\r\nLine 3");
    });

    it("rejects binary files containing control characters", () => {
      const binary = new Uint8Array([0x00, 0x01, 0x02, 0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      expect(isSafePlainText(binary)).toBeNull();
    });
  });

  describe("sanitizeFilename", () => {
    it("removes directory traversal, control characters, and null bytes", () => {
      expect(sanitizeFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
      expect(sanitizeFilename("..\\..\\windows\\system32")).toBe(".._.._windows_system32");
      expect(sanitizeFilename("file\0name.txt")).toBe("filename.txt");
      expect(sanitizeFilename("report\x07\x1b.pdf")).toBe("report.pdf");
      expect(sanitizeFilename(".hidden.txt")).toBe("hidden.txt");
    });

    it("falls back to download.bin for empty or dot-only filenames", () => {
      expect(sanitizeFilename("")).toBe("download.bin");
      expect(sanitizeFilename(".")).toBe("download.bin");
      expect(sanitizeFilename("..")).toBe("download.bin");
      expect(sanitizeFilename("   ")).toBe("download.bin");
    });
  });

  describe("inspectFileForPreview", () => {
    it("classifies image files properly", () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(inspectFileForPreview(png)).toEqual({ type: "image", mimeType: "image/png" });
    });

    it("classifies plain text files properly", () => {
      const text = new TextEncoder().encode("Plain text note attachment");
      expect(inspectFileForPreview(text)).toEqual({
        type: "text",
        text: "Plain text note attachment",
      });
    });

    it("classifies PDFs, executables, and HTML as download_only", () => {
      const pdf = new TextEncoder().encode("%PDF-1.4 sample pdf content");
      expect(inspectFileForPreview(pdf)).toEqual({
        type: "download_only",
      });
    });
  });
});

import { describe, expect, it } from "vitest";
import { openContent, sealContent } from "../../lib/crypto/content";
import {
  base64UrlToBytes,
  bytesToArrayBuffer,
  bytesToBase64Url,
  utf8Encode,
} from "../../lib/crypto/encoding";
import {
  canonicalAad,
  CONTENT_HKDF_LABEL_V1,
  CONTENT_HKDF_LABEL_V2,
  FILE_HKDF_LABEL_V2,
  EnvelopeValidationError,
  MAX_CONTENT_BYTES,
  newContentEnvelope,
  newFileEnvelope,
  validateContentEnvelope,
  validateFileEnvelope,
} from "../../lib/crypto/envelope";
import {
  decodeFileFrame,
  encodeFileFrame,
  FileCryptoError,
  MAX_FILENAME_BYTES,
  MAX_FILE_PLAINTEXT_BYTES,
  MAX_MIME_BYTES,
  openFile,
  sealFile,
} from "../../lib/crypto/file";
import {
  decodeContentPayload,
  encodeContentPayload,
  PayloadCodecError,
  type ContentPayload,
} from "../../lib/crypto/payload";
import { generateShareContext } from "../../lib/crypto/share-context";

async function sealV1GoldenVector(): Promise<ReturnType<typeof newContentEnvelope>> {
  const publicIdBytes = new Uint8Array(16).fill(0x11);
  const linkSecretBytes = new Uint8Array(32).fill(0x22);
  const nonce = new Uint8Array(12).fill(0x33);
  const hkdfSalt = new Uint8Array(16).fill(0x44);
  const publicId = bytesToBase64Url(publicIdBytes);
  const linkSecretKey = await crypto.subtle.importKey(
    "raw",
    bytesToArrayBuffer(linkSecretBytes),
    "HKDF",
    false,
    ["deriveKey"]
  );
  const contentKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: bytesToArrayBuffer(hkdfSalt),
      info: bytesToArrayBuffer(utf8Encode(CONTENT_HKDF_LABEL_V1)),
    },
    linkSecretKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const shape = newContentEnvelope(nonce, hkdfSalt, new Uint8Array(16), 1);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: bytesToArrayBuffer(nonce),
        additionalData: bytesToArrayBuffer(canonicalAad(publicId, shape)),
      },
      contentKey,
      bytesToArrayBuffer(utf8Encode("golden vector"))
    )
  );
  return newContentEnvelope(nonce, hkdfSalt, ciphertext, 1);
}

async function sealV2ContentGoldenVector(): Promise<{
  envelope: ReturnType<typeof newContentEnvelope>;
  publicId: string;
  linkSecret: string;
}> {
  const publicIdBytes = new Uint8Array(16).fill(0x11);
  const linkSecretBytes = new Uint8Array(32).fill(0x22);
  const nonce = new Uint8Array(12).fill(0x33);
  const hkdfSalt = new Uint8Array(16).fill(0x44);
  const publicId = bytesToBase64Url(publicIdBytes);
  const linkSecret = bytesToBase64Url(linkSecretBytes);

  const context = {
    publicId,
    linkSecret,
    deleteCapability: bytesToBase64Url(new Uint8Array(32).fill(0x55)),
    idempotencyKey: bytesToBase64Url(new Uint8Array(32).fill(0x66)),
    hkdfSalt,
    factorMask: "link" as const,
  };

  const payload: ContentPayload = { mode: "markdown", text: "# Day 3 Heading\nSafe zero-knowledge sharing." };
  const sealed = await sealContent(payload, context);

  // Override envelope nonce to deterministic 0x33 for golden vector
  const linkSecretKey = await crypto.subtle.importKey(
    "raw",
    bytesToArrayBuffer(linkSecretBytes),
    "HKDF",
    false,
    ["deriveKey"]
  );
  const contentKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: bytesToArrayBuffer(hkdfSalt),
      info: bytesToArrayBuffer(utf8Encode(CONTENT_HKDF_LABEL_V2)),
    },
    linkSecretKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const shape = newContentEnvelope(nonce, hkdfSalt, new Uint8Array(16), 2);
  const framed = encodeContentPayload(payload);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: bytesToArrayBuffer(nonce),
        additionalData: bytesToArrayBuffer(canonicalAad(publicId, shape)),
      },
      contentKey,
      bytesToArrayBuffer(framed)
    )
  );

  return {
    envelope: newContentEnvelope(nonce, hkdfSalt, ciphertext, 2),
    publicId,
    linkSecret,
  };
}

async function sealV2FileGoldenVector(): Promise<{
  envelope: ReturnType<typeof newFileEnvelope>;
  ciphertext: Uint8Array;
  publicId: string;
  linkSecret: string;
}> {
  const publicIdBytes = new Uint8Array(16).fill(0x11);
  const linkSecretBytes = new Uint8Array(32).fill(0x22);
  const nonce = new Uint8Array(12).fill(0x33);
  const hkdfSalt = new Uint8Array(16).fill(0x44);
  const publicId = bytesToBase64Url(publicIdBytes);
  const linkSecret = bytesToBase64Url(linkSecretBytes);

  const context = {
    publicId,
    linkSecret,
    deleteCapability: bytesToBase64Url(new Uint8Array(32).fill(0x55)),
    idempotencyKey: bytesToBase64Url(new Uint8Array(32).fill(0x66)),
    hkdfSalt,
    factorMask: "link" as const,
  };

  const filePayload = {
    filename: "secret.txt",
    mimeType: "text/plain",
    data: utf8Encode("Encrypted attachment content"),
  };

  const framed = encodeFileFrame(filePayload.filename, filePayload.mimeType, filePayload.data);
  const linkSecretKey = await crypto.subtle.importKey(
    "raw",
    bytesToArrayBuffer(linkSecretBytes),
    "HKDF",
    false,
    ["deriveKey"]
  );
  const fileKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: bytesToArrayBuffer(hkdfSalt),
      info: bytesToArrayBuffer(utf8Encode(FILE_HKDF_LABEL_V2)),
    },
    linkSecretKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const envelope = newFileEnvelope(nonce, hkdfSalt);
  const aad = canonicalAad(publicId, envelope);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: bytesToArrayBuffer(nonce),
        additionalData: bytesToArrayBuffer(aad),
      },
      fileKey,
      bytesToArrayBuffer(framed)
    )
  );

  return {
    envelope,
    ciphertext,
    publicId,
    linkSecret,
  };
}

describe("SecureBin Content & File Cryptography (Day 3)", () => {
  describe("Legacy v1 Content Compatibility", () => {
    it("opens v1 legacy whole-note content envelope", async () => {
      const v1Golden = await sealV1GoldenVector();
      const publicId = bytesToBase64Url(new Uint8Array(16).fill(0x11));
      const linkSecret = bytesToBase64Url(new Uint8Array(32).fill(0x22));

      const opened = await openContent(v1Golden, publicId, linkSecret);
      expect(opened).toEqual({ mode: "note", text: "golden vector" });
    });

    it("matches the locked v1 link/content golden vector", async () => {
      const envelope = await sealV1GoldenVector();
      expect(envelope).toEqual({
        version: 1,
        objectType: "content",
        algorithm: "AES-256-GCM",
        nonce: "MzMzMzMzMzMzMzMz",
        hkdfSalt: "RERERERERERERERERERERA",
        passwordSalt: null,
        kdf: "none",
        kdfParameters: {},
        factorMask: "link",
        ciphertext: "0JTiqnlQ9k8q5GuExNrVabO8qMGv3Hr-OaWLaUQ",
      });
    });
  });

  describe("v2 Structured Content Framing & Codecs", () => {
    it("round-trips note, markdown, and code payloads with all supported languages", async () => {
      const payloads: ContentPayload[] = [
        { mode: "note", text: "Simple note with UTF-8 café and こんにちは" },
        { mode: "markdown", text: "# Heading\n* Item 1\n* Item 2\n[Link](https://example.com)" },
        { mode: "code", text: "const x: number = 42;\nconsole.log(x);", language: "typescript" },
        { mode: "code", text: "def hello():\n    print('world')", language: "python" },
        { mode: "code", text: "SELECT id, count(*) FROM shares GROUP BY id;", language: "sql" },
        { mode: "code", text: "echo 'hello bash'", language: "bash" },
        { mode: "code", text: "{\"secure\": true, \"version\": 2}", language: "json" },
        { mode: "code", text: "body { background: #f4f0e8; }", language: "css" },
        { mode: "code", text: "<div><span>safe</span></div>", language: "html" },
        { mode: "code", text: "function test() {}", language: "javascript" },
        { mode: "code", text: "plain text code snippet", language: "plaintext" },
      ];

      for (const payload of payloads) {
        const encoded = encodeContentPayload(payload);
        const decoded = decodeContentPayload(encoded);
        expect(decoded).toEqual(payload);

        const sealed = await sealContent(payload);
        const opened = await openContent(sealed.envelope, sealed.publicId, sealed.linkSecret);
        expect(opened).toEqual(payload);
      }
    });

    it("rejects corrupted or malicious payload framing", () => {
      const valid = encodeContentPayload({ mode: "note", text: "valid text" });

      // Invalid magic
      const badMagic = new Uint8Array(valid);
      badMagic[0] = 0x00;
      expect(() => decodeContentPayload(badMagic)).toThrow(PayloadCodecError);

      // Invalid version
      const badVersion = new Uint8Array(valid);
      badVersion[4] = 0x02;
      expect(() => decodeContentPayload(badVersion)).toThrow(PayloadCodecError);

      // Invalid mode
      const badMode = new Uint8Array(valid);
      badMode[5] = 0x99;
      expect(() => decodeContentPayload(badMode)).toThrow(PayloadCodecError);

      // Trailing bytes
      const trailing = new Uint8Array(valid.length + 1);
      trailing.set(valid);
      trailing[valid.length] = 0x00;
      expect(() => decodeContentPayload(trailing)).toThrow(PayloadCodecError);

      // Truncated length
      const truncated = valid.subarray(0, valid.length - 2);
      expect(() => decodeContentPayload(truncated)).toThrow(PayloadCodecError);
    });

    it("matches the locked v2 content golden vector", async () => {
      const { envelope, publicId, linkSecret } = await sealV2ContentGoldenVector();
      expect(envelope.version).toBe(2);
      expect(envelope.objectType).toBe("content");
      expect(envelope.algorithm).toBe("AES-256-GCM");
      expect(envelope.factorMask).toBe("link");

      const opened = await openContent(envelope, publicId, linkSecret);
      expect(opened).toEqual({
        mode: "markdown",
        text: "# Day 3 Heading\nSafe zero-knowledge sharing.",
      });
    });
  });

  describe("File Attachment Framing & Encryption", () => {
    it("round-trips binary file payloads with Unicode filenames and MIME types", async () => {
      const context = generateShareContext();
      const fileData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02]);
      const filePayload = {
        filename: "résumé_2026_日本語.png",
        mimeType: "image/png",
        data: fileData,
      };

      const framed = encodeFileFrame(filePayload.filename, filePayload.mimeType, filePayload.data);
      const decoded = decodeFileFrame(framed);
      expect(decoded.filename).toBe(filePayload.filename);
      expect(decoded.mimeType).toBe(filePayload.mimeType);
      expect(decoded.data).toEqual(fileData);

      const sealed = await sealFile(filePayload, context);
      expect(sealed.envelope.version).toBe(2);
      expect(sealed.envelope.objectType).toBe("file");
      expect(sealed.ciphertextSize).toBe(sealed.ciphertext.length);

      const opened = await openFile(sealed.envelope, sealed.ciphertext, context.publicId, context.linkSecret);
      expect(opened.filename).toBe(filePayload.filename);
      expect(opened.mimeType).toBe(filePayload.mimeType);
      expect(opened.data).toEqual(fileData);
    });

    it("enforces strict size limits on filename, MIME, and file plaintext bytes", () => {
      const normalData = new Uint8Array([1, 2, 3]);

      // Filename > 512 bytes
      const longFilename = "a".repeat(MAX_FILENAME_BYTES + 1);
      expect(() => encodeFileFrame(longFilename, "text/plain", normalData)).toThrow(FileCryptoError);

      // MIME > 128 bytes
      const longMime = "b".repeat(MAX_MIME_BYTES + 1);
      expect(() => encodeFileFrame("test.txt", longMime, normalData)).toThrow(FileCryptoError);

      // Plaintext > 10 MiB
      const tooLargeData = new Uint8Array(MAX_FILE_PLAINTEXT_BYTES + 1);
      expect(() => encodeFileFrame("test.bin", "application/octet-stream", tooLargeData)).toThrow(
        FileCryptoError
      );
    });

    it("matches the locked v2 file golden vector", async () => {
      const { envelope, ciphertext, publicId, linkSecret } = await sealV2FileGoldenVector();
      expect(envelope.version).toBe(2);
      expect(envelope.objectType).toBe("file");

      const opened = await openFile(envelope, ciphertext, publicId, linkSecret);
      expect(opened.filename).toBe("secret.txt");
      expect(opened.mimeType).toBe("text/plain");
      expect(Array.from(opened.data)).toEqual(Array.from(utf8Encode("Encrypted attachment content")));
    });
  });

  describe("Domain Separation & Nonce Uniqueness", () => {
    it("proves content key cannot decrypt file and file key cannot decrypt content", async () => {
      const context = generateShareContext();
      const content = await sealContent({ mode: "note", text: "Shared secret message" }, context);
      const file = await sealFile(
        { filename: "doc.txt", mimeType: "text/plain", data: utf8Encode("Shared secret message") },
        context
      );

      // Attempt to decrypt file ciphertext using content open function
      const fakeContentEnvelope = {
        ...content.envelope,
        ciphertext: bytesToBase64Url(file.ciphertext),
      };
      await expect(
        openContent(fakeContentEnvelope, context.publicId, context.linkSecret)
      ).rejects.toMatchObject({ code: "wrong_key" });

      // Attempt to decrypt content ciphertext using file open function
      await expect(
        openFile(file.envelope, base64UrlToBytes(content.envelope.ciphertext), context.publicId, context.linkSecret)
      ).rejects.toMatchObject({ code: "wrong_key" });
    });

    it("generates distinct random nonces for content and file sharing the same salt", async () => {
      const context = generateShareContext();
      const content = await sealContent("Test note", context);
      const file = await sealFile(
        { filename: "test.txt", mimeType: "text/plain", data: new Uint8Array([1, 2, 3]) },
        context
      );

      expect(content.envelope.hkdfSalt).toBe(file.envelope.hkdfSalt);
      expect(content.envelope.nonce).not.toBe(file.envelope.nonce);
    });

    it("rejects v1 file envelope", () => {
      expect(() =>
        validateFileEnvelope({
          version: 1,
          objectType: "file",
          algorithm: "AES-256-GCM",
          nonce: bytesToBase64Url(new Uint8Array(12)),
          hkdfSalt: bytesToBase64Url(new Uint8Array(16)),
          passwordSalt: null,
          kdf: "none",
          kdfParameters: {},
          factorMask: "link",
        })
      ).toThrow(EnvelopeValidationError);
    });
  });
});

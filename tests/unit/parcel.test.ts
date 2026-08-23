import { describe, expect, it } from "vitest";

import { openContent, sealContent } from "../../lib/crypto/content";
import { bytesToBase64Url, randomBytes } from "../../lib/crypto/encoding";
import { sealFile, openFile } from "../../lib/crypto/file";
import { generateShareContext } from "../../lib/crypto/share-context";
import { decodeParcel, encodeParcel, ParcelError } from "../../lib/shares/parcel";

const PUBLIC_ID = "AQEBAQEBAQEBAQEBAQEBAQ";

const contentEnvelope = {
  version: 2,
  objectType: "content",
  algorithm: "AES-256-GCM",
  nonce: "AAAAAAAAAAAAAAAA",
  hkdfSalt: "AAAAAAAAAAAAAAAAAAAAAA",
  passwordSalt: null,
  kdf: "none",
  kdfParameters: {},
  factorMask: "link",
  ciphertext: "AAAAAAAAAAAAAAAAAAAAAA",
};

const fileEnvelope = {
  version: 2,
  objectType: "file",
  algorithm: "AES-256-GCM",
  nonce: "BBBBBBBBBBBBBBBB",
  hkdfSalt: "BBBBBBBBBBBBBBBBBBBBBA",
  passwordSalt: null,
  kdf: "none",
  kdfParameters: {},
  factorMask: "link",
};

const policy = {
  availableAt: null,
  expiresAt: "2026-09-01T00:00:00.000Z",
  maxReveals: 3,
  revealWindowSeconds: null,
  createdAt: "2026-08-24T00:00:00.000Z",
};

describe("securebin parcel codec", () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);

  it("round-trips policy, content envelope, and attachments", () => {
    const encoded = encodeParcel({
      publicId: PUBLIC_ID,
      policy,
      contentEnvelope,
      attachments: [{ slot: 1, envelope: fileEnvelope, ciphertext: bytes }],
    });
    const decoded = decodeParcel(encoded);

    expect(decoded.policy).toEqual({ ...policy, publicId: PUBLIC_ID });
    expect(decoded.contentEnvelope.ciphertext).toBe(contentEnvelope.ciphertext);
    expect(decoded.attachments.length).toBe(1);
    expect(decoded.attachments[0].slot).toBe(1);
    expect([...decoded.attachments[0].ciphertext]).toEqual([...bytes]);
  });

  it("fails closed on tampered bytes and trailing garbage", () => {
    const encoded = encodeParcel({ publicId: PUBLIC_ID, policy, contentEnvelope, attachments: [] });

    const flipped = new Uint8Array(encoded);
    flipped[flipped.length - 1] ^= 0xff;
    // A flipped byte inside the final length-prefixed field breaks either the
    // declared lengths or strict envelope validation.
    expect(() => decodeParcel(flipped)).toThrow(ParcelError);

    const trailing = new Uint8Array(encoded.length + 1);
    trailing.set(encoded);
    expect(() => decodeParcel(trailing)).toThrow(ParcelError);

    const truncated = encoded.subarray(0, encoded.length - 2);
    expect(() => decodeParcel(truncated)).toThrow(ParcelError);
  });

  it("rejects unknown versions and foreign magic", () => {
    const encoded = encodeParcel({ publicId: PUBLIC_ID, policy, contentEnvelope, attachments: [] });

    const future = new Uint8Array(encoded);
    future[4] = 0x02;
    expect(() => decodeParcel(future)).toThrow(/Unsupported parcel version/u);

    const foreign = new Uint8Array(encoded);
    foreign[0] = 0x00;
    expect(() => decodeParcel(foreign)).toThrow(ParcelError);

    expect(() => decodeParcel(new Uint8Array(12))).toThrow(ParcelError);
  });

  it("round-trips a password-protected share through parcel export and offline import", async () => {
    const context = generateShareContext();
    const password = "parcel-secret-7";
    const passwordSalt = bytesToBase64Url(randomBytes(16));
    const sealedContent = await sealContent(
      { mode: "note", text: "protected parcel body" },
      context,
      { mask: "link+password", passwordSalt, password }
    );
    const sealedFile = await sealFile(
      { filename: "notes.txt", mimeType: "text/plain", data: new Uint8Array([9, 9, 9]) },
      context,
      { mask: "link+password", passwordSalt, password }
    );

    const encoded = encodeParcel({
      publicId: context.publicId,
      policy: {
        availableAt: null,
        expiresAt: null,
        maxReveals: 2,
        revealWindowSeconds: null,
        createdAt: "2026-08-24T00:00:00.000Z",
      },
      contentEnvelope: sealedContent.envelope,
      attachments: [{ slot: 0, envelope: sealedFile.envelope, ciphertext: sealedFile.ciphertext }],
    });
    const decoded = decodeParcel(encoded);
    expect(decoded.contentEnvelope.factorMask).toBe("link+password");

    const factors = {
      mask: "link+password" as const,
      password,
      passwordSalt: decoded.contentEnvelope.passwordSalt ?? undefined,
    };
    const opened = await openContent(decoded.contentEnvelope, context.publicId, context.linkSecret, factors);
    expect(opened).toEqual({ mode: "note", text: "protected parcel body" });

    const filePayload = await openFile(
      decoded.attachments[0].envelope,
      decoded.attachments[0].ciphertext,
      context.publicId,
      context.linkSecret,
      factors
    );
    expect(filePayload.filename).toBe("notes.txt");

    // A wrong password fails closed.
    await expect(
      openContent(
        decoded.contentEnvelope,
        context.publicId,
        context.linkSecret,
        { mask: "link+password", password: "wrong", passwordSalt: decoded.contentEnvelope.passwordSalt ?? undefined }
      )
    ).rejects.toThrow();
  });
});

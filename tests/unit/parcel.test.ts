import { describe, expect, it } from "vitest";

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
});

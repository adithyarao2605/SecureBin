import { expect, test } from "vitest";
import { parseCreateShareInput, parseUploadReservationInput } from "../../lib/shares/contracts";

const envelopeV2 = {
  version: 2, objectType: "content", algorithm: "AES-256-GCM",
  nonce: "AAAAAAAAAAAAAAAA", hkdfSalt: "AAAAAAAAAAAAAAAAAAAAAA",
  passwordSalt: null, kdf: "none", kdfParameters: {}, factorMask: "link",
  ciphertext: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};

test("probe create", () => {
  const payload = {
    publicId: "AQEBAQEBAQEBAQEBAQEBAQ",
    contentEnvelope: envelopeV2,
    policy: { availableAt: null, expiresAt: new Date(Date.now() + 86400000).toISOString(), maxReveals: null },
    deleteTokenHash: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
    idempotencyKeyHash: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
    passwordRequired: false,
    unlockRequired: false,
    fileEnvelope: null,
    fileCiphertextSize: null,
  };
  expect(parseCreateShareInput(payload)).toBeNull(); // composer no longer sends these
});

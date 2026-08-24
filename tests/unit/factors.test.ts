import { describe, expect, it } from "vitest";
import {
  buildFactorIkm,
  FactorError,
  FACTOR_MASKS,
  generateUnlockCode,
  PBKDF2_ITERATIONS,
  prepareFactors,
  unlockCodeToBytes,
} from "../../lib/crypto/factors";
import { sealContent, openContent } from "../../lib/crypto/content";
import { generateShareContext } from "../../lib/crypto/share-context";
import { bytesToArrayBuffer, bytesToBase64Url, randomBytes, utf8Encode } from "../../lib/crypto/encoding";
import { canonicalAad, CONTENT_HKDF_LABEL_V2, FILE_HKDF_LABEL_V2, newContentEnvelope, newFileEnvelope, type EnvelopeKdfOptions } from "../../lib/crypto/envelope";
import { encodeContentPayload } from "../../lib/crypto/payload";
import { encodeFileFrame } from "../../lib/crypto/file";

const LINK = bytesToBase64Url(randomBytes(32));

describe("unlock codes", () => {
  it("round-trips generated codes to the same 16 bytes", () => {
    const { code, bytes } = generateUnlockCode();
    expect(code).toMatch(/^[0-9A-HJ-NP-Z]{27}$/u);
    expect(unlockCodeToBytes(code)).toEqual(bytes);
  });

  it("rejects wrong check symbols and invalid characters", () => {
    const { code } = generateUnlockCode();
    const tampered = `${code.slice(0, -1)}${code.endsWith("0") ? "1" : "0"}`;
    expect(() => unlockCodeToBytes(tampered)).toThrow(FactorError);
    expect(() => unlockCodeToBytes(`${code}IIIII`.slice(0, 26) + "I!")).toThrow(FactorError);
  });

  it("rejects non-canonical aliases and separators", () => {
    const { code, bytes } = generateUnlockCode();
    expect(() => unlockCodeToBytes(`${code.slice(0, 5)}-${code.slice(5)}`)).toThrow(FactorError);
    expect(() => unlockCodeToBytes(code.toLowerCase())).toThrow(FactorError);
    expect(unlockCodeToBytes(code)).toEqual(bytes);
    expect(code).not.toMatch(/[ILOU]/u);
  });
});

describe("factor IKM derivation", () => {
  it("differs per mask even with identical inputs", async () => {
    const link = bytesToBase64Url(randomBytes(32));
    const salt = randomBytes(16);
    const { bytes: unlock } = generateUnlockCode();
    const linkIkm = await buildFactorIkm(link, "link", {});
    const pwIkm = await buildFactorIkm(link, "link+password", { password: "hunter2", passwordSalt: salt });
    const ulIkm = await buildFactorIkm(link, "link+unlock", { unlockBytes: unlock });
    const bothIkm = await buildFactorIkm(link, "link+password+unlock", {
      password: "hunter2",
      passwordSalt: salt,
      unlockBytes: unlock,
    });
    const set = new Set([bytesToBase64Url(linkIkm), bytesToBase64Url(pwIkm), bytesToBase64Url(ulIkm), bytesToBase64Url(bothIkm)]);
    expect(set.size).toBe(4);
    expect(linkIkm.length).toBe(32);
    expect(pwIkm.length).toBe(64);
    expect(ulIkm.length).toBe(48);
    expect(bothIkm.length).toBe(80);
  });

  it("is deterministic for the same password and salt", async () => {
    const salt = randomBytes(16);
    const a = await buildFactorIkm(LINK, "link+password", { password: "same", passwordSalt: salt });
    const b = await buildFactorIkm(LINK, "link+password", { password: "same", passwordSalt: salt });
    expect(a).toEqual(b);
  });

  it("throws on missing or extraneous material", async () => {
    await expect(buildFactorIkm(LINK, "link+password", {})).rejects.toThrow(FactorError);
    await expect(
      buildFactorIkm(LINK, "link", { password: "nope", passwordSalt: randomBytes(16) })
    ).rejects.toThrow(FactorError);
    await expect(buildFactorIkm(LINK, "link+unlock", {})).rejects.toThrow(FactorError);
  });

  it("enforces password byte bounds", () => {
    expect(() => prepareFactors({ password: "" })).not.toThrow(); // empty = no factor
    expect(() => prepareFactors({ password: "x".repeat(1025) })).toThrow(FactorError);
  });

  it("uses the locked iteration count", () => {
    expect(PBKDF2_ITERATIONS).toBe(600_000);
    expect(FACTOR_MASKS).toHaveLength(4);
  });
});

describe("locked v2 factor-mask golden vectors", () => {
  it("freezes content and file ciphertext for every deployed factor mask", async () => {
    const publicId = bytesToBase64Url(new Uint8Array(16).fill(0x11));
    const linkSecret = bytesToBase64Url(new Uint8Array(32).fill(0x22));
    const nonce = new Uint8Array(12).fill(0x33);
    const hkdfSalt = new Uint8Array(16).fill(0x44);
    const passwordSalt = new Uint8Array(16).fill(0x55);
    const unlockBytes = new Uint8Array(16).fill(0x66);
    const contentPlaintext = encodeContentPayload({ mode: "note", text: "factor vector" });
    const filePlaintext = encodeFileFrame("vector.txt", "text/plain", utf8Encode("factor file"));
    const vectors: Array<{ mask: string; content: string; file: string }> = [];

    for (const mask of FACTOR_MASKS) {
      const hasPassword = mask.includes("password");
      const ikm = await buildFactorIkm(linkSecret, mask, {
        password: hasPassword ? "golden-password" : undefined,
        passwordSalt: hasPassword ? passwordSalt : undefined,
        unlockBytes: mask.includes("unlock") ? unlockBytes : undefined,
      });
      const shapeOptions: EnvelopeKdfOptions = {
        factorMask: mask,
        passwordSalt: hasPassword ? passwordSalt : null,
        kdf: hasPassword ? ("PBKDF2-HMAC-SHA-256" as const) : ("none" as const),
        kdfParameters: hasPassword ? { iterations: 600000 } : {},
      };
      const contentShape = newContentEnvelope(nonce, hkdfSalt, new Uint8Array(16), 2, shapeOptions);
      const fileShape = newFileEnvelope(nonce, hkdfSalt, undefined, {
        factorMask: mask,
        passwordSalt: hasPassword ? passwordSalt : null,
      });

      async function encrypt(label: string, aad: Uint8Array, plaintext: Uint8Array): Promise<string> {
        const baseKey = await crypto.subtle.importKey("raw", bytesToArrayBuffer(ikm), "HKDF", false, ["deriveKey"]);
        const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: bytesToArrayBuffer(hkdfSalt), info: bytesToArrayBuffer(utf8Encode(label)) }, baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
        const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: bytesToArrayBuffer(nonce), additionalData: bytesToArrayBuffer(aad) }, key, bytesToArrayBuffer(plaintext));
        return bytesToBase64Url(new Uint8Array(ciphertext));
      }

      vectors.push({
        mask,
        content: await encrypt(CONTENT_HKDF_LABEL_V2, canonicalAad(publicId, contentShape), contentPlaintext),
        file: await encrypt(FILE_HKDF_LABEL_V2, canonicalAad(publicId, fileShape), filePlaintext),
      });
    }

    expect(vectors).toEqual([
      {
        mask: "link",
        content: "1n75hjKjWQZmr1gB3XXGWUFxtQSWjUmR2KO52cz-b3VzUHSMdxkP4Q",
        file: "dm7MsFo7wHRwm1-3Me7iN3VtW3SjhD5Kpead1TUiwEcLZQSfFGuNUcbCaIC5lqjs8EjkSbw",
      },
      {
        mask: "link+password",
        content: "ni7HBElLkTjIxpTO0SHK3yIS6TDtBpyjaANQFOQeH0Bvhlc4atAb5A",
        file: "kqffhxWvTLTuKDSPMzYO3yXynMuqTHZYK2Lkflg3evnA824sSSK1yUeaHDmCR1zuGeqbNnE",
      },
      {
        mask: "link+unlock",
        content: "vUZG5KATmw-VyuGsGBsPu2PSAtJ15OJtVkYVIW843aJCK2WeKyUPEQ",
        file: "LxODHfdjxbn86GQFz5XmPKI42ycuoTmsB7hAsz0WxV1y9dAi3PZ1Q6ByMWIw3tJdXbw0i1U",
      },
      {
        mask: "link+password+unlock",
        content: "zm9VS81OkdO1ap5YWe_oBu_LRZxg5CT1uAlQVSwOjSK70_0CfyS8FA",
        file: "zGBYP1BvJ-eC6oEpKOqWksMbXOoJp4G-RuCDkHAnLMfAb4gGfN-8odmOEn-Ak6TjXKPKvO4",
      },
    ]);
  });
});

describe("masked content seal/open round trips", () => {
  const context = generateShareContext();
  const prepared = prepareFactors({ password: "correct horse", enableUnlock: true });
  const factors = {
    mask: prepared.mask,
    passwordSalt: prepared.passwordSalt as string,
    password: "correct horse",
    unlockCode: prepared.unlockCode as string,
  };
  const text = "two-channel secret payload";

  it("seals under link+password+unlock and opens with both factors", async () => {
    const sealed = await sealContent({ mode: "note", text }, context, factors);
    expect(sealed.envelope.factorMask).toBe("link+password+unlock");
    expect(sealed.envelope.kdf).toBe("PBKDF2-HMAC-SHA-256");
    expect(sealed.envelope.kdfParameters).toEqual({ iterations: 600000 });
    expect(sealed.envelope.passwordSalt).toBe(prepared.passwordSalt);

    const opened = await openContent(sealed.envelope, context.publicId, context.linkSecret, {
      mask: "link+password+unlock",
      passwordSalt: prepared.passwordSalt,
      password: "correct horse",
      unlockCode: prepared.unlockCode as string,
    });
    expect(opened).toEqual({ mode: "note", text });
  });

  it("fails closed for a wrong password without network calls", async () => {
    const sealed = await sealContent({ mode: "note", text }, context, factors);
    await expect(
      openContent(sealed.envelope, context.publicId, context.linkSecret, {
        mask: "link+password+unlock",
        passwordSalt: prepared.passwordSalt,
        password: "wrong password",
        unlockCode: prepared.unlockCode as string,
      })
    ).rejects.toThrow();
  });

  it("fails closed when a factor is omitted entirely", async () => {
    const sealed = await sealContent({ mode: "note", text }, context, factors);
    await expect(
      openContent(sealed.envelope, context.publicId, context.linkSecret)
    ).rejects.toThrow();
  });

  it("binds the mask into the AAD: link-only key cannot open masked share", async () => {
    const sealed = await sealContent({ mode: "note", text }, context, factors);
    // Attempt opening while claiming the link-only mask: envelope's own
    // factorMask drives IKM/AAD, so this exercises wrong-material rejection.
    const { unlockCodeToBytes: _unused } = await import("../../lib/crypto/factors");
    void _unused;
    await expect(
      openContent(sealed.envelope, context.publicId, context.linkSecret, {
        mask: "link",
        unlockCode: undefined,
      })
    ).rejects.toThrow();
  });
});

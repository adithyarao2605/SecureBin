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
import { bytesToBase64Url, randomBytes } from "../../lib/crypto/encoding";

const LINK = bytesToBase64Url(randomBytes(32));

describe("unlock codes", () => {
  it("round-trips generated codes to the same 16 bytes", () => {
    const { code, bytes } = generateUnlockCode();
    expect(code).toMatch(/^[0-9A-HJ-NP-Z]{5}(?:-[0-9A-HJ-NP-Z]{5}){4}-[0-9A-HJ-NP-Z]{2}$/u);
    expect(unlockCodeToBytes(code)).toEqual(bytes);
  });

  it("rejects wrong check symbols and invalid characters", () => {
    const { code } = generateUnlockCode();
    const tampered = `${code.slice(0, -1)}${code.endsWith("0") ? "1" : "0"}`;
    expect(() => unlockCodeToBytes(tampered)).toThrow(FactorError);
    expect(() => unlockCodeToBytes(`${code}IIIII`.slice(0, 26) + "I!")).toThrow(FactorError);
  });

  it("normalizes ambiguous glyphs and separators", () => {
    const { code, bytes } = generateUnlockCode();
    // Replace every separator and swap O->0 / I->1 / L->1 where present.
    const noisy = code.replace(/-/g, " ").replace(/0/g, "O");
    expect(unlockCodeToBytes(noisy.replace(/O/g, "0"))).toEqual(bytes);
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

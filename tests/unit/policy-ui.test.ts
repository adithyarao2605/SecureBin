import { describe, expect, it } from "vitest";

import {
  computeExpiryDate,
  defaultPolicyDraft,
  formatExpiryLabel,
  formatRevealLimitLabel,
  localDateTimeToIsoUtc,
  validatePolicyDraft,
} from "@/lib/shares/policy-ui";

describe("policy-ui helper functions", () => {
  const fixedNow = 1_770_000_000_000; // deterministic timestamp in ms

  it("computes expiry dates accurately from preset and clock", () => {
    const exp24h = computeExpiryDate("24h", 24, "hours", fixedNow);
    expect(Date.parse(exp24h)).toBe(fixedNow + 24 * 60 * 60 * 1000);

    const exp7d = computeExpiryDate("7d", 24, "hours", fixedNow);
    expect(Date.parse(exp7d)).toBe(fixedNow + 7 * 24 * 60 * 60 * 1000);

    const exp30d = computeExpiryDate("30d", 24, "hours", fixedNow);
    expect(Date.parse(exp30d)).toBe(fixedNow + 30 * 24 * 60 * 60 * 1000);

    const expCustomHours = computeExpiryDate("custom", 12, "hours", fixedNow);
    expect(Date.parse(expCustomHours)).toBe(fixedNow + 12 * 60 * 60 * 1000);

    const expCustomDays = computeExpiryDate("custom", 3, "days", fixedNow);
    expect(Date.parse(expCustomDays)).toBe(fixedNow + 3 * 24 * 60 * 60 * 1000);
  });

  it("converts valid local date and time to ISO UTC string", () => {
    const iso = localDateTimeToIsoUtc("2026-08-25", "14:30");
    expect(iso).toBeDefined();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // Invalid format returns null
    expect(localDateTimeToIsoUtc("invalid", "14:30")).toBeNull();
    expect(localDateTimeToIsoUtc("2026-08-25", "99:99")).toBeNull();
  });

  it("formats expiry and reveal limit labels accurately according to spec", () => {
    expect(formatExpiryLabel("24h")).toBe("24 hours");
    expect(formatExpiryLabel("7d")).toBe("7 days");
    expect(formatExpiryLabel("30d")).toBe("30 days");
    expect(formatExpiryLabel("custom", 5, "days")).toBe("5 days");

    expect(formatRevealLimitLabel(1)).toBe("One-time reveal");
    expect(formatRevealLimitLabel(3)).toBe("3 reveals");
    expect(formatRevealLimitLabel(5)).toBe("5 reveals");
    expect(formatRevealLimitLabel(10)).toBe("10 reveals");
    expect(formatRevealLimitLabel(null)).toBe("Unlimited");
  });

  it("validates available now policy draft correctly", () => {
    const draft = defaultPolicyDraft();
    const result = validatePolicyDraft(draft, fixedNow);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.availableAt).toBeNull();
      expect(result.expiresAt).not.toBeNull();
      expect(Date.parse(result.expiresAt as string)).toBe(fixedNow + 24 * 60 * 60 * 1000);
      expect(result.maxReveals).toBeNull();
    }
  });

  it("validates custom expiry within bounds", () => {
    const validDraft = {
      availability: "now" as const,
      availableLocalDate: "2026-08-22",
      availableLocalTime: "12:00",
      expiryPreset: "custom" as const,
      customExpiryValue: 48,
      customExpiryUnit: "hours" as const,
      maxReveals: null,
    };
    const validRes = validatePolicyDraft(validDraft, fixedNow);
    expect(validRes.valid).toBe(true);
    if (validRes.valid) {
      expect(validRes.expiresAt).not.toBeNull();
      expect(Date.parse(validRes.expiresAt as string)).toBe(fixedNow + 48 * 60 * 60 * 1000);
    }

    const overMaxDraft = {
      ...validDraft,
      customExpiryValue: 35,
      customExpiryUnit: "days" as const,
    };
    const overRes = validatePolicyDraft(overMaxDraft, fixedNow);
    expect(overRes.valid).toBe(false);

    const invalidValueDraft = {
      ...validDraft,
      customExpiryValue: -5,
    };
    const invalidRes = validatePolicyDraft(invalidValueDraft, fixedNow);
    expect(invalidRes.valid).toBe(false);
  });

  it("validates only the supported reveal presets", () => {
    for (const [revealPreset, maxReveals] of [
      ["burn", 1],
      ["3", 3],
      ["5", 5],
      ["10", 10],
      ["unlimited", null],
    ] as const) {
      const result = validatePolicyDraft(
        { ...defaultPolicyDraft(), revealPreset, maxReveals },
        fixedNow,
      );
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.maxReveals).toBe(maxReveals);
    }

    const mismatchedDraft = {
      ...defaultPolicyDraft(),
      revealPreset: "3" as const,
      maxReveals: null,
    };
    const mismatchedResult = validatePolicyDraft(mismatchedDraft, fixedNow);
    expect(mismatchedResult.valid).toBe(false);

    // Day 5: custom reveal counts between 1 and 100.
    const customDraft = {
      ...defaultPolicyDraft(),
      revealPreset: "custom" as const,
      customMaxReveals: 42,
      maxReveals: 42,
    };
    const customResult = validatePolicyDraft(customDraft, fixedNow);
    expect(customResult.valid).toBe(true);
    if (customResult.valid) expect(customResult.maxReveals).toBe(42);

    for (const bad of [0, -3, 101, 2.5]) {
      const badResult = validatePolicyDraft(
        { ...defaultPolicyDraft(), revealPreset: "custom" as const, customMaxReveals: bad, maxReveals: bad },
        fixedNow,
      );
      expect(badResult.valid).toBe(false);
    }

    // Never expiry produces a null expiresAt while remaining revocable.
    const neverDraft = { ...defaultPolicyDraft(), expiryPreset: "never" as const };
    const neverResult = validatePolicyDraft(neverDraft, fixedNow);
    expect(neverResult.valid).toBe(true);
    if (neverResult.valid) expect(neverResult.expiresAt).toBeNull();
  });

  it("rejects scheduled availability in the past", () => {
    const draft = {
      availability: "scheduled" as const,
      availableLocalDate: "2020-01-01",
      availableLocalTime: "10:00",
      expiryPreset: "24h" as const,
      maxReveals: 1 as const,
    };
    const result = validatePolicyDraft(draft, fixedNow);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("cannot be in the past");
    }
  });

  it("rejects scheduled availability after expiry", () => {
    const draft = {
      availability: "scheduled" as const,
      availableLocalDate: "2026-08-30",
      availableLocalTime: "10:00",
      expiryPreset: "24h" as const,
      maxReveals: 3 as const,
    };
    const result = validatePolicyDraft(draft, fixedNow);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("must be before the expiration date");
    }
  });

  it("resolves reveal window presets to seconds and validates custom bounds", () => {
    const base = defaultPolicyDraft();

    const none = validatePolicyDraft({ ...base, revealWindowPreset: "none" }, fixedNow);
    expect(none.valid && none.revealWindowSeconds).toBe(null);

    const preset = validatePolicyDraft({ ...base, revealWindowPreset: "5m" }, fixedNow);
    expect(preset.valid && preset.revealWindowSeconds).toBe(300);

    const custom = validatePolicyDraft(
      { ...base, revealWindowPreset: "custom", customRevealWindowSeconds: 600 },
      fixedNow
    );
    expect(custom.valid && custom.revealWindowSeconds).toBe(600);

    const tooSmall = validatePolicyDraft(
      { ...base, revealWindowPreset: "custom", customRevealWindowSeconds: 5 },
      fixedNow
    );
    if (tooSmall.valid) throw new Error("expected 5s window to be rejected");

    const tooLarge = validatePolicyDraft(
      { ...base, revealWindowPreset: "custom", customRevealWindowSeconds: 86_401 },
      fixedNow
    );
    if (tooLarge.valid) throw new Error("expected >24h window to be rejected");
  });
});

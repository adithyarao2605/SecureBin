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

    expect(formatRevealLimitLabel(1)).toBe("Once — burn after opening");
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
      expect(Date.parse(result.expiresAt)).toBe(fixedNow + 24 * 60 * 60 * 1000);
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
      expect(Date.parse(validRes.expiresAt)).toBe(fixedNow + 48 * 60 * 60 * 1000);
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

  it("validates and formats custom reveal limits within 1-100", () => {
    const customDraft = {
      ...defaultPolicyDraft(),
      revealPreset: "custom" as const,
      customMaxReveals: 7,
      maxReveals: 7,
    };
    const res = validatePolicyDraft(customDraft, fixedNow);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.maxReveals).toBe(7);
    }
    expect(formatRevealLimitLabel(7)).toBe("7 reveals");

    const overMaxDraft = {
      ...customDraft,
      customMaxReveals: 105,
    };
    const overRes = validatePolicyDraft(overMaxDraft, fixedNow);
    expect(overRes.valid).toBe(false);

    const invalidDraft = {
      ...customDraft,
      customMaxReveals: 0,
    };
    const invalidRes = validatePolicyDraft(invalidDraft, fixedNow);
    expect(invalidRes.valid).toBe(false);
  });

  it("rejects scheduled availability in the past", () => {
    const draft = {
      availability: "scheduled" as const,
      availableLocalDate: "2020-01-01",
      availableLocalTime: "10:00",
      expiryPreset: "24h" as const,
      maxReveals: 1,
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
      maxReveals: 3,
    };
    const result = validatePolicyDraft(draft, fixedNow);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("must be before the expiration date");
    }
  });
});

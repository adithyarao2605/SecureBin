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
    const exp24h = computeExpiryDate("24h", fixedNow);
    expect(Date.parse(exp24h)).toBe(fixedNow + 24 * 60 * 60 * 1000);

    const exp7d = computeExpiryDate("7d", fixedNow);
    expect(Date.parse(exp7d)).toBe(fixedNow + 7 * 24 * 60 * 60 * 1000);

    const exp30d = computeExpiryDate("30d", fixedNow);
    expect(Date.parse(exp30d)).toBe(fixedNow + 30 * 24 * 60 * 60 * 1000);
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

  it("rejects scheduled availability in the past", () => {
    const draft = {
      availability: "scheduled" as const,
      availableLocalDate: "2020-01-01",
      availableLocalTime: "12:00",
      expiryPreset: "24h" as const,
      maxReveals: 1 as const,
    };
    const result = validatePolicyDraft(draft, fixedNow);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/past/i);
    }
  });

  it("rejects scheduled availability after expiration date", () => {
    const futureDate = new Date(fixedNow + 10 * 86_400_000);
    const dateStr = futureDate.toISOString().slice(0, 10);
    const timeStr = "12:00";

    const draft = {
      availability: "scheduled" as const,
      availableLocalDate: dateStr,
      availableLocalTime: timeStr,
      expiryPreset: "24h" as const, // 24h expires before 10 days
      maxReveals: 5 as const,
    };

    const result = validatePolicyDraft(draft, fixedNow);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/before/i);
    }
  });
});

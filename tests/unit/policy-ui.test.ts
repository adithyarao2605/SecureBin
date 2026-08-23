import { describe, expect, it } from "vitest";

import {
  applyPolicyPreset,
  computeExpiryDate,
  defaultPolicyDraft,
  formatExpiryLabel,
  formatRevealLimitLabel,
  localDateTimeToIsoUtc,
  policyPresetForDraft,
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
});

describe("policy presets", () => {
  // fixedNow ≈ 2026-02-02 UTC, so a date within the following week stays valid.
  const fixedNow = 1_770_000_000_000;
  const scheduledWindow = { date: "2026-02-05", time: "09:00" };
  const base = defaultPolicyDraft();

  it("leaves the draft unchanged for the Custom preset", () => {
    expect(applyPolicyPreset("custom", base, scheduledWindow)).toBe(base);
  });

  it("maps Quick Share to now / 24h / unlimited", () => {
    const next = applyPolicyPreset(
      "quick-share",
      { ...base, availability: "scheduled", expiryPreset: "7d", revealPreset: "burn", maxReveals: 1 },
      scheduledWindow
    );
    expect(next.availability).toBe("now");
    expect(next.expiryPreset).toBe("24h");
    expect(next.revealPreset).toBe("unlimited");
    expect(next.maxReveals).toBeNull();
    expect(validatePolicyDraft(next, fixedNow).valid).toBe(true);
  });

  it("maps One-Time Secret to now / 24h / one reveal", () => {
    const next = applyPolicyPreset("one-time-secret", base, scheduledWindow);
    expect(next.availability).toBe("now");
    expect(next.expiryPreset).toBe("24h");
    expect(next.revealPreset).toBe("burn");
    expect(next.maxReveals).toBe(1);
    const validated = validatePolicyDraft(next, fixedNow);
    expect(validated.valid).toBe(true);
    if (validated.valid) expect(validated.maxReveals).toBe(1);
  });

  it("maps Controlled Share to now / 7d / 3 reveals", () => {
    const next = applyPolicyPreset("controlled-share", base, scheduledWindow);
    expect(next.availability).toBe("now");
    expect(next.expiryPreset).toBe("7d");
    expect(next.revealPreset).toBe("3");
    expect(next.maxReveals).toBe(3);
    expect(validatePolicyDraft(next, fixedNow).valid).toBe(true);
  });

  it("maps Timed Handoff to tomorrow-morning scheduling with a 7-day custom expiry", () => {
    const next = applyPolicyPreset("timed-handoff", base, scheduledWindow);
    expect(next.availability).toBe("scheduled");
    expect(next.availableLocalDate).toBe("2026-02-05");
    expect(next.availableLocalTime).toBe("09:00");
    expect(next.expiryPreset).toBe("custom");
    expect(next.customExpiryValue).toBe(7);
    expect(next.customExpiryUnit).toBe("days");
    expect(validatePolicyDraft(next, fixedNow).valid).toBe(true);
  });

  it("detects the matching preset from a draft and falls back to Custom", () => {
    expect(policyPresetForDraft(base)).toBe("quick-share");
    for (const preset of ["one-time-secret", "controlled-share", "timed-handoff"] as const) {
      expect(policyPresetForDraft(applyPolicyPreset(preset, base, scheduledWindow))).toBe(preset);
    }
    expect(policyPresetForDraft({ ...base, expiryPreset: "30d" })).toBe("custom");
    expect(policyPresetForDraft({ ...base, maxReveals: 5, revealPreset: "5" })).toBe("custom");
  });
});

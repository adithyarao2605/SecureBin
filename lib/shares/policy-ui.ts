import type { MaxReveals } from "./contracts";

export type ProoflinePhase =
  | "draft"
  | "creating"
  | "created"
  | "scheduled"
  | "ready"
  | "revealing"
  | "opened"
  | "unavailable";

export type ExpiryPreset = "24h" | "7d" | "30d";

export interface PolicyDraft {
  readonly availability: "now" | "scheduled";
  readonly availableLocalDate: string;
  readonly availableLocalTime: string;
  readonly expiryPreset: ExpiryPreset;
  readonly maxReveals: MaxReveals;
}

export function defaultPolicyDraft(): PolicyDraft {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  const hours = String(tomorrow.getHours()).padStart(2, "0");
  const minutes = String(tomorrow.getMinutes()).padStart(2, "0");

  return {
    availability: "now",
    availableLocalDate: `${year}-${month}-${day}`,
    availableLocalTime: `${hours}:${minutes}`,
    expiryPreset: "24h",
    maxReveals: null,
  };
}

export function computeExpiryDate(preset: ExpiryPreset, nowMillis: number = Date.now()): string {
  let offsetMillis = 24 * 60 * 60 * 1000;
  if (preset === "7d") offsetMillis = 7 * 24 * 60 * 60 * 1000;
  if (preset === "30d") offsetMillis = 30 * 24 * 60 * 60 * 1000;

  return new Date(nowMillis + offsetMillis).toISOString();
}

export function localDateTimeToIsoUtc(dateStr: string, timeStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return null;
  }
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const [hourStr, minuteStr] = timeStr.split(":");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  const hour = Number.parseInt(hourStr, 10);
  const minute = Number.parseInt(minuteStr, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day ||
    localDate.getHours() !== hour ||
    localDate.getMinutes() !== minute
  ) {
    return null;
  }

  return localDate.toISOString();
}

export function formatLocalizedDateTime(isoUtc: string | null): string {
  if (!isoUtc) return "Available now";
  try {
    const date = new Date(isoUtc);
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return isoUtc;
  }
}

export function formatExpiryLabel(preset: ExpiryPreset): string {
  switch (preset) {
    case "24h":
      return "24 hours";
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
  }
}

export function formatRevealLimitLabel(maxReveals: MaxReveals): string {
  switch (maxReveals) {
    case 1:
      return "Once — burn after opening";
    case 3:
      return "3 reveals";
    case 5:
      return "5 reveals";
    case 10:
      return "10 reveals";
    case null:
      return "Unlimited";
  }
}

export type ValidatedPolicy =
  | {
      readonly valid: true;
      readonly availableAt: string | null;
      readonly expiresAt: string;
      readonly maxReveals: MaxReveals;
    }
  | {
      readonly valid: false;
      readonly error: string;
    };

export function validatePolicyDraft(
  draft: PolicyDraft,
  nowMillis: number = Date.now()
): ValidatedPolicy {
  let availableAt: string | null = null;
  if (draft.availability === "scheduled") {
    availableAt = localDateTimeToIsoUtc(draft.availableLocalDate, draft.availableLocalTime);
    if (!availableAt) {
      return { valid: false, error: "Please enter a valid date and time." };
    }
    const availMillis = Date.parse(availableAt);
    if (availMillis < nowMillis - 60_000) {
      return { valid: false, error: "Scheduled availability cannot be in the past." };
    }
  }

  const expiresAt = computeExpiryDate(draft.expiryPreset, nowMillis);
  if (availableAt && Date.parse(availableAt) >= Date.parse(expiresAt)) {
    return {
      valid: false,
      error: "Scheduled availability must be before the expiration date.",
    };
  }

  return {
    valid: true,
    availableAt,
    expiresAt,
    maxReveals: draft.maxReveals,
  };
}

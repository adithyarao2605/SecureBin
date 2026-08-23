import { MAX_MAX_REVEALS, MIN_MAX_REVEALS, isMaxReveals, type MaxReveals } from "./contracts";

export type ProoflinePhase =
  | "draft"
  | "creating"
  | "created"
  | "scheduled"
  | "ready"
  | "revealing"
  | "opened"
  | "unavailable";

export type ExpiryPreset = "24h" | "7d" | "30d" | "custom" | "never";
export type ExpiryUnit = "hours" | "days";
export type RevealPreset = "burn" | "3" | "5" | "10" | "custom" | "unlimited";

export interface PolicyDraft {
  readonly availability: "now" | "scheduled";
  readonly availableLocalDate: string;
  readonly availableLocalTime: string;
  readonly expiryPreset: ExpiryPreset;
  readonly customExpiryValue?: number;
  readonly customExpiryUnit?: ExpiryUnit;
  readonly revealPreset?: RevealPreset;
  readonly customMaxReveals?: number;
  readonly maxReveals: MaxReveals;
}

/** Local calendar date (YYYY-MM-DD) one day from nowMillis. */
export function tomorrowLocalDate(nowMillis: number = Date.now()): string {
  const tomorrow = new Date(nowMillis + 86_400_000);
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${tomorrow.getFullYear()}-${month}-${day}`;
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
    customExpiryValue: 24,
    customExpiryUnit: "hours",
    revealPreset: "unlimited",
    maxReveals: null,
  };
}

export function computeExpiryDate(
  preset: Exclude<ExpiryPreset, "never">,
  customValue = 24,
  customUnit: ExpiryUnit = "hours",
  nowMillis: number = Date.now()
): string {
  let offsetMillis = 24 * 60 * 60 * 1000;
  if (preset === "7d") offsetMillis = 7 * 24 * 60 * 60 * 1000;
  else if (preset === "30d") offsetMillis = 30 * 24 * 60 * 60 * 1000;
  else if (preset === "custom") {
    const mult = customUnit === "days" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    offsetMillis = Math.max(60 * 60 * 1000, Math.min(30 * 24 * 60 * 60 * 1000, customValue * mult));
  }

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

export function formatLocalizedDateTime(isoUtc: string | null, nullLabel = "Never"): string {
  if (!isoUtc) return nullLabel;
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

export function formatExpiryLabel(preset: ExpiryPreset, customValue = 24, customUnit: ExpiryUnit = "hours"): string {
  switch (preset) {
    case "never":
      return "Never expires";
    case "24h":
      return "24 hours";
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    case "custom":
      return `${customValue} ${customUnit}`;
  }
}

export function formatRevealLimitLabel(maxReveals: MaxReveals): string {
  if (maxReveals === null) {
    return "Unlimited";
  }
  if (maxReveals === 1) {
    return "Once — burn after opening";
  }
  return `${maxReveals} reveals`;
}

function maxRevealsForPreset(preset: Exclude<RevealPreset, "custom">): MaxReveals | undefined {
  switch (preset) {
    case "burn":
      return 1;
    case "3":
      return 3;
    case "5":
      return 5;
    case "10":
      return 10;
    case "unlimited":
      return null;
    default:
      return undefined;
  }
}

export type ValidatedPolicy =
  | {
      readonly valid: true;
      readonly availableAt: string | null;
      /** Null means the share never expires (still revocable). */
      readonly expiresAt: string | null;
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

  let expiresAt: string | null = null;
  if (draft.expiryPreset === "never") {
    expiresAt = null;
  } else if (draft.expiryPreset === "custom") {
    const val = draft.customExpiryValue ?? 24;
    const unit = draft.customExpiryUnit ?? "hours";
    if (!Number.isInteger(val) || val <= 0) {
      return { valid: false, error: "Custom expiration duration must be a positive integer." };
    }
    const totalHours = unit === "days" ? val * 24 : val;
    if (totalHours > 720) {
      return { valid: false, error: "Custom expiration cannot exceed 30 days (720 hours)." };
    }
    expiresAt = computeExpiryDate("custom", val, unit, nowMillis);
  } else {
    expiresAt = computeExpiryDate(draft.expiryPreset, 24, "hours", nowMillis);
  }

  if (expiresAt !== null && availableAt && Date.parse(availableAt) >= Date.parse(expiresAt)) {
    return {
      valid: false,
      error: "Scheduled availability must be before the expiration date.",
    };
  }

  // Resolve the requested limit: presets carry their own value; a custom
  // preset validates the bounded numeric input; programmatic drafts (no
  // preset) use the value as-is.
  let maxReveals: MaxReveals;
  if (draft.revealPreset === "custom") {
    const val = draft.customMaxReveals;
    if (
      typeof val !== "number" ||
      !Number.isInteger(val) ||
      val < MIN_MAX_REVEALS ||
      val > MAX_MAX_REVEALS
    ) {
      return {
        valid: false,
        error: `Custom reveal limit must be a whole number between ${MIN_MAX_REVEALS} and ${MAX_MAX_REVEALS}.`,
      };
    }
    maxReveals = val;
  } else if (draft.revealPreset !== undefined) {
    const fromPreset = maxRevealsForPreset(draft.revealPreset);
    if (fromPreset === undefined || fromPreset !== draft.maxReveals) {
      return { valid: false, error: "Please choose a supported reveal limit." };
    }
    maxReveals = fromPreset;
  } else {
    if (!isMaxReveals(draft.maxReveals)) {
      return { valid: false, error: "Please choose a supported reveal limit." };
    }
    maxReveals = draft.maxReveals;
  }

  return {
    valid: true,
    availableAt,
    expiresAt,
    maxReveals,
  };
}

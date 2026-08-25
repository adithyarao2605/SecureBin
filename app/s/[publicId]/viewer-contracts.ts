import {
  type ContentEnvelope,
  type FileEnvelope,
  validateContentEnvelope,
  validateFileEnvelope,
} from "../../../lib/crypto/envelope";
import {
  isMaxReveals,
  MAX_ATTACHMENTS,
  MAX_FILE_CIPHERTEXT_SIZE,
  parseIsoUtc,
  type MaxReveals,
} from "../../../lib/shares/contracts";
import type { ProoflinePhase } from "../../../lib/shares/policy-ui";

export type ActiveStatus = {
  status: "active";
  availableAt: string | null;
  expiresAt: string | null;
  maxReveals: MaxReveals;
  remainingReveals: number | null;
  passwordRequired: boolean;
  unlockRequired: boolean;
};

export type ScheduledStatus = {
  status: "scheduled";
  availableAt: string;
  expiresAt: string | null;
  maxReveals: MaxReveals;
  remainingReveals: number | null;
  passwordRequired: boolean;
  unlockRequired: boolean;
};

export type ShareStatus = ActiveStatus | ScheduledStatus | { status: "unavailable" };

export interface ParsedReveal {
  readonly contentEnvelope: ContentEnvelope;
  readonly files: Array<{
    readonly slot: number;
    readonly envelope: FileEnvelope;
    readonly ciphertextSize: number;
    readonly downloadUrl: string;
  }>;
  readonly retryExpiresAt: string;
  /** Sender-chosen release window end; null when no window applies. */
  readonly releaseWindowEndsAt: string | null;
}

export type ViewerState =
  | "checking"
  | "incomplete"
  | "network_error"
  | "scheduled"
  | "ready_unlimited"
  | "ready_limited"
  | "confirming"
  | "pending"
  | "opened"
  | "unavailable";

export class ViewerPayloadError extends Error {}

export function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ViewerPayloadError();
  }
}

export function hasOnlyKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[]) {
  const allowed = new Set([...required, ...optional]);
  if (!required.every((k) => k in value) || !Object.keys(value).every((k) => allowed.has(k))) {
    throw new ViewerPayloadError();
  }
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRevealCounters(value: Record<string, unknown>): {
  maxReveals: MaxReveals;
  remainingReveals: number | null;
} {
  if (!isMaxReveals(value.maxReveals)) throw new ViewerPayloadError();
  const remainingReveals = value.remainingReveals;
  if (value.maxReveals === null) {
    if (remainingReveals !== null) throw new ViewerPayloadError();
    return { maxReveals: null, remainingReveals: null };
  }
  if (
    typeof remainingReveals !== "number" ||
    !Number.isInteger(remainingReveals) ||
    remainingReveals < 0 ||
    remainingReveals > value.maxReveals
  ) {
    throw new ViewerPayloadError();
  }
  return { maxReveals: value.maxReveals, remainingReveals };
}

export function parseStatus(value: unknown): ShareStatus {
  if (!record(value)) throw new ViewerPayloadError();
  if (value.status === "unavailable") {
    exactKeys(value, ["status"]);
    return { status: "unavailable" };
  }

  if (value.status === "scheduled") {
    exactKeys(value, [
      "availableAt",
      "expiresAt",
      "maxReveals",
      "passwordRequired",
      "remainingReveals",
      "status",
      "unlockRequired",
    ]);
    if (
      typeof value.availableAt !== "string" ||
      (value.expiresAt !== null && typeof value.expiresAt !== "string") ||
      typeof value.passwordRequired !== "boolean" ||
      typeof value.unlockRequired !== "boolean"
    ) {
      throw new ViewerPayloadError();
    }
    const counters = parseRevealCounters(value);
    return {
      status: "scheduled",
      availableAt: value.availableAt,
      expiresAt: value.expiresAt,
      ...counters,
      passwordRequired: value.passwordRequired,
      unlockRequired: value.unlockRequired,
    };
  }

  if (value.status !== "active") {
    throw new ViewerPayloadError();
  }

  exactKeys(value, [
    "availableAt",
    "expiresAt",
    "maxReveals",
    "passwordRequired",
    "remainingReveals",
    "status",
    "unlockRequired",
  ]);
  if (
    (value.availableAt !== null && typeof value.availableAt !== "string") ||
    (value.expiresAt !== null && typeof value.expiresAt !== "string") ||
    typeof value.passwordRequired !== "boolean" ||
    typeof value.unlockRequired !== "boolean"
  ) {
    throw new ViewerPayloadError();
  }
  const counters = parseRevealCounters(value);
  return {
    status: "active",
    availableAt: value.availableAt,
    expiresAt: value.expiresAt,
    ...counters,
    passwordRequired: value.passwordRequired,
    unlockRequired: value.unlockRequired,
  };
}

export function parseReveal(value: unknown): ParsedReveal {
  if (!record(value)) throw new ViewerPayloadError();
  hasOnlyKeys(value, ["contentEnvelope", "files", "releaseWindowEndsAt", "retryExpiresAt", "status"], []);
  const retryExpiresAt = parseIsoUtc(value.retryExpiresAt);
  if (value.status !== "authorized" || !retryExpiresAt) {
    throw new ViewerPayloadError();
  }
  const contentEnvelope = validateContentEnvelope(value.contentEnvelope);

  if (!Array.isArray(value.files) || value.files.length > MAX_ATTACHMENTS) throw new ViewerPayloadError();
  const slots = new Set<number>();
  const files = value.files.map((entry): ParsedReveal["files"][number] => {
    if (!record(entry)) throw new ViewerPayloadError();
    exactKeys(entry, ["ciphertextSize", "downloadUrl", "envelope", "slot"]);
    if (
      typeof entry.ciphertextSize !== "number" ||
      !Number.isSafeInteger(entry.ciphertextSize) ||
      entry.ciphertextSize < 16 ||
      entry.ciphertextSize > MAX_FILE_CIPHERTEXT_SIZE ||
      typeof entry.downloadUrl !== "string" ||
      !isDownloadUrl(entry.downloadUrl) ||
      typeof entry.slot !== "number" ||
      !Number.isSafeInteger(entry.slot) ||
      entry.slot < 0 ||
      entry.slot >= MAX_ATTACHMENTS ||
      slots.has(entry.slot)
    ) {
      throw new ViewerPayloadError();
    }
    slots.add(entry.slot);
    const fileEnvelope = validateFileEnvelope(entry.envelope);
    return {
      slot: entry.slot,
      envelope: fileEnvelope,
      ciphertextSize: entry.ciphertextSize,
      downloadUrl: entry.downloadUrl,
    };
  });
  const releaseWindowEndsAt = value.releaseWindowEndsAt === null ? null : parseIsoUtc(value.releaseWindowEndsAt);
  if (value.releaseWindowEndsAt !== null && !releaseWindowEndsAt) throw new ViewerPayloadError();

  return {
    contentEnvelope,
    files,
    retryExpiresAt,
    releaseWindowEndsAt,
  };
}

function isDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.username === "" && url.password === "" && url.hash === "";
  } catch {
    return false;
  }
}

export function prooflinePhaseFor(state: ViewerState): ProoflinePhase {
  switch (state) {
    case "checking":
      return "draft";
    case "incomplete":
    case "network_error":
    case "scheduled":
    case "ready_unlimited":
    case "ready_limited":
    case "confirming":
      return "created";
    case "pending":
      return "creating";
    case "opened":
      return "opened";
    case "unavailable":
      return "unavailable";
  }
}

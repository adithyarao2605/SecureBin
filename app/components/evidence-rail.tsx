import type { ProoflinePhase, ValidatedPolicy } from "@/lib/shares/policy-ui";
import { formatLocalizedDateTime, formatRevealLimitLabel } from "@/lib/shares/policy-ui";
import { Proofline } from "./proofline";

export interface EvidenceRailProps {
  readonly phase: ProoflinePhase;
  readonly policy: ValidatedPolicy;
}

export function EvidenceRail({ phase, policy }: EvidenceRailProps) {
  const isPolicyValid = policy.valid;
  const availableText = isPolicyValid
    ? policy.availableAt
      ? `Available ${formatLocalizedDateTime(policy.availableAt)}`
      : "Available now"
    : "Policy invalid";

  const expiresText = isPolicyValid
    ? `Expires ${formatLocalizedDateTime(policy.expiresAt)}`
    : "—";

  const revealsText = isPolicyValid ? formatRevealLimitLabel(policy.maxReveals) : "—";

  return (
    <aside className="evidence-rail" aria-label="Evidence rail">
      <Proofline phase={phase} />

      <div className="evidence-section">
        <h2 className="evidence-heading">Access policy</h2>
        <ul className="evidence-list">
          <li className="evidence-item">{availableText}</li>
          <li className="evidence-item">{expiresText}</li>
          <li className="evidence-item">{revealsText}</li>
        </ul>
      </div>

      <div className="evidence-section">
        <h2 className="evidence-heading">Browser boundary</h2>
        <p className="evidence-copy">
          Your browser encrypts this before it leaves the page.
        </p>
        <p className="evidence-copy secondary">
          The service stores a sealed parcel and limited policy metadata.
        </p>
      </div>
    </aside>
  );
}

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
      : "Available immediately"
    : "Policy invalid";

  const expiresText = isPolicyValid
    ? `Expires ${formatLocalizedDateTime(policy.expiresAt)}`
    : "—";

  const revealsText = isPolicyValid ? formatRevealLimitLabel(policy.maxReveals) : "—";

  return (
    <aside className="evidence-rail" aria-label="Evidence rail">
      <Proofline phase={phase} />

      {/* Access policy live summary */}
      <div className="evidence-section">
        <h2 className="evidence-heading">Active Policy Summary</h2>
        <ul className="evidence-list">
          <li className="evidence-item">
            <span className="evidence-dot active" aria-hidden="true" />
            <span>{availableText}</span>
          </li>
          <li className="evidence-item">
            <span className="evidence-dot active" aria-hidden="true" />
            <span>{expiresText}</span>
          </li>
          <li className="evidence-item">
            <span className="evidence-dot active" aria-hidden="true" />
            <span>{revealsText}</span>
          </li>
        </ul>
      </div>

      {/* Trust boundary and visual flowchart */}
      <div className="evidence-section flowchart-section">
        <div className="evidence-title-row">
          <h2 className="evidence-heading">Zero-Knowledge Flow</h2>
          <span className="evidence-badge">Client Proof</span>
        </div>

        <p className="evidence-copy">
          Your browser encrypts this before it leaves the page. Secret keys remain in the URL fragment (<code className="evidence-code">#...</code>) and never touch the server.
        </p>

        {/* Visual architecture flowchart */}
        <div className="flowchart-container" aria-label="Cryptographic lifecycle flowchart">
          <div className="flowchart-node">
            <div className="node-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
            </div>
            <div className="node-content">
              <span className="node-title">1. Sender Browser</span>
              <span className="node-desc">Local AES-256-GCM encryption with HKDF key derivation.</span>
            </div>
          </div>

          <div className="flowchart-connector" aria-hidden="true">
            <div className="connector-line" />
            <span className="connector-label">Ciphertext Only</span>
            <div className="connector-line" />
          </div>

          <div className="flowchart-node">
            <div className="node-icon server-node">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="node-content">
              <span className="node-title">2. Sealed Parcel (Server)</span>
              <span className="node-desc">Stores only ciphertext & enforces atomic row-locked reveal limits.</span>
            </div>
          </div>

          <div className="flowchart-connector" aria-hidden="true">
            <div className="connector-line" />
            <span className="connector-label">Authorizes Lease</span>
            <div className="connector-line" />
          </div>

          <div className="flowchart-node">
            <div className="node-icon recipient-node">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="node-content">
              <span className="node-title">3. Recipient Browser</span>
              <span className="node-desc">Fetches ciphertext lease & decrypts in memory with URL fragment key.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Invariants checklist */}
      <div className="evidence-section invariants-section">
        <h2 className="evidence-heading">Security Invariants</h2>
        <ul className="invariants-list">
          <li>
            <span className="invariant-check">✓</span>
            <span>Zero plaintext or keys sent over the network</span>
          </li>
          <li>
            <span className="invariant-check">✓</span>
            <span>No IP addresses or hardware fingerprints stored</span>
          </li>
          <li>
            <span className="invariant-check">✓</span>
            <span>Atomic database race protection</span>
          </li>
          <li>
            <span className="invariant-check">✓</span>
            <span>Uniform unavailable state for missing/expired shares</span>
          </li>
        </ul>
      </div>
    </aside>
  );
}

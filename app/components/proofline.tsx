import type { ProoflinePhase } from "@/lib/shares/policy-ui";

export interface ProoflineProps {
  readonly phase: ProoflinePhase;
  readonly compact?: boolean;
}

export function Proofline({ phase, compact = false }: ProoflineProps) {
  let phaseLabel = "Local draft";
  let statusClass = "status-draft";

  switch (phase) {
    case "draft":
      phaseLabel = "Local draft";
      statusClass = "status-draft";
      break;
    case "creating":
      phaseLabel = "Sealing parcel…";
      statusClass = "status-creating";
      break;
    case "created":
      phaseLabel = "Sealed parcel ready";
      statusClass = "status-created";
      break;
    case "scheduled":
      phaseLabel = "Scheduled availability";
      statusClass = "status-scheduled";
      break;
    case "ready":
      phaseLabel = "Ready to reveal";
      statusClass = "status-ready";
      break;
    case "revealing":
      phaseLabel = "Authorizing release…";
      statusClass = "status-revealing";
      break;
    case "opened":
      phaseLabel = "Opened locally";
      statusClass = "status-opened";
      break;
    case "unavailable":
      phaseLabel = "Unavailable";
      statusClass = "status-unavailable";
      break;
  }

  return (
    <div
      className={`proofline-container ${compact ? "proofline-compact" : ""}`}
      role="region"
      aria-label="Parcel flow"
    >
      <div className="proofline-track" aria-hidden="true">
        <span className="proofline-node">
          <span className="proofline-icon node-browser" />
          <span className="proofline-sub">Browser</span>
        </span>
        <span className="proofline-segment" />
        <span className="proofline-node">
          <span className="proofline-icon node-parcel" />
          <span className="proofline-sub">Sealed parcel</span>
        </span>
        <span className="proofline-segment" />
        <span className="proofline-node">
          <span className="proofline-icon node-recipient" />
          <span className="proofline-sub">Recipient</span>
        </span>
      </div>
      <div className="proofline-status">
        <span className={`status-indicator ${statusClass}`} aria-hidden="true" />
        <span className="status-label">{phaseLabel}</span>
      </div>
    </div>
  );
}

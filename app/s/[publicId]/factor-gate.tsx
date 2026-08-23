"use client";

type FactorGateProps = {
  passwordRequired: boolean;
  unlockRequired: boolean;
  passwordValue: string;
  unlockValue: string;
  onPasswordChange: (value: string) => void;
  onUnlockChange: (value: string) => void;
  error: string;
  onSubmit: () => void;
};

export function FactorGate({
  passwordRequired,
  unlockRequired,
  passwordValue,
  unlockValue,
  onPasswordChange,
  onUnlockChange,
  error,
  onSubmit,
}: FactorGateProps) {
  return (
    <div className="viewer-action-box factor-box">
      <p className="viewer-status-text">This share is protected. Enter the required details to continue.</p>
      {passwordRequired && (
        <div className="policy-input-group">
          <label htmlFor="viewer-password" className="policy-input-label">
            Password
          </label>
          <input
            id="viewer-password"
            type="password"
            autoComplete="off"
            className="policy-number-input"
            value={passwordValue}
            onChange={(e) => onPasswordChange(e.target.value)}
          />
        </div>
      )}
      {unlockRequired && (
        <div className="policy-input-group">
          <label htmlFor="viewer-unlock" className="policy-input-label">
            Unlock code (sent over a separate channel)
          </label>
          <input
            id="viewer-unlock"
            className="policy-number-input"
            autoComplete="off"
            spellCheck={false}
            value={unlockValue}
            onChange={(e) => onUnlockChange(e.target.value)}
          />
        </div>
      )}
      {error && (
        <p className="viewer-status-text" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="action-button primary-button" onClick={onSubmit}>
        Continue
      </button>
    </div>
  );
}

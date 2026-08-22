"use client";

import { useState } from "react";

export interface ProtectionState {
  readonly password: string;
  readonly confirmPassword: string;
  readonly enableUnlock: boolean;
}

export const EMPTY_PROTECTION: ProtectionState = {
  password: "",
  confirmPassword: "",
  enableUnlock: false,
};

export interface ProtectionControlsProps {
  readonly value: ProtectionState;
  onChange: (next: ProtectionState) => void;
  readonly disabled?: boolean;
  readonly error?: string;
}

/**
 * Optional protection controls (T1 §0 policy UX): progressive disclosure —
 * everything is collapsed behind a single toggle until the sender opts in.
 */
export function ProtectionControls({ value, onChange, disabled = false, error }: ProtectionControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const active = value.password.length > 0 || value.enableUnlock;

  return (
    <div className="protection-controls">
      <button
        type="button"
        className="protection-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {active ? "Protection configured" : "Add password or second channel"}
      </button>

      {error && (
        <div className="composer-error" role="alert">
          {error}
        </div>
      )}

      {expanded && (
        <div className="protection-body">
          <div className="policy-input-group">
            <label htmlFor="protection-password" className="policy-input-label">
              Password (optional)
            </label>
            <input
              id="protection-password"
              type="password"
              className="policy-number-input"
              autoComplete="new-password"
              maxLength={1024}
              disabled={disabled}
              value={value.password}
              onChange={(e) => onChange({ ...value, password: e.target.value })}
            />
            <label htmlFor="protection-confirm" className="policy-input-label">
              Confirm password
            </label>
            <input
              id="protection-confirm"
              type="password"
              className="policy-number-input"
              autoComplete="new-password"
              maxLength={1024}
              disabled={disabled}
              value={value.confirmPassword}
              onChange={(e) => onChange({ ...value, confirmPassword: e.target.value })}
            />
          </div>

          <label className="policy-radio-label">
            <input
              type="checkbox"
              checked={value.enableUnlock}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, enableUnlock: e.target.checked })}
            />
            <span>Require a separate unlock code (send it over a different channel)</span>
          </label>

          <p className="policy-hint">
            Your browser mixes the password and unlock code into the key locally. Neither ever
            reaches the server; the link alone cannot open a protected share.
          </p>

          <button
            type="button"
            className="preflight-toggle"
            aria-expanded={showPreflight}
            onClick={() => setShowPreflight((prev) => !prev)}
          >
            What will SecureBin see?
          </button>
          {showPreflight && (
            <div className="preflight-panel" role="note">
              <p>The server receives:</p>
              <ul>
                <li>Ciphertext (encrypted content and files)</li>
                <li>Encrypted filenames and file types</li>
                <li>Availability, expiry, reveal policy</li>
                <li>Ciphertext size bucket</li>
              </ul>
              <p>The server never receives:</p>
              <ul>
                <li>Plaintext content</li>
                <li>The link secret in the URL fragment</li>
                <li>Your password</li>
                <li>The unlock code</li>
                <li>Plaintext filenames or file types</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

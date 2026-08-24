"use client";

import { useState } from "react";
import type {
  ExpiryPreset,
  PolicyDraft,
  RevealPreset,
  RevealWindowPreset,
} from "../../lib/shares/policy-ui";
import { formatExpiryLabel, formatRevealLimitLabel, resolveRevealWindowSeconds } from "../../lib/shares/policy-ui";

export interface PolicyControlsProps {
  readonly draft: PolicyDraft;
  readonly onChange: (updated: PolicyDraft) => void;
  readonly disabled?: boolean;
}

export function PolicyControls({ draft, onChange, disabled = false }: PolicyControlsProps) {
  const [releaseWindowInfoOpen, setReleaseWindowInfoOpen] = useState(false);
  // Preset wins when set; otherwise infer from maxReveals, falling through to
  // "custom" for a non-preset count so the custom input reflects its value.
  const currentRevealPreset: RevealPreset =
    draft.revealPreset ??
    (draft.maxReveals === 1
      ? "burn"
      : draft.maxReveals === 3
      ? "3"
      : draft.maxReveals === 5
      ? "5"
      : draft.maxReveals === 10
      ? "10"
      : draft.maxReveals === null
      ? "unlimited"
      : "custom");

  return (
    <div className="policy-controls-container">
      <div className="policy-summary" aria-label="Active access policy">
        <p className="policy-summary-eyebrow">Access policy</p>
        <dl className="policy-summary-grid">
          <div><dt>Available</dt><dd>{draft.availability === "now" ? "Immediately" : "Scheduled"}</dd></div>
          <div><dt>Expires</dt><dd>{formatExpiryLabel(draft.expiryPreset, draft.customExpiryValue, draft.customExpiryUnit)}</dd></div>
          <div><dt>Releases</dt><dd>{formatRevealLimitLabel(draft.maxReveals)}</dd></div>
          <div><dt>Reveal window</dt><dd>{(() => { const seconds = resolveRevealWindowSeconds(draft.revealWindowPreset ?? "none", draft.customRevealWindowSeconds); return seconds === null ? "None" : seconds === "invalid" ? "Custom" : `${seconds}s`; })()}</dd></div>
        </dl>
      </div>
      <details className="policy-advanced">
        <summary>Customize policy</summary>
        <div className="policy-advanced-body">
      {/* Availability Fieldset */}
      <fieldset className="policy-fieldset">
        <legend className="policy-legend">When can this share be opened?</legend>
        <div className="policy-radio-group">
          <label className="policy-radio-label">
            <input
              type="radio"
              name="availability"
              value="now"
              checked={draft.availability === "now"}
              disabled={disabled}
              onChange={() => onChange({ ...draft, availability: "now" })}
            />
            <span>Available now</span>
          </label>
          <label className="policy-radio-label">
            <input
              type="radio"
              name="availability"
              value="scheduled"
              checked={draft.availability === "scheduled"}
              disabled={disabled}
              onChange={() => onChange({ ...draft, availability: "scheduled" })}
            />
            <span>Schedule availability</span>
          </label>
        </div>

        {draft.availability === "scheduled" && (
          <div className="policy-scheduled-inputs">
            <div className="policy-input-group">
              <label htmlFor="available-on-date" className="policy-input-label">
                Available on
              </label>
              <input
                id="available-on-date"
                type="date"
                className="policy-date-input"
                value={draft.availableLocalDate}
                disabled={disabled}
                onChange={(e) => onChange({ ...draft, availableLocalDate: e.target.value })}
              />
            </div>
            <div className="policy-input-group">
              <label htmlFor="available-at-time" className="policy-input-label">
                Available at
              </label>
              <input
                id="available-at-time"
                type="time"
                className="policy-time-input"
                value={draft.availableLocalTime}
                disabled={disabled}
                onChange={(e) => onChange({ ...draft, availableLocalTime: e.target.value })}
              />
            </div>
            <p className="policy-hint">Shown in your local time; stored as UTC.</p>
          </div>
        )}
      </fieldset>

      {/* Expiry Field */}
      <div className="policy-field-group">
        <label htmlFor="expiry-preset-select" className="policy-legend">
          Expires after
        </label>
        <select
          id="expiry-preset-select"
          className="policy-select"
          value={draft.expiryPreset}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, expiryPreset: e.target.value as ExpiryPreset })}
        >
          <option value="24h">24 hours</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="never">Never (revocable anytime)</option>
          <option value="custom">Custom duration</option>
        </select>

        {draft.expiryPreset === "custom" && (
          <div className="policy-custom-expiry-inputs">
            <div className="policy-input-group">
              <label htmlFor="custom-expiry-value" className="policy-input-label">
                Duration
              </label>
              <input
                id="custom-expiry-value"
                type="number"
                min={1}
                max={draft.customExpiryUnit === "days" ? 30 : 720}
                className="policy-number-input"
                value={draft.customExpiryValue ?? 24}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    customExpiryValue: Number.parseInt(e.target.value, 10) || 1,
                  })
                }
              />
            </div>
            <div className="policy-input-group">
              <label htmlFor="custom-expiry-unit" className="policy-input-label">
                Unit
              </label>
              <select
                id="custom-expiry-unit"
                className="policy-select"
                value={draft.customExpiryUnit ?? "hours"}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    customExpiryUnit: e.target.value as "hours" | "days",
                  })
                }
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <p className="policy-hint">Maximum 30 days (720 hours).</p>
          </div>
        )}
      </div>

      {/* Reveal Limits Fieldset */}
      <fieldset className="policy-fieldset">
        <legend className="policy-legend">How many times can the ciphertext be released?</legend>
        <div className="policy-radio-group">
          <label className="policy-radio-label">
            <input
              type="radio"
              name="maxReveals"
              value="burn"
              checked={currentRevealPreset === "burn"}
              disabled={disabled}
              onChange={() =>
                onChange({
                  ...draft,
                  revealPreset: "burn",
                  maxReveals: 1,
                })
              }
            />
            <span>One-time reveal</span>
          </label>
          <label className="policy-radio-label">
            <input
              type="radio"
              name="maxReveals"
              value="3"
              checked={currentRevealPreset === "3"}
              disabled={disabled}
              onChange={() =>
                onChange({
                  ...draft,
                  revealPreset: "3",
                  maxReveals: 3,
                })
              }
            />
            <span>3 reveals</span>
          </label>
          <label className="policy-radio-label">
            <input
              type="radio"
              name="maxReveals"
              value="5"
              checked={currentRevealPreset === "5"}
              disabled={disabled}
              onChange={() =>
                onChange({
                  ...draft,
                  revealPreset: "5",
                  maxReveals: 5,
                })
              }
            />
            <span>5 reveals</span>
          </label>
          <label className="policy-radio-label">
            <input
              type="radio"
              name="maxReveals"
              value="10"
              checked={currentRevealPreset === "10"}
              disabled={disabled}
              onChange={() =>
                onChange({
                  ...draft,
                  revealPreset: "10",
                  maxReveals: 10,
                })
              }
            />
            <span>10 reveals</span>
          </label>
          <label className="policy-radio-label">
            <input
              type="radio"
              name="maxReveals"
              value="unlimited"
              checked={currentRevealPreset === "unlimited"}
              disabled={disabled}
              onChange={() =>
                onChange({
                  ...draft,
                  revealPreset: "unlimited",
                  maxReveals: null,
                })
              }
            />
            <span>Unlimited</span>
          </label>
          <label className="policy-radio-label">
            <input
              type="radio"
              name="maxReveals"
              value="custom"
              checked={currentRevealPreset === "custom"}
              disabled={disabled}
              onChange={() =>
                onChange({
                  ...draft,
                  revealPreset: "custom",
                  customMaxReveals: draft.customMaxReveals ?? 5,
                  maxReveals: draft.customMaxReveals ?? 5,
                })
              }
            />
            <span>Custom</span>
          </label>
        </div>

        {currentRevealPreset === "custom" && (
          <div className="policy-input-group">
            <label htmlFor="custom-reveal-count" className="policy-input-label">
              Exact number of ciphertext releases
            </label>
            <input
              id="custom-reveal-count"
              type="number"
              min={1}
              max={100}
              className="policy-number-input"
              value={draft.customMaxReveals ?? 5}
              disabled={disabled}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value, 10);
                onChange({
                  ...draft,
                  customMaxReveals: Number.isNaN(val) ? undefined : val,
                  // Invalid intermediate states fail validation on submit.
                  maxReveals: Number.isNaN(val) ? null : val,
                });
              }}
            />
          </div>
        )}

        <p className="policy-hint">
          A reveal authorizes one ciphertext release. It does not know whether the recipient read it.
        </p>
      </fieldset>

      {/* Release Window Fieldset */}
      <fieldset className="policy-fieldset">
        <legend className="policy-legend">When should further releases close?</legend>
        <div className="policy-input-group">
          <div className="policy-label-with-info">
            <label htmlFor="reveal-window-preset" className="policy-input-label">
              Release window after the first opening
            </label>
            <button
              type="button"
              className="policy-info-button"
              aria-label="About release windows"
              aria-expanded={releaseWindowInfoOpen}
              aria-controls="release-window-explanation"
              onClick={() => setReleaseWindowInfoOpen((open) => !open)}
            >
              <span aria-hidden="true">i</span>
            </button>
          </div>
          {releaseWindowInfoOpen && (
            <p id="release-window-explanation" className="policy-info-panel">
              The window starts with the first server-authorized ciphertext release. When it closes,
              new releases become unavailable and this browser hides its open copy. SecureBin cannot
              erase copies a recipient already saved.
            </p>
          )}
          <select
            id="reveal-window-preset"
            className="policy-select"
            value={draft.revealWindowPreset ?? "none"}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...draft,
                revealWindowPreset: e.target.value as RevealWindowPreset,
                customRevealWindowSeconds: draft.customRevealWindowSeconds ?? 60,
              })
            }
          >
            <option value="none">No extra window</option>
            <option value="10s">10 seconds</option>
            <option value="30s">30 seconds</option>
            <option value="1m">1 minute</option>
            <option value="5m">5 minutes</option>
            <option value="custom">Custom window</option>
          </select>

          {draft.revealWindowPreset === "custom" && (
            <div className="policy-custom-expiry-inputs">
              <div className="policy-input-group">
                <label htmlFor="custom-reveal-window" className="policy-input-label">
                  Window length (seconds)
                </label>
                <input
                  id="custom-reveal-window"
                  type="number"
                  min={10}
                  max={86_400}
                  className="policy-number-input"
                  value={draft.customRevealWindowSeconds ?? 60}
                  disabled={disabled}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value, 10);
                    onChange({
                      ...draft,
                      customRevealWindowSeconds: Number.isNaN(val) ? undefined : val,
                    });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </fieldset>
        </div>
      </details>
    </div>
  );
}

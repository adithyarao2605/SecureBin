import type { ExpiryPreset, PolicyDraft, RevealPreset } from "@/lib/shares/policy-ui";

export interface PolicyControlsProps {
  readonly draft: PolicyDraft;
  readonly onChange: (updated: PolicyDraft) => void;
  readonly disabled?: boolean;
}

export function PolicyControls({ draft, onChange, disabled = false }: PolicyControlsProps) {
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
            <span>Once — burn after opening</span>
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
              value="custom"
              checked={currentRevealPreset === "custom"}
              disabled={disabled}
              onChange={() => {
                const val = draft.customMaxReveals ?? 5;
                onChange({
                  ...draft,
                  revealPreset: "custom",
                  customMaxReveals: val,
                  maxReveals: val,
                });
              }}
            />
            <span>Custom</span>
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
        </div>

        {currentRevealPreset === "custom" && (
          <div className="policy-custom-reveals-input">
            <div className="policy-input-group">
              <label htmlFor="custom-reveals-value" className="policy-input-label">
                Custom reveal limit
              </label>
              <input
                id="custom-reveals-value"
                type="number"
                min={1}
                max={100}
                className="policy-number-input"
                value={draft.customMaxReveals ?? 5}
                disabled={disabled}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10) || 1;
                  onChange({
                    ...draft,
                    revealPreset: "custom",
                    customMaxReveals: val,
                    maxReveals: val,
                  });
                }}
              />
            </div>
            <p className="policy-hint">Enter between 1 and 100 authorized reveals.</p>
          </div>
        )}

        <p className="policy-hint">
          A reveal authorizes one ciphertext release. It does not know whether the recipient read it.
        </p>
      </fieldset>
    </div>
  );
}

import type { ExpiryPreset, PolicyDraft } from "@/lib/shares/policy-ui";

export interface PolicyControlsProps {
  readonly draft: PolicyDraft;
  readonly onChange: (updated: PolicyDraft) => void;
  readonly disabled?: boolean;
}

export function PolicyControls({ draft, onChange, disabled = false }: PolicyControlsProps) {
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
        </select>
      </div>

      {/* Reveal Limits Fieldset */}
      <fieldset className="policy-fieldset">
        <legend className="policy-legend">How many times can the ciphertext be released?</legend>
        <div className="policy-radio-group">
          <label className="policy-radio-label">
            <input
              type="radio"
              name="maxReveals"
              value="1"
              checked={draft.maxReveals === 1}
              disabled={disabled}
              onChange={() => onChange({ ...draft, maxReveals: 1 })}
            />
            <span>Once — burn after opening</span>
          </label>
          <label className="policy-radio-label">
            <input
              type="radio"
              name="maxReveals"
              value="3"
              checked={draft.maxReveals === 3}
              disabled={disabled}
              onChange={() => onChange({ ...draft, maxReveals: 3 })}
            />
            <span>3 reveals</span>
          </label>
          <label className="policy-radio-label">
            <input
              type="radio"
              name="maxReveals"
              value="5"
              checked={draft.maxReveals === 5}
              disabled={disabled}
              onChange={() => onChange({ ...draft, maxReveals: 5 })}
            />
            <span>5 reveals</span>
          </label>
          <label className="policy-radio-label">
            <input
              type="radio"
              name="maxReveals"
              value="10"
              checked={draft.maxReveals === 10}
              disabled={disabled}
              onChange={() => onChange({ ...draft, maxReveals: 10 })}
            />
            <span>10 reveals</span>
          </label>
          <label className="policy-radio-label">
            <input
              type="radio"
              name="maxReveals"
              value="null"
              checked={draft.maxReveals === null}
              disabled={disabled}
              onChange={() => onChange({ ...draft, maxReveals: null })}
            />
            <span>Unlimited</span>
          </label>
        </div>
        <p className="policy-hint">
          A reveal authorizes one ciphertext release. It does not know whether the recipient read it.
        </p>
      </fieldset>
    </div>
  );
}

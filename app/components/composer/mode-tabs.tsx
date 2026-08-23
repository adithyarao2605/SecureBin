"use client";

import { CODE_LANGUAGES, type CodeLanguage } from "../../../lib/crypto/payload";
import { MAX_CONTENT_BYTES } from "../../../lib/crypto/envelope";
import { formatBytes } from "./format";

export type ComposerMode = "note" | "markdown" | "code";

interface ModeTabsProps {
  readonly mode: ComposerMode;
  readonly language: CodeLanguage;
  readonly draftByteCount: number;
  readonly disabled: boolean;
  onModeChange: (mode: ComposerMode) => void;
  onLanguageChange: (language: CodeLanguage) => void;
}

export function ModeTabs({
  mode,
  language,
  draftByteCount,
  disabled,
  onModeChange,
  onLanguageChange,
}: ModeTabsProps) {
  return (
    <div className="composer-toolbar">
      <div className="mode-tabs-group">
        <div className="mode-tabs" role="tablist" aria-label="Share mode">
          <button type="button" role="tab" aria-selected={mode === "note"} className={`mode-tab ${mode === "note" ? "active" : ""}`} onClick={() => onModeChange("note")}>
            Plain note
          </button>
          <button type="button" role="tab" aria-selected={mode === "markdown"} className={`mode-tab ${mode === "markdown" ? "active" : ""}`} onClick={() => onModeChange("markdown")}>
            Markdown
          </button>
          <button type="button" role="tab" aria-selected={mode === "code"} className={`mode-tab ${mode === "code" ? "active" : ""}`} onClick={() => onModeChange("code")}>
            Code
          </button>
        </div>

        {mode === "code" && (
          <div className="language-selector-wrapper">
            <label htmlFor="code-language-select" className="sr-only">Programming language</label>
            <select id="code-language-select" className="language-select" value={language} disabled={disabled} onChange={(e) => onLanguageChange(e.target.value as CodeLanguage)}>
              {CODE_LANGUAGES.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
            </select>
          </div>
        )}
      </div>

      <span className="character-count" aria-live="polite">
        {formatBytes(draftByteCount)} / {formatBytes(MAX_CONTENT_BYTES)}
      </span>
    </div>
  );
}

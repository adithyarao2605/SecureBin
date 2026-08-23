"use client";

import { MarkdownView } from "../markdown-view";
import type { ComposerMode } from "./mode-tabs";

export type MarkdownViewMode = "edit" | "split" | "preview";

interface EditorPaneProps {
  readonly mode: ComposerMode;
  readonly markdownView: MarkdownViewMode;
  readonly draft: string;
  readonly disabled: boolean;
  onDraftChange: (value: string) => void;
  onMarkdownViewChange: (view: MarkdownViewMode) => void;
}

export function EditorPane({
  mode,
  markdownView,
  draft,
  disabled,
  onDraftChange,
  onMarkdownViewChange,
}: EditorPaneProps) {
  return (
    <>
      {mode === "markdown" && (
        <div className="md-view-toggle" role="tablist" aria-label="Markdown editor view">
          <button
            type="button"
            role="tab"
            aria-selected={markdownView === "edit"}
            className={`md-view-option ${markdownView === "edit" ? "active" : ""}`}
            onClick={() => onMarkdownViewChange("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={markdownView === "split"}
            className={`md-view-option ${markdownView === "split" ? "active" : ""}`}
            onClick={() => onMarkdownViewChange("split")}
          >
            Split
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={markdownView === "preview"}
            className={`md-view-option ${markdownView === "preview" ? "active" : ""}`}
            onClick={() => onMarkdownViewChange("preview")}
          >
            Preview
          </button>
        </div>
      )}

      <div className={mode === "markdown" && markdownView === "split" ? "md-split" : undefined}>
        {(mode !== "markdown" || markdownView !== "preview") && (
          <>
            <label htmlFor="draft-textarea" className="sr-only">
              {mode === "note" ? "Note content" : mode === "markdown" ? "Markdown content" : "Code content"}
            </label>
            <textarea
              id="draft-textarea"
              className="composer-textarea"
              placeholder={
                mode === "note"
                  ? "Start typing your note here..."
                  : mode === "markdown"
                  ? "Write Markdown (# heading, **bold**, - list)…"
                  : "Paste code snippet…"
              }
              value={draft}
              disabled={disabled}
              onChange={(e) => onDraftChange(e.target.value)}
            />
          </>
        )}
        {mode === "markdown" && markdownView !== "edit" && (
          <div className="composer-md-preview" aria-label="Markdown preview">
            <MarkdownView markdown={draft} />
          </div>
        )}
      </div>
    </>
  );
}

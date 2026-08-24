"use client";

import { useRef, type KeyboardEvent } from "react";
import { MarkdownView } from "../markdown-view";
import type { ComposerMode } from "./mode-tabs";
import type { CodeLanguage } from "../../../lib/crypto/payload";
import { highlightCode } from "../../../lib/render/code";

export type MarkdownViewMode = "edit" | "split" | "preview";

interface EditorPaneProps {
  readonly mode: ComposerMode;
  readonly markdownView: MarkdownViewMode;
  readonly draft: string;
  readonly disabled: boolean;
  readonly language: CodeLanguage;
  onDraftChange: (value: string) => void;
  onMarkdownViewChange: (view: MarkdownViewMode) => void;
}

export function EditorPane({
  mode,
  markdownView,
  draft,
  disabled,
  language,
  onDraftChange,
  onMarkdownViewChange,
}: EditorPaneProps) {
  const markdownTabs = useRef<Array<HTMLButtonElement | null>>([]);
  const markdownViews: MarkdownViewMode[] = ["edit", "split", "preview"];
  function onMarkdownTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const current = markdownViews.indexOf(markdownView);
    const next = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? (current + 1) % markdownViews.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
      ? (current + markdownViews.length - 1) % markdownViews.length
      : event.key === "Home"
      ? 0
      : event.key === "End"
      ? markdownViews.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    onMarkdownViewChange(markdownViews[next]);
    markdownTabs.current[next]?.focus();
  }

  return (
    <>
      {mode === "markdown" && (
        <div className="md-view-toggle" role="tablist" aria-label="Markdown editor view">
          <button
            type="button"
            role="tab"
            tabIndex={markdownView === "edit" ? 0 : -1}
            aria-controls="markdown-editor-panel"
            aria-selected={markdownView === "edit"}
            className={`md-view-option ${markdownView === "edit" ? "active" : ""}`}
            ref={(node) => { markdownTabs.current[0] = node; }}
            onKeyDown={onMarkdownTabKeyDown}
            onClick={() => onMarkdownViewChange("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            tabIndex={markdownView === "split" ? 0 : -1}
            aria-controls="markdown-editor-panel"
            aria-selected={markdownView === "split"}
            className={`md-view-option split-option ${markdownView === "split" ? "active" : ""}`}
            ref={(node) => { markdownTabs.current[1] = node; }}
            onKeyDown={onMarkdownTabKeyDown}
            onClick={() => onMarkdownViewChange("split")}
          >
            Split
          </button>
          <button
            type="button"
            role="tab"
            tabIndex={markdownView === "preview" ? 0 : -1}
            aria-controls="markdown-editor-panel"
            aria-selected={markdownView === "preview"}
            className={`md-view-option ${markdownView === "preview" ? "active" : ""}`}
            ref={(node) => { markdownTabs.current[2] = node; }}
            onKeyDown={onMarkdownTabKeyDown}
            onClick={() => onMarkdownViewChange("preview")}
          >
            Preview
          </button>
        </div>
      )}

      <div id={mode === "markdown" ? "markdown-editor-panel" : undefined} role={mode === "markdown" ? "tabpanel" : undefined} aria-label={mode === "markdown" ? "Markdown authoring panel" : undefined} className={mode === "markdown" && markdownView === "split" ? "md-split" : undefined}>
        {(mode !== "markdown" || markdownView !== "preview") && (
          <>
            <label htmlFor="draft-textarea" className="sr-only">
              {mode === "note" ? "Note content" : mode === "markdown" ? "Markdown content" : "Code content"}
            </label>
            {mode === "code" ? (
              <div className="code-editor-wrap">
                <textarea
                  id="draft-textarea"
                  className="composer-textarea code-editor-input"
                  placeholder="Paste code snippet…"
                  value={draft}
                  disabled={disabled}
                  wrap="off"
                  spellCheck={false}
                  onChange={(e) => onDraftChange(e.target.value)}
                />
              </div>
            ) : (
              <textarea
                id="draft-textarea"
                className="composer-textarea"
                placeholder={
                  mode === "note"
                    ? "Start typing your note here..."
                    : "Write Markdown (# heading, **bold**, - list)…"
                }
                value={draft}
                disabled={disabled}
                onChange={(e) => onDraftChange(e.target.value)}
              />
            )}
          </>
        )}
        {mode === "markdown" && markdownView !== "edit" && (
          <div className="composer-md-preview" aria-label="Markdown authoring preview">
            <MarkdownView markdown={draft} className="composer-markdown-rendered" ariaLabel="Markdown authoring preview content" />
          </div>
        )}
      </div>
    </>
  );
}

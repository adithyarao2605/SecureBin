"use client";

import { useRef, type KeyboardEvent } from "react";
import { MarkdownView } from "../markdown-view";
import type { ComposerMode } from "./mode-tabs";
import type { CodeLanguage } from "../../../lib/crypto/payload";
import { highlightCode } from "../../../lib/render/code";

export type MarkdownViewMode = "edit" | "split" | "preview";
export type CodeViewMode = "edit" | "split" | "preview";

interface EditorPaneProps {
  readonly mode: ComposerMode;
  readonly markdownView: MarkdownViewMode;
  readonly codeView: CodeViewMode;
  readonly draft: string;
  readonly disabled: boolean;
  readonly language: CodeLanguage;
  onDraftChange: (value: string) => void;
  onMarkdownViewChange: (view: MarkdownViewMode) => void;
  onCodeViewChange: (view: CodeViewMode) => void;
}

export function EditorPane({
  mode,
  markdownView,
  codeView,
  draft,
  disabled,
  language,
  onDraftChange,
  onMarkdownViewChange,
  onCodeViewChange,
}: EditorPaneProps) {
  const markdownTabs = useRef<Array<HTMLButtonElement | null>>([]);
  const codeTabs = useRef<Array<HTMLButtonElement | null>>([]);
  const markdownViews: MarkdownViewMode[] = ["edit", "split", "preview"];
  const codeViews: CodeViewMode[] = ["edit", "split", "preview"];
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

  function onCodeTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const current = codeViews.indexOf(codeView);
    const next = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? (current + 1) % codeViews.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
      ? (current + codeViews.length - 1) % codeViews.length
      : event.key === "Home"
      ? 0
      : event.key === "End"
      ? codeViews.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    onCodeViewChange(codeViews[next]);
    codeTabs.current[next]?.focus();
  }

  const lineCount = Math.max(1, draft.split("\n").length);
  const highlightedCode = highlightCode(draft, language);
  const panelId = mode === "markdown"
    ? "markdown-editor-panel"
    : mode === "code"
    ? "code-editor-panel"
    : undefined;
  const panelClassName = mode === "markdown" && markdownView === "split"
    ? "md-split"
    : mode === "code" && codeView === "split"
    ? "code-split"
    : undefined;

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

      {mode === "code" && (
        <div className="md-view-toggle code-view-toggle" role="tablist" aria-label="Code editor view">
          <button
            type="button"
            role="tab"
            tabIndex={codeView === "edit" ? 0 : -1}
            aria-controls="code-editor-panel"
            aria-selected={codeView === "edit"}
            className={`md-view-option ${codeView === "edit" ? "active" : ""}`}
            ref={(node) => { codeTabs.current[0] = node; }}
            onKeyDown={onCodeTabKeyDown}
            onClick={() => onCodeViewChange("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            tabIndex={codeView === "split" ? 0 : -1}
            aria-controls="code-editor-panel"
            aria-selected={codeView === "split"}
            className={`md-view-option split-option ${codeView === "split" ? "active" : ""}`}
            ref={(node) => { codeTabs.current[1] = node; }}
            onKeyDown={onCodeTabKeyDown}
            onClick={() => onCodeViewChange("split")}
          >
            Split
          </button>
          <button
            type="button"
            role="tab"
            tabIndex={codeView === "preview" ? 0 : -1}
            aria-controls="code-editor-panel"
            aria-selected={codeView === "preview"}
            className={`md-view-option ${codeView === "preview" ? "active" : ""}`}
            ref={(node) => { codeTabs.current[2] = node; }}
            onKeyDown={onCodeTabKeyDown}
            onClick={() => onCodeViewChange("preview")}
          >
            Preview
          </button>
        </div>
      )}

      <div id={panelId} role={panelId ? "tabpanel" : undefined} aria-label={mode === "markdown" ? "Markdown authoring panel" : mode === "code" ? "Code authoring panel" : undefined} className={panelClassName}>
        {(mode !== "markdown" || markdownView !== "preview") && (mode !== "code" || codeView !== "preview") && (
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
        {mode === "code" && codeView !== "edit" && (
          <div className="composer-code-preview" aria-label={`Code authoring preview in ${language}`}>
            <div className="composer-code-preview-header">
              <span>Live syntax preview</span>
              <code>{language}</code>
            </div>
            {draft ? (
              <div className="code-view-body composer-code-preview-body">
                <span className="code-line-numbers" aria-hidden="true">
                  {Array.from({ length: lineCount }, (_, index) => (
                    <span key={index}>{index + 1}</span>
                  ))}
                </span>
                <pre className="decrypted-code-block composer-code-preview-block">
                  <code className={`hljs language-${language}`}>{highlightedCode}</code>
                </pre>
              </div>
            ) : (
              <p className="composer-code-preview-empty">Your highlighted code preview will appear here.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

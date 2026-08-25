"use client";

import { useDeferredValue, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CodeLanguage } from "../../../lib/crypto/payload";
import { highlightCode } from "../../../lib/render/code";

interface CodeEditorProps {
  readonly draft: string;
  readonly disabled: boolean;
  readonly language: CodeLanguage;
  onDraftChange: (value: string) => void;
  onPaste: (value: string) => void;
}

export function CodeEditor({ draft, disabled, language, onDraftChange, onPaste }: CodeEditorProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const focusButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const deferredDraft = useDeferredValue(draft);
  const deferredByteLength = new TextEncoder().encode(deferredDraft).length;
  const shouldHighlight = deferredByteLength <= 128 * 1024;
  const lineCount = Math.max(1, deferredDraft.split("\n").length);
  const highlightedCode = shouldHighlight ? highlightCode(deferredDraft, language) : deferredDraft;

  function syncScroll(): void {
    const editor = editorRef.current;
    if (!editor) return;
    const offset = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
    if (highlightRef.current) highlightRef.current.style.transform = offset;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-editor.scrollTop}px)`;
  }

  useEffect(() => {
    syncScroll();
  }, [draft]);

  useEffect(() => {
    if (!isFocused) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    editorRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [isFocused]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!isFocused || event.key !== "Tab") return;
    const focusable = Array.from(
      wrapRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled])"
      ) ?? []
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Escape" && isFocused) {
      event.preventDefault();
      setIsFocused(false);
    }
  }

  return (
    <div
      ref={wrapRef}
      className={`code-editor-wrap${isFocused ? " is-focused" : ""}`}
      role={isFocused ? "dialog" : "region"}
      aria-modal={isFocused || undefined}
      aria-label={`Code editor in ${language}`}
      onKeyDown={handleDialogKeyDown}
    >
      <div className="code-editor-header">
        <span>Editable IDE preview</span>
        <code>{language}</code>
        <div className="code-editor-header-actions">
          <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
          {!shouldHighlight && <span className="code-editor-performance-note" role="status">Highlighting paused for large snippet</span>}
          <button
            ref={focusButtonRef}
            type="button"
            className="code-editor-focus-button"
            aria-pressed={isFocused}
            onClick={() => {
              if (!isFocused) {
                restoreFocusRef.current =
                  focusButtonRef.current ??
                  (document.activeElement instanceof HTMLElement ? document.activeElement : null);
              }
              setIsFocused((value) => !value);
            }}
            disabled={disabled}
          >
            {isFocused ? "Exit focus" : "Focus editor"}
          </button>
        </div>
      </div>
      <div className="code-editor-surface">
        <div className="code-editor-gutter" aria-hidden="true">
          <div ref={gutterRef} className="code-editor-gutter-content">
            {Array.from({ length: lineCount }, (_, index) => (
              <span key={index}>{index + 1}</span>
            ))}
          </div>
        </div>
        <div className="code-editor-stage">
          <pre ref={highlightRef} className="code-editor-highlight" aria-hidden="true">
            <code className={`hljs language-${language}`}>{highlightedCode || " "}</code>
          </pre>
          <label htmlFor="draft-textarea" className="sr-only">Code content</label>
          <textarea
            ref={editorRef}
            id="draft-textarea"
            className="code-editor-input"
            placeholder="Paste code snippet…"
            value={draft}
            disabled={disabled}
            wrap="off"
            spellCheck={false}
            onScroll={syncScroll}
            onPaste={(event) => onPaste(event.clipboardData.getData("text"))}
            onKeyDown={handleEditorKeyDown}
            onChange={(event) => onDraftChange(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

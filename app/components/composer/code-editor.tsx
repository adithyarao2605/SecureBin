"use client";

import { useEffect, useRef } from "react";
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
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const lineCount = Math.max(1, draft.split("\n").length);
  const highlightedCode = highlightCode(draft, language);

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

  return (
    <div className="code-editor-wrap" role="region" aria-label={`Code editor in ${language}`}>
      <div className="code-editor-header">
        <span>Editable IDE preview</span>
        <code>{language}</code>
        <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
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
            onChange={(event) => onDraftChange(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

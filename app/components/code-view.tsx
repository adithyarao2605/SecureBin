"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CodeLanguage } from "../../lib/crypto/payload";
import { highlightCode } from "../../lib/render/code";

export interface CodeViewProps {
  readonly code: string;
  readonly language: CodeLanguage;
}

const LANGUAGE_TO_EXTENSION: Record<CodeLanguage, string> = {
  plaintext: "txt",
  javascript: "js",
  typescript: "ts",
  json: "json",
  python: "py",
  bash: "sh",
  sql: "sql",
  css: "css",
  html: "html",
  java: "java",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  go: "go",
  rust: "rs",
  ruby: "rb",
  php: "php",
  kotlin: "kt",
  yaml: "yaml",
  xml: "xml",
  ini: "ini",
};

export function CodeView({ code, language }: CodeViewProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current !== null) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("failed");
    }
  }

  function handleDownload() {
    try {
      if (blobUrlRef.current !== null) URL.revokeObjectURL(blobUrlRef.current);
      const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `snippet.${LANGUAGE_TO_EXTENSION[language]}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      // Download is best-effort; the code remains visible and copyable.
    }
  }

  const highlighted = highlightCode(code, language);
  const lineCount = code.split("\n").length;

  return (
    <div className="decrypted-code-wrapper" role="region" aria-label={`Code snippet in ${language}`}>
      <div className="code-header-bar">
        <span className="code-language-tag">{language}</span>
        <div className="code-header-actions">
          <button
            type="button"
            className="code-copy-button"
            onClick={handleDownload}
            aria-label="Download code snippet"
          >
            Download
          </button>
          <button
            type="button"
            className="code-copy-button"
            onClick={handleCopy}
            aria-label="Copy code to clipboard"
          >
            {copyStatus === "copied" ? "Copied" : "Copy code"}
          </button>
        </div>
      </div>
      {copyStatus === "failed" && <p className="code-copy-fallback" role="alert">Clipboard unavailable. Select the code and copy it manually.</p>}
      <div className="code-view-body">
        <span className="code-line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </span>
        <pre className="decrypted-code-block">
          <code className={`hljs language-${language}`}>{highlighted}</code>
        </pre>
      </div>
    </div>
  );
}

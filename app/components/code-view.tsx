"use client";

import React, { useState } from "react";
import type { CodeLanguage } from "../../lib/crypto/payload";
import { highlightCode } from "../../lib/render/code";

export interface CodeViewProps {
  readonly code: string;
  readonly language: CodeLanguage;
}

export function CodeView({ code, language }: CodeViewProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      // Fallback
    }
  }

  const highlighted = highlightCode(code, language);

  return (
    <div className="decrypted-code-wrapper" role="region" aria-label={`Code snippet in ${language}`}>
      <div className="code-header-bar">
        <span className="code-language-tag">{language}</span>
        <button
          type="button"
          className="code-copy-button"
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
        >
          {copyStatus === "copied" ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre className="decrypted-code-block">
        <code className={`hljs language-${language}`}>{highlighted}</code>
      </pre>
    </div>
  );
}

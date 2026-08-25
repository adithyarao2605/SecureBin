"use client";

import { useState, type ReactNode } from "react";
import { bytesToArrayBuffer } from "../../../lib/crypto/encoding";
import { openFile, type FilePayload } from "../../../lib/crypto/file";
import type { ContentPayload } from "../../../lib/crypto/payload";
import { sanitizeFilename } from "../../../lib/render/file-safety";
import { CodeView } from "../../components/code-view";
import { FilePreview } from "../../components/file-preview";
import { MarkdownView } from "../../components/markdown-view";
import { PrivacyVeil } from "./viewer-parts/privacy-veil";

export interface DecryptedAttachment {
  readonly name: string;
  readonly payload: FilePayload;
}

type RevealedContentProps = {
  content: ContentPayload;
  attachments: DecryptedAttachment[];
  children?: ReactNode;
};

export function RevealedContent({ content, attachments, children }: RevealedContentProps) {
  const [zipPending, setZipPending] = useState(false);
  const [zipError, setZipError] = useState("");
  const [textCopyStatus, setTextCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function handleDownloadAll() {
    if (zipPending || attachments.length === 0) return;
    setZipPending(true);
    setZipError("");
    try {
      const { zip } = await import("fflate");
      const entries: Record<string, Uint8Array> = {};
      for (const attachment of attachments) {
        const base = sanitizeFilename(attachment.payload.filename);
        let name = base;
        let suffix = 2;
        while (name in entries) {
          name = `${base}-${suffix}`;
          suffix += 1;
        }
        entries[name] = attachment.payload.data;
      }
      const archive = await new Promise<Uint8Array>((resolve, reject) => {
        zip(entries, (error, data) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(data);
        });
      });
      const blob = new Blob([bytesToArrayBuffer(archive)], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "securebin-files.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setZipError("The ZIP could not be prepared locally. Download the files individually instead.");
    } finally {
      setZipPending(false);
    }
  }

  async function handleCopyText() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(content.text);
      setTextCopyStatus("copied");
      window.setTimeout(() => setTextCopyStatus("idle"), 2000);
    } catch {
      setTextCopyStatus("failed");
    }
  }

  function handleDownloadText() {
    const extension = content.mode === "markdown" ? "md" : "txt";
    const blob = new Blob([content.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `securebin-note.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const textActions = content.mode === "note" || content.mode === "markdown"
    ? (
      <div className="text-content-actions" aria-label="Decrypted text actions">
        <button type="button" className="code-copy-button" onClick={() => void handleCopyText()}>
          {textCopyStatus === "copied" ? "Copied" : "Copy text"}
        </button>
        <button type="button" className="code-copy-button" onClick={handleDownloadText}>
          Download {content.mode === "markdown" ? ".md" : ".txt"}
        </button>
      </div>
    )
    : null;

  return (
    <div className="viewer-opened-box">
      <p className="viewer-success-note">
        Opened locally. The server released ciphertext; this browser did the decryption.
      </p>

      <PrivacyVeil>
        {content.text && (
          <div className="decrypted-content-container">
            {content.mode === "note" && (
              <div className="decrypted-text-wrapper">
                <div className="text-content-header">{textActions}</div>
                {textCopyStatus === "failed" && <p className="code-copy-fallback" role="alert">Clipboard unavailable. Select the text and copy it manually.</p>}
                <article className="decrypted-content-box" aria-label="Decrypted note">
                  <pre className="decrypted-text">{content.text}</pre>
                </article>
              </div>
            )}

            {content.mode === "markdown" && (
              <div className="decrypted-text-wrapper">
                <div className="text-content-header">{textActions}</div>
                {textCopyStatus === "failed" && <p className="code-copy-fallback" role="alert">Clipboard unavailable. Select the text and copy it manually.</p>}
                <MarkdownView markdown={content.text} />
              </div>
            )}

            {content.mode === "code" && <CodeView code={content.text} language={content.language} />}
          </div>
        )}

        {attachments.length > 1 && (
          <button
            type="button"
            className="action-button secondary-button download-all-button"
            disabled={zipPending}
            onClick={() => void handleDownloadAll()}
          >
            {zipPending ? "Preparing ZIP…" : "Download all (ZIP)"}
          </button>
        )}
        {zipError && <p className="code-copy-fallback" role="alert">{zipError}</p>}

        {attachments.map((attachment, index) => (
          <FilePreview key={`${attachment.name}-${index}`} file={attachment.payload} />
        ))}
      </PrivacyVeil>

      {children}
    </div>
  );
}

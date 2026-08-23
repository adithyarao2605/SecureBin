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

  async function handleDownloadAll() {
    if (zipPending || attachments.length === 0) return;
    setZipPending(true);
    try {
      const { zipSync } = await import("fflate");
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
      const blob = new Blob([bytesToArrayBuffer(zipSync(entries))], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "securebin-files.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setZipPending(false);
    }
  }

  return (
    <div className="viewer-opened-box">
      <p className="viewer-success-note">
        Opened locally. The server released ciphertext; this browser did the decryption.
      </p>

      <PrivacyVeil>
        {content.text && (
          <div className="decrypted-content-container">
            {content.mode === "note" && (
              <article className="decrypted-content-box" aria-label="Decrypted note">
                <pre className="decrypted-text">{content.text}</pre>
              </article>
            )}

            {content.mode === "markdown" && <MarkdownView markdown={content.text} />}

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

        {attachments.map((attachment, index) => (
          <FilePreview key={`${attachment.name}-${index}`} file={attachment.payload} />
        ))}
      </PrivacyVeil>

      {children}
    </div>
  );
}

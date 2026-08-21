"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bytesToArrayBuffer } from "../../lib/crypto/encoding";
import type { FilePayload } from "../../lib/crypto/file";
import { inspectFileForPreview, sanitizeFilename } from "../../lib/render/file-safety";

export interface FilePreviewProps {
  readonly file: FilePayload;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilePreview({ file }: FilePreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const sanitizedName = useMemo(() => sanitizeFilename(file.filename), [file.filename]);
  const previewKind = useMemo(() => inspectFileForPreview(file.data), [file.data]);

  useEffect(() => {
    let mime = "application/octet-stream";
    if (previewKind.type === "image") {
      mime = previewKind.mimeType;
    } else if (previewKind.type === "text") {
      mime = "text/plain;charset=utf-8";
    }

    const blob = new Blob([bytesToArrayBuffer(file.data)], { type: mime });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file.data, previewKind]);

  return (
    <section className="decrypted-attachment-card" aria-label="Decrypted file attachment">
      <div className="attachment-header">
        <h3 className="attachment-title">
          📎 {sanitizedName} <span className="attachment-size">({formatBytes(file.data.length)})</span>
        </h3>
      </div>

      <div className="attachment-body">
        {previewKind.type === "image" && blobUrl && (
          <div className="attachment-image-wrapper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={blobUrl}
              alt={sanitizedName}
              className="attachment-image-preview"
            />
          </div>
        )}

        {previewKind.type === "text" && (
          <div className="attachment-text-wrapper">
            <pre className="attachment-text-preview">{previewKind.text}</pre>
          </div>
        )}

        {previewKind.type === "download_only" && (
          <div className="attachment-download-only-wrapper">
            <p className="attachment-download-hint">
              This file format is not previewed inline for security. Download it to view on your device.
            </p>
          </div>
        )}
      </div>

      <div className="attachment-actions">
        {blobUrl && (
          <a
            href={blobUrl}
            download={sanitizedName}
            className="action-button secondary-button download-attachment-btn"
          >
            Download {sanitizedName}
          </a>
        )}
      </div>
    </section>
  );
}

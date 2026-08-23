"use client";

import { useState, type ChangeEvent, type RefObject } from "react";
import { MAX_FILE_PLAINTEXT_BYTES } from "../../../lib/crypto/file";
import { formatBytes } from "./format";

interface AttachmentZoneProps {
  readonly files: readonly File[];
  readonly disabled: boolean;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFilesDropped: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
}

export function AttachmentZone({
  files,
  disabled,
  inputRef,
  onInputChange,
  onFilesDropped,
  onRemoveFile,
}: AttachmentZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`file-attachment-section${dragOver ? " drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = Array.from(e.dataTransfer.files);
        if (dropped.length === 0) return;
        onFilesDropped(dropped);
      }}
    >
      <label htmlFor="file-attachment-input" className="sr-only">
        Attach file (max 10 MB)
      </label>
      <p className="file-drop-hint">Drag files here or use the button below</p>
      {files.length === 0 && (
        <button
          type="button"
          className="action-button secondary-button attach-file-btn"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Attach files (max 10 MB each, up to 5)
        </button>
      )}
      {files.map((file, index) => (
        <div key={`${file.name}-${index}`} className="attached-file-badge" role="status">
          <span className="file-info-text">
            📎 <strong>{file.name}</strong> ({formatBytes(file.size)})
          </span>
          <button
            type="button"
            className="remove-file-button"
            disabled={disabled}
            onClick={() => onRemoveFile(index)}
            aria-label={`Remove ${file.name}`}
          >
            ✕ Remove
          </button>
        </div>
      ))}
      <input
        type="file"
        ref={inputRef}
        id="file-attachment-input"
        aria-label="Attach files (max 10 MB each, up to 5)"
        className="sr-only"
        disabled={disabled}
        onChange={onInputChange}
        multiple
      />
    </div>
  );
}

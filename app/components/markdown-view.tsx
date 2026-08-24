"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ALLOWED_MARKDOWN_ELEMENTS, safeUrlTransform } from "../../lib/render/markdown";

export interface MarkdownViewProps {
  readonly markdown: string;
  /** Authoring preview uses a flat surface so it does not look nested. */
  readonly className?: string;
  readonly ariaLabel?: string;
}

export function MarkdownView({ markdown, className = "decrypted-markdown-content", ariaLabel = "Decrypted Markdown" }: MarkdownViewProps) {
  return (
    <article className={className} aria-label={ariaLabel}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml={true}
        allowedElements={[...ALLOWED_MARKDOWN_ELEMENTS]}
        urlTransform={safeUrlTransform}
        components={{
          // Drop all images to prevent tracking and remote fetches on secret routes
          img: () => null,
          // Ensure links open in new tab securely with noopener noreferrer
          a: ({ href, children, ...props }) => {
            const safeHref = href ? safeUrlTransform(href) : "";
            if (!safeHref) {
              return <span>{children}</span>;
            }
            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="markdown-link"
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}

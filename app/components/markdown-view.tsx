"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ALLOWED_MARKDOWN_ELEMENTS, safeUrlTransform } from "../../lib/render/markdown";

export interface MarkdownViewProps {
  readonly markdown: string;
}

export function MarkdownView({ markdown }: MarkdownViewProps) {
  return (
    <article className="decrypted-markdown-content" aria-label="Decrypted Markdown">
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

import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MarkdownView } from "../../app/components/markdown-view";
import { CodeView } from "../../app/components/code-view";
import { safeUrlTransform } from "../../lib/render/markdown";
import { highlightCode } from "../../lib/render/code";
import { detectCodeLanguage } from "../../lib/render/detect-language";

describe("Safe Markdown & Code Rendering (Day 3)", () => {
  describe("Safe URL Transformation", () => {
    it("allows valid https, http, and mailto URLs", () => {
      expect(safeUrlTransform("https://example.com")).toBe("https://example.com");
      expect(safeUrlTransform("http://example.com/test")).toBe("http://example.com/test");
      expect(safeUrlTransform("mailto:user@example.com")).toBe("mailto:user@example.com");
      expect(safeUrlTransform("#section-1")).toBe("#section-1");
      expect(safeUrlTransform("/local/path")).toBe("/local/path");
    });

    it("rejects dangerous or malformed protocols", () => {
      expect(safeUrlTransform("javascript:alert(1)")).toBe("");
      expect(safeUrlTransform("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBe("");
      expect(safeUrlTransform("vbscript:msgbox(1)")).toBe("");
      expect(safeUrlTransform("//evil.com")).toBe("");
      expect(safeUrlTransform("file:///etc/passwd")).toBe("");
      expect(safeUrlTransform("")).toBe("");
    });
  });

  describe("MarkdownView Component", () => {
    it("renders safe markdown elements without executing HTML", () => {
      const markdown = "# Title\n\n**Bold text** and *italic*.\n\n[Safe link](https://example.com)";
      const { container } = render(<MarkdownView markdown={markdown} />);

      expect(screen.getByRole("heading", { level: 1, name: "Title" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Safe link" })).toHaveAttribute(
        "href",
        "https://example.com"
      );
      expect(screen.getByRole("link", { name: "Safe link" })).toHaveAttribute(
        "rel",
        "noopener noreferrer"
      );
      expect(container.querySelector("strong")?.textContent).toBe("Bold text");
    });

    it("strips images completely to prevent remote network requests", () => {
      const markdown = "Here is an image: ![Alt text](https://tracker.com/pixel.png)";
      const { container } = render(<MarkdownView markdown={markdown} />);

      expect(container.querySelector("img")).toBeNull();
      expect(screen.queryByAltText("Alt text")).not.toBeInTheDocument();
    });

    it("neutralizes XSS payloads and script tags", () => {
      const xssMarkdown = `
<script>alert('xss')</script>
<img src="x" onerror="alert('xss')" />
<svg onload="alert('xss')"><circle r="50"/></svg>
[Dangerous link](javascript:alert('xss'))
`;
      const { container } = render(<MarkdownView markdown={xssMarkdown} />);

      expect(container.querySelector("script")).toBeNull();
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("svg")).toBeNull();
      expect(container.querySelector("a[href^='javascript:']")).toBeNull();
    });
  });

  describe("CodeView Component & Syntax Highlighting", () => {
    it("renders syntax-highlighted code for supported languages", () => {
      const code = "const secret: string = 'key';";
      render(<CodeView code={code} language="typescript" />);

      expect(screen.getByText("typescript")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /copy code/i })).toBeInTheDocument();
      const codeElement = screen.getByText("typescript").closest(".decrypted-code-wrapper");
      expect(codeElement).toBeInTheDocument();
    });

    it("highlights code using safe span elements with hljs classes", () => {
      const code = "SELECT * FROM users WHERE active = true;";
      const rendered = highlightCode(code, "sql");

      expect(rendered).toBeDefined();
      const { container } = render(<div>{rendered}</div>);
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBeGreaterThan(0);
      spans.forEach((span) => {
        expect(span.className).toMatch(/^hljs-[a-z0-9_-]+$/);
      });
    });

    it("falls back to plain text for plaintext mode", () => {
      const code = "Plain text log output";
      const rendered = highlightCode(code, "plaintext");
      expect(rendered).toBe(code);
    });
  });

  describe("Code language detection & code view extras", () => {
    it("detects JSON objects and arrays", () => {
      expect(detectCodeLanguage('{"key": "value"}')).toBe("json");
      expect(detectCodeLanguage("\n  [1, 2, 3]")).toBe("json");
    });

    it("detects HTML documents and tag pairs", () => {
      expect(detectCodeLanguage("<!doctype html><html><body></body></html>")).toBe("html");
      expect(detectCodeLanguage("<div>hello</div>")).toBe("html");
    });

    it("detects CSS rules with declaration blocks", () => {
      expect(detectCodeLanguage(".card { color: red; border: none; }")).toBe("css");
      expect(detectCodeLanguage("#main { margin: 0 auto; }")).toBe("css");
    });

    it("detects Python by def/import/print", () => {
      expect(detectCodeLanguage("def greet(name):\n    return name")).toBe("python");
      expect(detectCodeLanguage("import os\nprint(os.getcwd())")).toBe("python");
    });

    it("detects Bash by shebang or common commands", () => {
      expect(detectCodeLanguage("#!/bin/bash\necho hello")).toBe("bash");
      expect(detectCodeLanguage("sudo apt update")).toBe("bash");
    });

    it("detects SQL keywords case-insensitively", () => {
      expect(detectCodeLanguage("select * from users;")).toBe("sql");
      expect(detectCodeLanguage("INSERT INTO users (id) VALUES (1);")).toBe("sql");
      expect(detectCodeLanguage("CREATE TABLE notes (id int);")).toBe("sql");
    });

    it("detects TypeScript annotations and declarations", () => {
      expect(detectCodeLanguage("const count: number = 1;")).toBe("typescript");
      expect(detectCodeLanguage("interface User { id: string }")).toBe("typescript");
      expect(detectCodeLanguage("type Alias = string;")).toBe("typescript");
      expect(detectCodeLanguage('import type { Foo } from "./foo";')).toBe("typescript");
    });

    it("defaults brace or keyword snippets to JavaScript", () => {
      expect(detectCodeLanguage("const add = function (a, b) { return a + b; };")).toBe("javascript");
      expect(detectCodeLanguage("let x = 1;")).toBe("javascript");
    });

    it("falls back to plaintext for unknown content", () => {
      expect(detectCodeLanguage("just a plain sentence about nothing")).toBe("plaintext");
      expect(detectCodeLanguage("")).toBe("plaintext");
    });

    it("renders a line-number gutter matching the newline count", () => {
      const { container } = render(<CodeView code={"line one\nline two\nline three"} language="javascript" />);
      const numbers = container.querySelectorAll(".code-line-numbers span");
      expect(numbers).toHaveLength(3);
      expect(numbers[0].textContent).toBe("1");
      expect(numbers[2].textContent).toBe("3");
    });

    it("offers a Download button that saves a blob under the mapped extension", () => {
      const createObjectURL = vi.fn(() => "blob:mock-url");
      const revokeObjectURL = vi.fn();
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
      Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
      Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });

      render(<CodeView code="SELECT 1;" language="sql" />);
      const downloadButton = screen.getByRole("button", { name: /download code snippet/i });
      downloadButton.click();

      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(downloadButton).toBeInTheDocument();
      click.mockRestore();
    });
  });
});

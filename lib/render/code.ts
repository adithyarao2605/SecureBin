import React, { type ReactNode } from "react";
import { common, createLowlight } from "lowlight";
import type { CodeLanguage } from "../crypto/payload";

// Keep this registry explicit: payload language IDs are a deployed contract.
const lowlight = createLowlight();
lowlight.register("javascript", common.javascript);
lowlight.register("typescript", common.typescript);
lowlight.register("json", common.json);
lowlight.register("python", common.python);
lowlight.register("bash", common.bash);
lowlight.register("sql", common.sql);
lowlight.register("css", common.css);
lowlight.register("html", common.xml); // html syntax is handled by xml in highlight.js
lowlight.register("java", common.java);
lowlight.register("c", common.c);
lowlight.register("cpp", common.cpp);
lowlight.register("csharp", common.csharp);
lowlight.register("go", common.go);
lowlight.register("rust", common.rust);
lowlight.register("ruby", common.ruby);
lowlight.register("php", common.php);
lowlight.register("kotlin", common.kotlin);
lowlight.register("yaml", common.yaml);
lowlight.register("xml", common.xml);
lowlight.register("ini", common.ini);

const HLJS_CLASS_PATTERN = /^hljs-[a-z0-9_-]+$/;

interface HastText {
  type: "text";
  value: string;
}

interface HastElement {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children: (HastElement | HastText)[];
}

interface HastRoot {
  type: "root";
  children: (HastElement | HastText)[];
}

type HastNode = HastRoot | HastElement | HastText;

function convertHastNodeToReact(node: HastNode, keyPrefix: string): ReactNode {
  if (node.type === "text") {
    return node.value;
  }

  if (node.type === "element") {
    // Only 'span' elements are allowed
    if (node.tagName !== "span") {
      return fallbackToText(node);
    }

    const properties = node.properties || {};
    const propKeys = Object.keys(properties);

    // Only 'className' is allowed in properties
    if (propKeys.length > 1 || (propKeys.length === 1 && propKeys[0] !== "className")) {
      return fallbackToText(node);
    }

    let classNames: string[] = [];
    if (properties.className) {
      if (Array.isArray(properties.className)) {
        classNames = properties.className.filter(
          (c): c is string => typeof c === "string" && HLJS_CLASS_PATTERN.test(c)
        );
        if (classNames.length !== properties.className.length) {
          return fallbackToText(node);
        }
      } else if (
        typeof properties.className === "string" &&
        HLJS_CLASS_PATTERN.test(properties.className)
      ) {
        classNames = [properties.className];
      } else {
        return fallbackToText(node);
      }
    }

    const children = node.children.map((child, index) =>
      convertHastNodeToReact(child, `${keyPrefix}-${index}`)
    );

    return React.createElement(
      "span",
      { key: keyPrefix, className: classNames.join(" ") },
      ...children
    );
  }

  if (node.type === "root") {
    return node.children.map((child, index) =>
      convertHastNodeToReact(child, `${keyPrefix}-${index}`)
    );
  }

  return null;
}

function fallbackToText(node: HastNode): string {
  if (node.type === "text") return node.value;
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map(fallbackToText).join("");
  }
  return "";
}

export function highlightCode(code: string, language: CodeLanguage): ReactNode {
  if (language === "plaintext" || !lowlight.registered(language)) {
    return code;
  }

  try {
    const tree = lowlight.highlight(language, code);
    return convertHastNodeToReact(tree as unknown as HastRoot, "hljs-root");
  } catch {
    // Fallback to plain text on any highlighter error
    return code;
  }
}

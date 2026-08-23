import type { CodeLanguage } from "../crypto/payload";

export function detectCodeLanguage(code: string): CodeLanguage {
  const trimmed = code.trimStart();
  if (!trimmed) return "plaintext";

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(code);
      return "json";
    } catch {
      // Not valid JSON; keep checking other languages.
    }
  }

  const lower = trimmed.toLowerCase();

  if (
    lower.startsWith("<!doctype html") ||
    lower.startsWith("<html") ||
    /<([a-z][a-z0-9]*)\b[^>]*>[^<]*<\/\1>/i.test(trimmed)
  ) {
    return "html";
  }

  if (/^[^{};]{0,120}\{[^{}]*[a-z-]+\s*:\s*[^{};]+;[^{}]*\}/i.test(trimmed)) {
    return "css";
  }

  if (/^\s*(def |from \w+ import |import (?!type\b)\w|print\()/m.test(trimmed)) {
    return "python";
  }

  if (lower.startsWith("#!") || /^\s*(echo |sudo )/m.test(trimmed)) {
    return "bash";
  }

  if (/^\s*(select\s|insert\s+into\s|create\s+table\s)/im.test(trimmed)) {
    return "sql";
  }

  if (
    /:\s*(string|number|boolean|void|null|undefined|unknown|any)\b/.test(trimmed) ||
    /^\s*interface\s+\w/m.test(trimmed) ||
    /^\s*type\s+\w+\s*=/m.test(trimmed) ||
    /^import\s+type\s/m.test(trimmed) ||
    /^import\s*\{[^}]*\btype\b[^}]*\}\s*from/m.test(trimmed)
  ) {
    return "typescript";
  }

  if (
    /\b(function|const|let|var|import|export)\b/.test(lower) ||
    trimmed.includes("{")
  ) {
    return "javascript";
  }

  return "plaintext";
}

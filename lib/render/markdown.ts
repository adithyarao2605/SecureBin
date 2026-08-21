export const ALLOWED_MARKDOWN_ELEMENTS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "em",
  "strong",
  "del",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
] as const;

export const SAFE_URL_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

export function safeUrlTransform(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Relative links and fragment hashes within the page are allowed if safe
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) return ""; // Protocol-relative URLs could be unsafe
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (SAFE_URL_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
      return trimmed;
    }
  } catch {
    // Malformed URL
    return "";
  }

  return "";
}

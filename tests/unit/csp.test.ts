import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "../../middleware";

describe("request nonce CSP", () => {
  it("allows only the request nonce and local sources in production", () => {
    const policy = buildContentSecurityPolicy("bm9uY2U=", false);
    expect(policy).toContain("script-src 'self' 'nonce-bm9uY2U=' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'nonce-bm9uY2U='");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("keeps the Next development escape hatch development-only", () => {
    const policy = buildContentSecurityPolicy("bm9uY2U=", true);
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });
});

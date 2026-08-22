import { afterEach, describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "../../middleware";

describe("request nonce CSP", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServerUrl = process.env.SUPABASE_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalServerUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalServerUrl;
  });

  it("allows only the request nonce and local sources in production", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    const policy = buildContentSecurityPolicy("bm9uY2U=", false);
    expect(policy).toContain("script-src 'self' 'nonce-bm9uY2U=' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'nonce-bm9uY2U='");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain("supabase.co");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("permits the configured Supabase storage origin for signed upload and download", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db-muxxcejnohhrcgdmdnmh.supabase.co";
    const policy = buildContentSecurityPolicy("bm9uY2U=", false);
    expect(policy).toContain(
      "connect-src 'self' https://db-muxxcejnohhrcgdmdnmh.supabase.co"
    );
  });

  it("falls back to the server-side Supabase URL for the connect source", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    const policy = buildContentSecurityPolicy("bm9uY2U=", false);
    expect(policy).toContain("connect-src 'self' http://127.0.0.1:54321");
  });

  it("ignores malformed Supabase URLs instead of weakening connect-src", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    const policy = buildContentSecurityPolicy("bm9uY2U=", false);
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("connect-src 'self';");
  });

  it("keeps the Next development escape hatch development-only", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    const policy = buildContentSecurityPolicy("bm9uY2U=", true);
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });
});

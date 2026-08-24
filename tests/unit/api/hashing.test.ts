import { describe, expect, it } from "vitest";

import { hmacBase64Url, networkDiscriminator } from "@/lib/server/hashing";

describe("network rate-limit discriminator", () => {
  it("trusts the platform-overwritten Vercel address only when configured", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-vercel-forwarded-for": "198.51.100.10",
        "x-forwarded-for": "203.0.113.20, 203.0.113.21",
        "x-real-ip": "192.0.2.30",
      },
    });
    const discriminator = networkDiscriminator(request, "test-hmac-key", "vercel");
    expect(discriminator).toBe(hmacBase64Url("test-hmac-key", "securebin/network/v1/198.51.100.10"));
    expect(discriminator).not.toContain("198.51.100.10");
    expect(discriminator).not.toContain("203.0.113.20");
  });

  it("uses the first trusted reverse-proxy address only when configured", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.20, 203.0.113.21" },
    });
    expect(networkDiscriminator(request, "test-hmac-key", "forwarded")).toBe(
      hmacBase64Url("test-hmac-key", "securebin/network/v1/203.0.113.20"),
    );
  });

  it("ignores spoofed forwarding headers in direct self-hosted mode", () => {
    const spoofed = new Request("http://localhost", {
      headers: {
        "x-vercel-forwarded-for": "198.51.100.10",
        "x-forwarded-for": "203.0.113.20",
        "x-real-ip": "192.0.2.30",
      },
    });
    const clean = new Request("http://localhost");
    expect(networkDiscriminator(spoofed, "test-hmac-key")).toBe(networkDiscriminator(clean, "test-hmac-key"));
    expect(networkDiscriminator(spoofed, "test-hmac-key")).toBe(
      hmacBase64Url("test-hmac-key", "securebin/network/v1/anonymous"),
    );
  });
});

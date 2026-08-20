import { describe, expect, it } from "vitest";

import { hmacBase64Url, networkDiscriminator } from "@/lib/server/hashing";

describe("network rate-limit discriminator", () => {
  it("trusts the platform-overwritten Vercel address header first", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-vercel-forwarded-for": "198.51.100.10",
        "x-forwarded-for": "203.0.113.20, 203.0.113.21",
        "x-real-ip": "192.0.2.30",
      },
    });
    const discriminator = networkDiscriminator(request, "test-hmac-key");
    expect(discriminator).toBe(hmacBase64Url("test-hmac-key", "securebin/network/v1/198.51.100.10"));
    expect(discriminator).not.toContain("198.51.100.10");
    expect(discriminator).not.toContain("203.0.113.20");
  });

  it("uses the first local proxy address only when the platform header is absent", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.20, 203.0.113.21" },
    });
    expect(networkDiscriminator(request, "test-hmac-key")).toBe(
      hmacBase64Url("test-hmac-key", "securebin/network/v1/203.0.113.20"),
    );
  });
});

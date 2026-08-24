import { createHash, createHmac } from "node:crypto";
import type { ProxyTrust } from "./config";

export function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

export function hmacBase64Url(key: string, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("base64url");
}

/**
 * HMAC the request discriminator before it reaches the rate-limit RPC. The
 * raw address is never returned, persisted, or included in error details.
 */
export function networkDiscriminator(
  request: Request,
  hmacKey: string,
  proxyTrust: ProxyTrust = "none"
): string {
  // Forwarding headers are attacker-controlled unless the deployment has
  // explicitly configured an infrastructure boundary that overwrites them.
  // Direct/self-hosted mode deliberately puts every request in one safe
  // bucket instead of allowing a client to spoof a rate-limit identity.
  let address = "anonymous";
  if (proxyTrust === "vercel") {
    address = request.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0]?.trim() || "anonymous";
  } else if (proxyTrust === "forwarded") {
    address =
      request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "anonymous";
  }
  return hmacBase64Url(hmacKey, `securebin/network/v1/${address}`);
}

import { createHash, createHmac } from "node:crypto";

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
export function networkDiscriminator(request: Request, hmacKey: string): string {
  // Vercel overwrites this platform header at the edge. Client-supplied
  // forwarding headers are only fallbacks for local/proxy deployments.
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const address = vercelForwarded?.split(",", 1)[0]?.trim() || forwarded?.split(",", 1)[0]?.trim() || realIp?.trim() || "anonymous";
  return hmacBase64Url(hmacKey, `securebin/network/v1/${address}`);
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * The browser uploads ciphertext to and downloads attachments from Supabase
 * Storage via short-lived signed URLs, so that exact origin must be reachable
 * from page JavaScript. No other cross-origin connection is permitted.
 */
function storageConnectSource(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!supabaseUrl) return "";
  try {
    const origin = new URL(supabaseUrl).origin;
    return origin === "null" ? "" : ` ${origin}`;
  } catch {
    return "";
  }
}

export function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
  const scriptDevelopmentDirective = isDevelopment ? " 'unsafe-eval'" : "";
  const styleDevelopmentDirective = isDevelopment ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`;
  const upgradeDirective = isDevelopment ? "" : "; upgrade-insecure-requests";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${scriptDevelopmentDirective}`,
    `style-src 'self'${styleDevelopmentDirective}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${storageConnectSource()}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ") + upgradeDirective;
}

function createNonce(): string {
  return btoa(crypto.randomUUID());
}

export function middleware(request: NextRequest) {
  const nonce = createNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
};

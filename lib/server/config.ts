export interface ServerConfig {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
  readonly rateLimitHmacKey: string;
  readonly cronSecret: string;
  /** Which infrastructure is authorized to overwrite client forwarding headers. */
  readonly proxyTrust: "none" | "vercel" | "forwarded";
}

export type ProxyTrust = ServerConfig["proxyTrust"];

export function readServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const rateLimitHmacKey = env.RATE_LIMIT_HMAC_KEY;
  const cronSecret = env.CRON_SECRET;
  const configuredProxyTrust = env.SECUREBIN_PROXY_TRUST ?? (env.VERCEL === "1" ? "vercel" : "none");
  if (configuredProxyTrust !== "none" && configuredProxyTrust !== "vercel" && configuredProxyTrust !== "forwarded") {
    throw new Error("SECUREBIN_PROXY_TRUST must be none, vercel, or forwarded");
  }
  if (!supabaseUrl || !serviceRoleKey || !rateLimitHmacKey || !cronSecret) {
    throw new Error("SecureBin server configuration is incomplete");
  }
  return { supabaseUrl, serviceRoleKey, rateLimitHmacKey, cronSecret, proxyTrust: configuredProxyTrust };
}

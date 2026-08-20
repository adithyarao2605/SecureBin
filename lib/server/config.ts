export interface ServerConfig {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
  readonly rateLimitHmacKey: string;
}

export function readServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const rateLimitHmacKey = env.RATE_LIMIT_HMAC_KEY;
  if (!supabaseUrl || !serviceRoleKey || !rateLimitHmacKey) {
    throw new Error("SecureBin server configuration is incomplete");
  }
  return { supabaseUrl, serviceRoleKey, rateLimitHmacKey };
}

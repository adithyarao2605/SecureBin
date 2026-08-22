import "@testing-library/jest-dom/vitest";

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key-test-service-role-key";
process.env.RATE_LIMIT_HMAC_KEY = process.env.RATE_LIMIT_HMAC_KEY ?? "test-rate-limit-hmac-key-test-rate-limit-hmac-key";
process.env.CRON_SECRET = process.env.CRON_SECRET ?? "test-cron-secret-test-cron-secret";


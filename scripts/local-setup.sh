#!/usr/bin/env bash
# Prepare an isolated, loopback-only production-shaped local SecureBin runtime.
set -euo pipefail

cd "$(dirname "$0")/.."
fail() { echo "local:setup ✗ $*" >&2; exit 1; }

command -v node >/dev/null || fail "Node.js is required."
command -v pnpm >/dev/null || fail "pnpm is required through Corepack."
docker info >/dev/null 2>&1 || fail "Docker must be running."
[[ "$(node --version)" == "v$(tr -d '\r\n' < .nvmrc)" ]] || fail "use the exact Node version in .nvmrc"
[[ -x .venv/bin/python ]] || fail "create the repository-local .venv first"

runtime_dir=".securebin-local"
runtime_env="$runtime_dir/runtime.env"
install -d -m 700 "$runtime_dir"
umask 077

pnpm install --frozen-lockfile
pnpm exec supabase start >/dev/null
pnpm exec supabase db reset >/dev/null

service_key="$(pnpm exec supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY="\{0,1\}\([^"[:space:]]*\)"\{0,1\}$/\1/p')"
[[ -n "$service_key" ]] || fail "could not read the local service role key"
hmac_key="$(openssl rand -hex 32)"
cron_secret="$(openssl rand -hex 24)"

printf '%s\n' \
  'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321' \
  "SUPABASE_SERVICE_ROLE_KEY=$service_key" \
  "RATE_LIMIT_HMAC_KEY=$hmac_key" \
  "CRON_SECRET=$cron_secret" > "$runtime_env"
chmod 600 "$runtime_env"

.venv/bin/python scripts/verify-reproducibility.py
echo "local:setup ✓ isolated runtime ready; next: pnpm local"

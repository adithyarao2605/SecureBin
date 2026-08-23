#!/usr/bin/env bash
# SecureBin one-command self-host: setup (Day 6 §4).
# Prepares .env.local, starts the local Supabase stack, applies migrations.
set -euo pipefail

cd "$(dirname "$0")/.."

fail() { echo "local:setup ✗ $*" >&2; exit 1; }

command -v node >/dev/null || fail "Node.js is required (see .nvmrc for the pinned version)."
command -v pnpm >/dev/null || fail "pnpm is required (Corepack: corepack enable && corepack install)."
command -v supabase >/dev/null || fail "Supabase CLI is required (https://supabase.com/docs/guides/local-cli)."
docker info >/dev/null 2>&1 || fail "Docker must be running for the local Supabase stack."

if [[ ! -f pnpm-lock.yaml ]]; then fail "run from a repository checkout"; fi
pnpm install --frozen-lockfile

LOCAL_URL="http://127.0.0.1:54321"
if [[ ! -f .env.local ]]; then
  echo "local:setup writing .env.local (secrets generated locally; never commit it)"
  HMAC_KEY="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  CRON="$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=${LOCAL_URL}
SUPABASE_SERVICE_ROLE_KEY=replace-me-after-supabase-start
RATE_LIMIT_HMAC_KEY=${HMAC_KEY}
CRON_SECRET=${CRON}
EOF
else
  echo "local:setup keeping existing .env.local"
fi

echo "local:setup starting Supabase stack (first run pulls images)…"
supabase start >/dev/null
supabase db reset >/dev/null

SERVICE_KEY="$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | tr -d '"' | cut -d= -f2-)"
[[ -n "$SERVICE_KEY" ]] || fail "could not read SERVICE_ROLE_KEY from supabase status"

python3 - "$SERVICE_KEY" <<'PY'
import pathlib, re, sys
key = sys.argv[1]
path = pathlib.Path(".env.local")
text = path.read_text(encoding="utf-8")
text = re.sub(r"(?m)^SUPABASE_SERVICE_ROLE_KEY=.*$", f"SUPABASE_SERVICE_ROLE_KEY={key}", text)
path.write_text(text, encoding="utf-8")
PY

echo "local:setup ✓ migrations applied, secrets written to .env.local"
echo "            next: pnpm local  (app on http://127.0.0.1:3101)"

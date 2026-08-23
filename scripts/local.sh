#!/usr/bin/env bash
# SecureBin one-command self-host: run.
# Ensures the local stack is up, then serves the app on http://127.0.0.1:3101.
set -euo pipefail

cd "$(dirname "$0")/.."

[[ -f .env.local ]] || { echo "local: run scripts/local-setup.sh first" >&2; exit 1; }

if ! supabase status >/dev/null 2>&1; then
  echo "local: starting Supabase stack…"
  supabase start >/dev/null
fi

echo "local: serving on http://127.0.0.1:3101 (Ctrl+C stops the web server)"
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101

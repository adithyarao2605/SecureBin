#!/usr/bin/env bash
# Build and run SecureBin on loopback using only its isolated local environment.
set -euo pipefail

cd "$(dirname "$0")/.."
runtime_env=".securebin-local/runtime.env"
pid_file=".securebin-local/web.pid"
[[ -f "$runtime_env" ]] || { echo "local: run pnpm local:setup first" >&2; exit 1; }
[[ "$(stat -c '%a' "$runtime_env")" == "600" ]] || { echo "local: runtime.env must have mode 600" >&2; exit 1; }
grep -qx 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321' "$runtime_env" || { echo "local: only loopback Supabase is allowed" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$runtime_env"
set +a

pnpm exec supabase status >/dev/null 2>&1 || pnpm exec supabase start >/dev/null
pnpm build
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3101 &
web_pid=$!
printf '%s\n' "$web_pid" > "$pid_file"
chmod 600 "$pid_file"
cleanup() { if kill -0 "$web_pid" 2>/dev/null; then kill "$web_pid"; wait "$web_pid" 2>/dev/null || true; fi; rm -f "$pid_file"; }
trap cleanup EXIT INT TERM
echo "local: serving production build at http://127.0.0.1:3101"
wait "$web_pid"

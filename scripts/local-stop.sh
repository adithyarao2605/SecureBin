#!/usr/bin/env bash
# SecureBin one-command self-host: stop.
# Stops any web server this tooling started on :3101 and the Supabase stack.
set -euo pipefail

cd "$(dirname "$0")/.."

if fuser -k 3101/tcp >/dev/null 2>&1; then
  echo "local:stop stopped the web server on :3101"
fi

supabase stop >/dev/null 2>&1 && echo "local:stop stopped the Supabase stack" ||
  echo "local:stop Supabase stack was not running"

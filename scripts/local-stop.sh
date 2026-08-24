#!/usr/bin/env bash
# Stop only the SecureBin process recorded by scripts/local.sh.
set -euo pipefail

cd "$(dirname "$0")/.."
pid_file=".securebin-local/web.pid"
if [[ -f "$pid_file" ]]; then
  web_pid="$(tr -d '[:space:]' < "$pid_file")"
  if [[ "$web_pid" =~ ^[0-9]+$ ]] && [[ -r "/proc/$web_pid/cmdline" ]]; then
    command_line="$(tr '\0' ' ' < "/proc/$web_pid/cmdline")"
    if [[ "$command_line" == *"next"*"start"*"127.0.0.1"*"3101"* ]]; then
      kill "$web_pid"
      echo "local:stop stopped SecureBin web process $web_pid"
    else
      echo "local:stop refused to stop PID $web_pid because it is not the recorded SecureBin server" >&2
    fi
  fi
  rm -f "$pid_file"
fi

pnpm exec supabase stop >/dev/null 2>&1 && echo "local:stop stopped the Supabase stack" || echo "local:stop Supabase stack was not running"

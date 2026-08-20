#!/usr/bin/env bash
set -euo pipefail

# Safe, read-only smoke check. It never creates a share or handles secrets.
APP_URL="${APP_URL:-http://localhost:3000}"
APP_URL="${APP_URL%/}"
HEALTH_URL="${APP_URL}/api/health"

echo "Checking ${HEALTH_URL}"
response="$(curl --fail --silent --show-error --location --max-time 10 \
  --header 'Accept: application/json' \
  --header 'Cache-Control: no-cache' \
  "${HEALTH_URL}")"

if [[ -z "${response}" ]]; then
  echo "Health endpoint returned an empty response" >&2
  exit 1
fi

echo "Health check passed"

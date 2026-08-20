#!/usr/bin/env python3
"""Check the repository's Day 1 reproducibility and documentation contract.

This intentionally uses only the Python standard library so a fresh clone can
run it from the documented .venv without downloading an additional toolchain.
It validates presence and basic safety properties, not application behavior.
"""

from __future__ import annotations

import pathlib
import re
import sys


ROOT = pathlib.Path(__file__).resolve().parents[1]

REQUIRED_FILES = (
    "README.md",
    ".env.example",
    ".gitignore",
    ".github/workflows/ci.yml",
    ".github/dependabot.yml",
    "SECURITY.md",
    "architecture.md",
    "docs/threat-model.md",
    "docs/architecture-diagrams.md",
    "docs/policy-state.md",
    "docs/deployment.md",
    "scripts/demo-smoke.sh",
    "scripts/demo-smoke.ps1",
)

ENV_NAMES = (
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RATE_LIMIT_HMAC_KEY",
    "CRON_SECRET",
)


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> int:
    missing = [path for path in REQUIRED_FILES if not (ROOT / path).is_file()]
    if missing:
        fail("missing required files: " + ", ".join(missing))

    env_text = (ROOT / ".env.example").read_text(encoding="utf-8")
    for name in ENV_NAMES:
        if not re.search(rf"^{re.escape(name)}=\*\*\*$", env_text, re.MULTILINE):
            fail(f".env.example must contain redacted {name}=***")

    for secret in ("sk_live_", "-----BEGIN", "postgresql://"):
        if secret.lower() in env_text.lower():
            fail(f".env.example contains a value-shaped secret marker: {secret}")

    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
    for pattern in (".venv/", ".env", "build/", "test-results/", ".env.example"):
        if pattern not in gitignore:
            fail(f".gitignore is missing required pattern: {pattern}")

    for script in ("scripts/demo-smoke.sh", "scripts/demo-smoke.ps1"):
        text = (ROOT / script).read_text(encoding="utf-8")
        if "api/health" not in text or "APP_URL" not in text:
            fail(f"{script} must perform an explicit health check using APP_URL")

    print("OK: reproducibility and documentation contract is valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

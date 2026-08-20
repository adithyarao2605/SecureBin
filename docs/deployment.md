# Deployment and reproducibility

There is no production deployment URL in this repository yet. Do not treat a
local server, preview URL, or planned Vercel project as deployment evidence.
When one exists, record the exact URL and commit in the judge-facing README.

## Local prerequisites

- Active Node LTS pinned by `.nvmrc` once the app scaffold is present.
- Corepack-managed pnpm; do not introduce npm, yarn, or a second lockfile.
- Python 3.12 or newer for repository checks.
- A local Supabase CLI/runtime only when database work is implemented.

## Fresh-clone check

The Day 1 repository check has no third-party Python dependencies:

```bash
python3 -m venv .venv
.venv/bin/python scripts/verify-reproducibility.py
```

For the application (once `package.json` and `pnpm-lock.yaml` exist):

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm validate
```

The lockfile is part of the reproducibility contract. CI refuses unlocked
dependency installation and runs the same Python repository check.

## Environment handling

Copy `.env.example` to an untracked `.env` and fill values using the hosting
provider's secret store. Public variables are safe for browser configuration;
`SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_HMAC_KEY`, and `CRON_SECRET` are
server-only. Never paste real values into issues, screenshots, test fixtures,
logs, or the submission notes.

## Vercel/Supabase release checklist

1. Create a private Supabase Storage bucket for encrypted file objects.
2. Apply migrations from a clean database and run RLS/integration tests.
3. Configure the exact environment variables in the Vercel project; preview and
   production values must be separate.
4. Configure the hourly cleanup trigger with a secret authenticated request.
5. Verify security headers, `no-store`, private object access, and the health
   endpoint on the deployed commit.
6. Run `APP_URL=https://<verified-host> scripts/demo-smoke.sh` from a clean
   environment. The smoke check is read-only and does not prove encryption or
   reveal-limit correctness.
7. Record the URL, commit SHA, deployment timestamp, and validation evidence in
   the submission notes.

No step above is evidence that deployment has happened until its result is
recorded from the actual provider.

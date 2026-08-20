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

## UX release checks

The deployed build should preserve the quiet-proof direction in
[`docs/SPEC.md`](SPEC.md#experience-direction--quiet-proof): one primary
compose/reveal surface, a proofline/status rail that becomes a mobile status
strip, plain action copy, and the Linen/Ink/Mineral/Copper token family. Before
calling a deployment demo-ready, verify both light and dark themes, keyboard
focus, contrast, reduced motion, narrow mobile layout, and the uniform
`Unavailable` state on the real host. Remove accidental neon, terminal, matrix,
shield/lock, or fake threat-meter styling.

Fonts and visual assets must be bundled or served from the same trusted origin.
Secret routes must not request remote fonts, analytics, embeds, pixels, or
media; confirm this in the deployed browser network panel alongside CSP and
`no-store` checks.

## Environment handling

Copy `.env.example` to an untracked `.env` and fill values using the hosting
provider's secret store. Public variables are safe for browser configuration;
`SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_HMAC_KEY`, and `CRON_SECRET` are
server-only. Never paste real values into issues, screenshots, test fixtures,
logs, or the submission notes.

## Manual production deployment (repository owner)

The repository owner performs this release; agents must not deploy it without
an explicit request. Start from a clean `main` checkout and keep every secret in
the provider stores, never in a tracked file.

1. Reproduce the verified build locally:

   ```bash
   corepack enable
   corepack install
   pnpm install --frozen-lockfile
   pnpm validate
   pnpm supabase:start
   pnpm supabase:reset
   pnpm supabase:test
   ```

2. Create a Supabase project in the Supabase dashboard. Copy its project ref,
   project URL, browser-safe anon/publishable key, and server-only service-role
   key from the project settings. Do not post these values in GitHub.
3. Authenticate and apply the committed database contract:

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <your-project-ref>
   pnpm exec supabase db push
   ```

   Confirm the `securebin-files` bucket exists and is private. The migration
   creates it and keeps anonymous table/RPC access revoked.
4. Generate independent server secrets locally, for example with
   `openssl rand -base64 32`, for `RATE_LIMIT_HMAC_KEY` and the future
   `CRON_SECRET`. Store them only in Vercel. The current text-only slice uses
   the rate-limit key; do not configure a cron schedule yet because the cleanup
   HTTP endpoint is not implemented.
5. In Vercel, import the `adithyarao2605/SecureBin` GitHub repository, keep the
   detected Next.js framework, and use the committed `vercel.json`. Configure
   these Production values:

   ```text
   NEXT_PUBLIC_APP_URL=https://<your-production-host>
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<browser-safe anon or publishable key>
   SUPABASE_SERVICE_ROLE_KEY=<server-only service-role key>
   RATE_LIMIT_HMAC_KEY=<independent random value>
   CRON_SECRET=<independent random value reserved for the future cleanup route>
   ```

   Mark the service-role, rate-limit, and cron values as sensitive. Never use
   the service-role value in a `NEXT_PUBLIC_*` variable.
6. Deploy `main`. If the final Vercel hostname differs from the value supplied
   for `NEXT_PUBLIC_APP_URL`, correct it and redeploy.
7. Run the production checks below, then record the URL, deployed commit SHA,
   timestamp, and results in `info/HANDOFF.md` and the README.

### Production checks

```bash
APP_URL=https://<your-production-host> scripts/demo-smoke.sh
curl --fail --silent --show-error https://<your-production-host>/api/health
curl --silent --dump-header - --output /dev/null https://<your-production-host>/
```

In a private browser window, create a non-sensitive test note, open the returned
fragment URL, authorize one reveal, confirm local decryption, and revoke/delete
the test share. In the browser network panel, verify the fragment and plaintext
never appear in requests and secret routes load no third-party resources.
Confirm a second reveal of a one-reveal share returns the uniform `Unavailable`
state. Delete the test data when finished.

## Vercel/Supabase release checklist

1. Create a private Supabase Storage bucket for encrypted file objects.
2. Apply migrations from a clean database and run RLS/integration tests.
3. Configure the exact environment variables in the Vercel project; preview and
   production values must be separate.
4. After the authenticated cleanup HTTP route is implemented, configure its
   hourly trigger. Do not point a scheduler at an unimplemented or unprotected
   route.
5. Verify security headers, `no-store`, private object access, and the health
   endpoint on the deployed commit.
6. Run `APP_URL=https://<verified-host> scripts/demo-smoke.sh` from a clean
   environment. The smoke check is read-only and does not prove encryption or
   reveal-limit correctness.
7. Record the URL, commit SHA, deployment timestamp, and validation evidence in
   the submission notes.

No step above is evidence that deployment has happened until its result is
recorded from the actual provider.

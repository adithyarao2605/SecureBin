# Deployment and reproducibility

The current production host is `https://secure-bin.vercel.app/`. The previous Day 1 production incident is resolved (see [`archive/PRODUCTION-INCIDENT.md`](archive/PRODUCTION-INCIDENT.md)). Local `dev` includes the forward pre-freeze migration `20260901000000_pre_freeze_lifecycle_uploads.sql`; hosted migration state must be confirmed by the owner (`supabase migration list`, then `supabase db push`) before the latest lifecycle, upload, and cleanup behavior is considered deployed. The current landing/app route split also needs the owner-operated production redeploy.

Local/self-hosted operation is documented below. The scripts now create an
ignored, mode-restricted runtime environment, require loopback Supabase URLs,
serve a production build with `next start`, and stop only a validated
SecureBin-owned PID. Cleanup is configured hourly in `vercel.json`; provider
deployment and hosted migration confirmation remain owner-operated.

Branch model: development happens on `dev`, which Vercel builds as a preview deployment; `main` is production. Verify features on the preview URL before promoting to `main`.


## Local prerequisites

- Node `22.23.2`, pinned by `.nvmrc` and `.node-version`.
- Corepack-managed pnpm; do not introduce npm, yarn, or a second lockfile.
- Python 3.12 or newer for repository checks.
- Docker-compatible local runtime for the committed Supabase migrations/tests.

## Fresh-clone check

The Day 1 repository check has no third-party Python dependencies:

```bash
python3 -m venv .venv
.venv/bin/python scripts/verify-reproducibility.py
```

For the application:

```bash
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm validate
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:a11y
```

On a fresh Linux host that lacks browser system libraries, use
`pnpm exec playwright install --with-deps chromium` instead.

The lockfile is part of the reproducibility contract. CI refuses unlocked
dependency installation and runs the same Python repository check.

## Give the repository to a friend or maintainer

### What to send

- The GitHub repository URL: `https://github.com/adithyarao2605/SecureBin`.
- The exact reviewed commit SHA from `git rev-parse HEAD`.
- This runbook and the current [`../info/HANDOFF.md`](../info/HANDOFF.md).
- A statement of scope: pre-freeze implementation is on `dev` and core local
  verification passes (191 unit, 16 integration, 155 pgTAP after clean reset,
  19 development and 19 production Playwright tests, 7 Axe checks, nine
  reviewed screenshots, reproducibility, dependency, and source/log audits).
  Hosted migration/deployment state still requires owner evidence.
  Do not claim production is current without provider evidence.

Do **not** send `.env`/`.env.local`, Supabase service-role credentials,
`RATE_LIMIT_HMAC_KEY`, `CRON_SECRET`, real share URLs or URL fragments,
passwords, unlock codes, raw deletion capabilities, or production database
exports. GitHub access is enough for code review.

### What your friend runs

From a new directory and a fresh clone:

```bash
git clone https://github.com/adithyarao2605/SecureBin.git
cd SecureBin
git checkout <commit-sha>
node --version
python3 -m venv .venv
.venv/bin/python scripts/verify-reproducibility.py
corepack enable
corepack install
pnpm --version
pnpm install --frozen-lockfile
pnpm validate
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:a11y
```

Expected versions are Node `v22.23.2` and pnpm `10.15.1`. For database
verification, start Docker and additionally run:

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:test
```

They should return the checked-out SHA, command results, OS/browser details,
and any screenshots with only non-sensitive synthetic content. They should not
return a real fragment URL or environment values.

### If your friend will deploy

Prefer adding them to the Vercel and Supabase projects with the minimum
provider role needed. Otherwise they create separate provider projects and
their own secrets. Do not copy owner secrets through chat. Agree first on who
owns billing, the production hostname, rollback, and deletion of test data.
The person with provider access then follows the owner procedure below and
returns only the deployment URL, commit SHA, timestamp, and redacted checks.

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
   git switch main
   git pull --ff-only
   git status --short
   node --version
   python3 -m venv .venv
   .venv/bin/python scripts/verify-reproducibility.py
   corepack enable
   corepack install
   pnpm install --frozen-lockfile
   pnpm validate
   pnpm test:integration
   pnpm exec playwright install chromium
   pnpm test:e2e
   pnpm test:a11y
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
   creates it with a 14 MiB object limit and keeps anonymous table/RPC/Storage
   access revoked. Also confirm RLS is enabled and forced on application tables.
4. Generate independent server secrets locally, for example with
   `openssl rand -base64 32`, for `RATE_LIMIT_HMAC_KEY` and `CRON_SECRET`.
   Store them only in Vercel. `CRON_SECRET` protects the internal cleanup endpoint
   `POST /api/internal/cleanup` via `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`.
5. In Vercel, import the `adithyarao2605/SecureBin` GitHub repository, keep the
   detected Next.js framework, and use the committed `vercel.json`. Configure
   these Production values:

   ```text
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<server-only sb_secret key or legacy service-role JWT>
   RATE_LIMIT_HMAC_KEY=<independent random value>
   CRON_SECRET=<independent random value for POST /api/internal/cleanup>
   ```

   Only `NEXT_PUBLIC_SUPABASE_URL` is public: the middleware embeds the Supabase
   project origin into the Content-Security-Policy and no anonymous key ships in
   any bundle. SecureBin accepts Supabase's recommended `sb_secret_...` key as
   well as the legacy service-role JWT under its variable name. Mark the
   service-role, rate-limit, and cron values as sensitive. Never use the
   service-role value in a `NEXT_PUBLIC_*` variable.
6. After preview verification and owner approval, promote the reviewed `dev`
   commit to `main` and deploy it. Record the exact deployed SHA.
7. Run the production checks below, then record the URL, deployed commit SHA,
   timestamp, and results in `info/HANDOFF.md` and the README.

### Rollback

If deployment or the browser-backed flow fails, stop sharing the new URL.
The 2026-08-21 `invalid content envelope` create incident is closed; its
diagnostic history lives in the dedicated incident handoff. For a fresh
regression, promote the last known-good Vercel deployment or redeploy its
exact commit; do not roll back a database migration blindly. Migrations are
forward-only: a database recovery requires an explicitly reviewed forward
repair or a fresh project with all migrations replayed in order. Record the
failed deployment, redacted symptom, commit, and recovery result in
`info/HANDOFF.md`.

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

Return these non-secret facts to the repository maintainer:

- production URL and deployed commit SHA;
- deployment and check timestamps with timezone;
- Supabase migration identifier applied;
- health/header/smoke results and the manual create/reveal/delete result;
- browser/device used and any remaining blocker.

## Vercel/Supabase release checklist

1. Verify the migration-created `securebin-files` bucket exists and remains
   private; do not replace it with a manually public bucket.
2. Apply migrations from a clean database and run RLS/integration tests.
3. Configure the exact environment variables in the Vercel project; preview and
   production values must be separate.
4. Keep the hourly cleanup trigger pointed at `POST /api/internal/cleanup`
   with the `CRON_SECRET` bearer header; verify it returns 200 and the counts
   stay at zero once backlog is drained.
5. Verify security headers, `no-store`, private object access, and the health
   endpoint on the deployed commit.
6. Run `APP_URL=https://<verified-host> scripts/demo-smoke.sh` from a clean
   environment. The smoke check is read-only and does not prove encryption or
   reveal-limit correctness.
7. Record the URL, commit SHA, deployment timestamp, and validation evidence in
   the submission notes.

No step above is evidence that deployment has happened until its result is
recorded from the actual provider.

## Local and self-hosted operation

Prerequisites are the pinned Node version, Corepack pnpm, Docker, and the
repository-local Supabase CLI invoked through `pnpm exec supabase`.

```bash
pnpm local:setup
pnpm local
pnpm local:stop
```

The intended result is an app at `http://127.0.0.1:3101` backed only by a local
Supabase stack. Local runtime secrets must live in a dedicated ignored file
with restrictive permissions; production `.env.local` values must never be
retained, read, or overwritten. The URL must be loopback, the app must use a
production build with `next start`, and stop must target only a validated
SecureBin-owned PID.

The committed scripts enforce those safeguards: they use the repository-pinned
Node runtime, write only beneath ignored `.securebin-local`, require loopback
URLs, build before starting `next start`, protect the generated environment
file, and stop only the validated SecureBin-owned PID.

After remediation, the clean-clone proof is: setup, start, create a synthetic
share, reveal it, verify private Storage and local-only URLs, stop the owned
process, and confirm no unrelated listener or production environment changed.

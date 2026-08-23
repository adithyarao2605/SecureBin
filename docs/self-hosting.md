# Self-hosting SecureBin locally

Everything runs on your machine: the Next.js app and a private Supabase stack
(Postgres, Auth disabled in practice, Storage) through the Supabase CLI. No
production credential is ever needed or read.

## Prerequisites

- Node.js (version pinned in `.nvmrc`) and pnpm via Corepack
  (`corepack enable && corepack install`).
- Docker running (the Supabase stack is containerized).
- Supabase CLI (`supabase --version` must work).

## One-time setup

```bash
pnpm local:setup
```

This checks the prerequisites, installs locked dependencies, generates local
secrets into an untracked `.env.local`, starts the Supabase containers, and
applies every migration with `supabase db reset`. The service key is copied
out of `supabase status` automatically — you never paste keys by hand.

## Run

```bash
pnpm local          # app on http://127.0.0.1:3101
```

Stop the web server with Ctrl+C; stop everything (including Supabase) with:

```bash
pnpm local:stop
```

## What stays on your machine

- `.env.local` holds secrets generated during setup. It is git-ignored; never
  commit it or share it. For handing the project to someone else, send them
  this repository plus this document — never your `.env.local`.
- All share content is browser-encrypted exactly as in production; the local
  Supabase stores only ciphertext, digests, and metadata.

## Verifying from a clean clone

```bash
git clone <your-fork-url> securebin && cd securebin
pnpm local:setup && pnpm local
# open http://127.0.0.1:3101/new, create a share, open its link, reveal
```

Windows: use WSL2 and follow the Linux steps inside it.

## Troubleshooting

- Port 54321 already in use: another Supabase project is running;
  `supabase stop` first.
- `docker info` fails: start the Docker daemon before setup.
- Fresh clone tests: `pnpm validate` needs only Node/pnpm; the E2E suites need
  the local stack from `pnpm local:setup`.

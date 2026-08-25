# SecureBin

[![CI](https://github.com/adithyarao2605/SecureBin/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/adithyarao2605/SecureBin/actions/workflows/ci.yml)
[![Live app](https://img.shields.io/badge/live-secure--bin.vercel.app-2f7071)](https://secure-bin.vercel.app/)

SecureBin is a browser-encrypted platform for sharing notes, Markdown, code,
and files with explicit access policies. Your browser encrypts content before
it leaves the page. The service stores ciphertext and enforces lifecycle rules
such as availability, expiry, revocation, and reveal limits.

SecureBin is independently implemented for the CloneFest 2.0 PrivateBin
challenge. It does not copy PrivateBin source code, formats, templates, or
visual identity.

> Create share. Reveal once. Keep the key where it belongs: in the browser.

## Contents

- [Live product and current focus](#live-product-and-current-focus)
- [Explore the product](#explore-the-product)
- [What SecureBin supports](#what-securebin-supports)
- [How the security model works](#how-the-security-model-works)
- [Offline `.securebin` parcels](#offline-securebin-parcels)
- [Run locally](#run-locally)
- [Run the validation suite](#run-the-validation-suite)
- [Self-host](#self-host)
- [Judge demo flow](#judge-demo-flow)
- [Repository map](#repository-map)
- [Release checklist](#release-checklist)
- [Scope and deferred work](#scope-and-deferred-work)
- [Contribution rules](#contribution-rules)

## Live product and current focus

The deployed application is available at **[secure-bin.vercel.app](https://secure-bin.vercel.app/)**.

The current product feature set is frozen. Active work is limited to fixing
bugs, hardening existing flows, and improving reliability, accessibility,
performance, and visual polish. New roadmap capabilities are intentionally
out of scope until the current experience is stable.

The application includes its own guided documentation surface. The **How it
works** section in the `/new` workspace explains the product as it is used,
including the quickstart, protection factors, lifecycle rules, attachments,
offline parcels, trust boundaries, evidence, and limitations.

## Explore the product

Open the live application and select **How it works** from the application
header, or go directly to **`/new#how-it-works`**. The Documentation &
Knowledge Base is intentionally part of the product surface rather than a
separate marketing page.

Then use **New share** to exercise the real flow: create a share, inspect the
visible policy summary and Privacy Receipt, and open the recipient route. The
UI explains what is implemented, what the server can observe, and what
UI explains what is implemented, what the server can observe, and what
revocation cannot erase.

## What SecureBin supports

| Area | Current capability |
| --- | --- |
| Content | Plain notes, GitHub-Flavored Markdown, and code with language detection and highlighting |
| Protection | Link fragment, password, 27-character second-channel unlock code, or combined factors |
| Policies | Scheduled availability, custom expiry, Never expiry, burn-after-opening, custom reveal limits, and unlimited reveals |
| Attachments | Up to five encrypted files, safe previews, individual downloads, and encrypted ZIP download |
| Discussions | Encrypted threaded comments with client-held edit and delete proofs |
| Sender tools | Privacy Receipt, local Share History, revocation, QR sharing, and deletion controls |
| Portable use | Versioned `.securebin` parcel export and fully offline restore |
| Recipient experience | Release-window countdown, Privacy Veil, uniform `unavailable` failures, and responsive mobile layouts |
| Hosting | Local production-shaped runtime, Supabase-backed deployment, and self-hosted operation |

## How the security model works

### Browser responsibilities

The browser performs:

- Key generation and factor combination.
- AES-256-GCM encryption and decryption through Web Crypto.
- PBKDF2 password derivation and HKDF domain separation.
- Parcel encoding and decoding.
- Markdown, code, and attachment rendering through explicit safety boundaries.

The URL fragment contains the link secret and is not sent in HTTP requests.

### Server responsibilities

The server stores encrypted envelopes and bounded lifecycle metadata. It
atomically enforces:

- Scheduled availability, expiry, and revocation.
- Reveal limits and short retry leases.
- Upload reservations and attachment size limits.
- Rate limits using HMAC-derived network discriminators.
- Private Storage access and cleanup.

The server never needs plaintext content, passwords, unlock codes, filenames,
MIME types, deletion capabilities, or raw discussion capabilities.

### Honest boundaries

SecureBin does not claim that copies are impossible to make. A compromised
browser or deployment could capture plaintext while it is being used, and a
recipient can save a decrypted copy. Infrastructure can still observe bounded
metadata such as timing, ciphertext size, network information, and access
patterns.

Revoking an online share cannot erase content that has already been decrypted
or an offline parcel that was already downloaded. A revoked share URL becomes
unavailable; a `.securebin` parcel still requires its original fragment key and
any additional factors to decrypt offline.

## Offline `.securebin` parcels

A parcel is a portable encrypted bundle containing the encrypted content,
encrypted attachment material, and non-secret policy metadata. It never
contains the link secret, password, unlock code, deletion capability, or
discussion capability.

To restore one:

1. Open **Open a parcel** from the `/new` workspace.
2. Select the `.securebin` file.
3. Enter the original fragment key and any required password or unlock code.
4. Decrypt locally. No API or Storage request is needed.

## Run locally

### Prerequisites

- Node.js `22.23.2` from `.nvmrc`.
- Corepack with pnpm `10.15.1`.
- Python 3.12 or newer.
- Docker running for the local Supabase stack.

### Production-shaped local runtime

```bash
python3 -m venv .venv
.venv/bin/python scripts/verify-reproducibility.py

corepack enable
corepack install
pnpm install --frozen-lockfile

pnpm local:setup
pnpm local
```

The local app runs at `http://127.0.0.1:3101`.

Stop the isolated runtime with:

```bash
pnpm local:stop
```

For a fast development server without the production-shaped wrapper:

```bash
pnpm dev
```

The same guided product explanation is available locally at
`http://127.0.0.1:3101/new#how-it-works` when using the production-shaped
runtime.

The repository-local runtime keeps generated credentials in the ignored
`.securebin-local/` directory. Never commit them or reuse production secrets.

## Run the validation suite

The GitHub Actions workflow is the authoritative full validation environment.
It starts a clean Supabase instance, replays migrations, runs database tests,
and then runs the application, browser, audit, and accessibility gates.

Useful local commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm supabase:reset
pnpm supabase:test
pnpm test:e2e
pnpm test:e2e:prod
pnpm test:a11y
pnpm audit:prod
pnpm audit:source
pnpm build
pnpm validate
```

The recorded baseline includes 191 unit tests, 16 integration tests, 155
pgTAP assertions, 19 development Playwright tests, 19 production-build
Playwright tests, and 7 Axe checks. GitHub Actions should be used for the
complete matrix when local Docker or hosted credentials are unavailable.

A read-only health check is available with:

```bash
APP_URL=http://127.0.0.1:3101 scripts/demo-smoke.sh
```

The smoke script checks availability only; it does not prove encryption or
database behavior.

## Self-host

SecureBin can run with a self-managed Next.js server and Supabase-compatible
database and Storage setup.

### Local self-hosted stack

```bash
pnpm local:setup
pnpm local
```

### Production-shaped server

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Configure these environment variables on the server. Keep service credentials
server-only and never expose them to browser code:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase.example.com
SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-secret
RATE_LIMIT_HMAC_KEY=64-character-hex-hmac-key
CRON_SECRET=independent-random-cleanup-secret
SECUREBIN_PROXY_TRUST=none
```

Apply the committed database migrations in order, create the private
`securebin-files` Storage bucket, and schedule an hourly authenticated request
to `/api/internal/cleanup`. Use a trusted reverse proxy configuration only
when that proxy overwrites forwarding headers correctly.

Never share `.env` files, service-role keys, cleanup secrets, passwords,
unlock codes, deletion capabilities, or fragment URLs.

## Judge demo flow

Use synthetic content and keep the story under 90 seconds:

1. Create a Markdown share with an attachment.
2. Enable password plus second-channel protection.
3. Show the Privacy Receipt.
4. Demonstrate that the link alone cannot unlock the share.
5. Reveal and decrypt in the browser.
6. Preview the attachment and show the release-window Privacy Veil.
7. Revoke a second share.
8. Show the uniform `unavailable` state.
9. State the honest limits: browser compromise and recipient-saved copies remain possible.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/` | Next.js routes, workspace, composer, viewer, receipts, history, and UI states |
| `lib/crypto/` | Browser-only encryption, factors, envelopes, payloads, and parcels |
| `lib/render/` | Markdown, code, and attachment safety boundaries |
| `lib/server/` | Server-only Supabase, Storage, rate limiting, lifecycle, and route services |
| `supabase/migrations/` | Ordered database schema, RPCs, RLS, lifecycle, and Storage contracts |
| `supabase/tests/` | pgTAP policy, lifecycle, RLS, concurrency, attachment, and cleanup checks |
| `tests/` | Unit, integration, browser, production-build, and accessibility tests |
| `scripts/` | Reproducibility, local runtime, source audit, and smoke tooling |
| `LAST_DAY.md` | Release-freeze and final demo checklist |
| `info/plan_v3.md` | Active roadmap and feature-freeze decisions |
| `info/HANDOFF.md` | Current implementation status and owner handoff record |
| `history.md` | Consolidated implementation history and capability record |
| `self_hosting.md` | Expanded self-hosting reference |
| `bugs.md` | Known bug and interaction tracker |

## Release checklist

Before declaring the current release complete:

- [ ] Confirm the deployed commit and hosted migration state.
- [ ] Run the full GitHub Actions validation workflow.
- [ ] Exercise the production smoke matrix across policies, attachments,
      discussions, parcels, revocation, and refresh behavior.
- [ ] Capture one-reveal and three-reveal concurrency evidence.
- [ ] Verify retry and lifecycle race behavior.
- [ ] Review the security boundary and confirm no secrets or plaintext enter
      logs, URLs, Storage paths, or server-side payloads.
- [ ] Rehearse the judge/demo flow with synthetic content.
- [ ] Keep the working tree clean and record the exact release commit.

## Scope and deferred work

The feature set is frozen while existing functionality is hardened. Do not
start new roadmap capabilities without an explicit scope decision.

Deferred features include:

- Secure Drop request links.
- Recipient acknowledgment.
- Ciphertext-size padding.
- Accounts, passkeys, and device-bound sharing.
- Encrypted rooms and realtime collaboration.
- Argon2id/WASM password derivation.
- Localization waves.
- Alternate databases or Kubernetes deployment.
- PrivateBin compatibility.
- Blockchain or AI features.

## Contribution rules

- Use the Node and pnpm versions pinned by the repository.
- Keep browser crypto separate from server credentials and database code.
- Never implement cryptographic primitives manually.
- Do not log plaintext, secrets, fragments, capabilities, filenames, MIME
  types, request bodies, or ciphertext bodies.
- Preserve strict schemas, bounded inputs, atomic lifecycle transitions, and
  uniform recipient-facing failures.
- Use small Conventional Commits and keep changes focused.
- Do not modify `info/plan.md` or read-only challenge/reference material.
- Run the smallest relevant checks while iterating and the full CI gate before
  handoff.

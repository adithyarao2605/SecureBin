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

## At a glance

| Resource | Entry point |
| --- | --- |
| Live application | [secure-bin.vercel.app](https://secure-bin.vercel.app/) |
| In-product technical guide | [`/new#how-it-works`](https://secure-bin.vercel.app/new#how-it-works) |
| Local production-shaped runtime | `pnpm local:setup && pnpm local` |
| Fast local validation | `pnpm validate` |
| Security reporting | [`SECURITY.md`](SECURITY.md) |

## Evaluation at a glance

| Area | Review-ready evidence |
| --- | --- |
| Problem and core flow | Browser-side encryption, fragment-keyed sharing, explicit expiry/revocation/reveal policies, and a real recipient viewer. |
| Security model | AES-256-GCM, PBKDF2/HKDF factors, strict envelope validation, private Storage, atomic lifecycle RPCs, and uniform unavailable states. |
| Product depth | Notes, Markdown, code IDE, encrypted attachments, discussions, Privacy Receipt, local Share History, QR sharing, and offline parcels. |
| Reliability and accessibility | Idempotent creation/upload/reveal flows, cleanup retries, rate limits, keyboard support, responsive states, source audit, unit tests, and CI browser/Axe gates. |
| Review path | This README for orientation, the in-app guide for behavior, and [`docs/architecture.md`](docs/architecture.md) plus [`docs/evidence.md`](docs/evidence.md) for implementation proof. |

## Contents

- [At a glance](#at-a-glance)
- [Evaluation at a glance](#evaluation-at-a-glance)
- [Live product and current focus](#live-product-and-current-focus)
- [Explore the product](#explore-the-product)
- [What SecureBin supports](#what-securebin-supports)
- [How the security model works](#how-the-security-model-works)
- [Offline `.securebin` parcels](#offline-securebin-parcels)
- [Encrypted discussions](#encrypted-discussions)
- [Architecture at a glance](#architecture-at-a-glance)
- [Run locally](#run-locally)
- [Run the validation suite](#run-the-validation-suite)
- [Self-host](#self-host)
- [Judge demo flow](#judge-demo-flow)
- [Implementation evidence map](#implementation-evidence-map)
- [Documentation index](#documentation-index)
- [License and security](#license-and-security)
- [Repository map](#repository-map)

## Live product and current focus

The deployed application is available at **[secure-bin.vercel.app](https://secure-bin.vercel.app/)**.

The current product feature set is established. The release pass is limited to
fixing bugs, verifying hosted behavior, and polishing documentation,
repository hygiene, reliability, accessibility, performance, and visual
details. New roadmap capabilities are intentionally out of scope.

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
revocation cannot erase.

## What SecureBin supports

| Area | Current capability |
| --- | --- |
| Content | Plain notes, GitHub-Flavored Markdown, and code with first-paste language detection in one editable syntax-highlighted IDE |
| Protection | Link fragment, password, 27-character second-channel unlock code, or combined factors |
| Policies | Scheduled availability, custom expiry, Never expiry, one-time or custom reveal limits, and unlimited reveals (one-time/24-hour is the safe default) |
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
- Reveal limits and short retry leases for reliable delivery.
- Upload reservations and attachment size limits.
- Rate limits using HMAC-derived network discriminators.
- Private Storage access and cleanup.

The server never needs plaintext content, passwords, unlock codes, filenames,
MIME types, deletion capabilities, or raw discussion capabilities.

The optional local Share History stores the complete share link and sender
revocation capability in this browser's local storage. It is never uploaded,
but anyone with access to this browser profile can inspect it; clear local
history when the device is shared.

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

## Encrypted discussions

SecureBin supports optional encrypted discussion threads attached to a share.
After a recipient successfully reveals an available share, they can post
encrypted replies in the browser. The sender can enable discussions when
creating the share; the discussion capability is sealed into the encrypted
content and is never exposed through the public share identifier alone.

Discussion behavior:

- Comment bodies and optional nicknames are encrypted before they leave the
  browser.
- Replies can be nested, while authors can edit or delete their own comments
  using browser-held proof tokens.
- Discussion access follows the share lifecycle: scheduled, expired, revoked,
  exhausted, or unavailable shares cannot accept or list comments.
- The server stores encrypted envelopes and capability/proof digests, not
  plaintext comments or raw client capabilities.
- SecureBin does not claim to know whether a person read or understood a
  comment. There are no activity or read receipts.

This is an encrypted threaded discussion feature, not a realtime encrypted
room. Realtime rooms and collaborative editing remain outside the current
release scope.

## Architecture at a glance

| Layer | Responsibility |
| --- | --- |
| Browser | Generates factors and keys; encrypts/decrypts content and files; renders decrypted material; creates QR codes and receipts. |
| Next.js API | Validates strict payloads, applies rate limits, coordinates lifecycle RPCs, and issues short-lived Storage operations. |
| Supabase PostgreSQL | Stores ciphertext envelopes and bounded metadata; enforces idempotency, reveal leases, expiry, revocation, RLS, and cleanup state transitions. |
| Private Storage | Holds encrypted attachment bytes under random paths; anonymous table and object access is disabled. |
| CI and scripts | Replays migrations, runs unit/integration/browser/accessibility checks, audits source diagnostics, and validates reproducibility. |

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

The latest local validation record reports 217 unit tests passing alongside
lint, strict typechecking, the source audit, and the production build. The
complete matrix also includes Supabase migration/pgTAP checks, integration
tests, development and production-build Playwright suites, and Axe checks;
GitHub Actions is the authoritative place to verify those environment-backed
gates after a release commit.

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

Apply the committed database migrations in order, including the latest
forward lifecycle cleanup migration, create the private `securebin-files`
Storage bucket, and schedule an authenticated request to
`/api/internal/cleanup` (an hourly baseline is suitable for a self-hosted
deployment). Use a trusted reverse proxy configuration only
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

## Implementation evidence map

The quickest way to understand the implementation is to follow the product
surface and then verify the corresponding source evidence:

| What to verify | Product surface | Supporting evidence |
| --- | --- | --- |
| Plaintext is encrypted before upload and the key stays out of requests | Create a share, then read **How it works** | `lib/crypto/`, `docs/architecture.md`, crypto and source-audit tests |
| Factors and lifecycle rules are visible to the sender and recipient | Policy controls, result-card proof summary, and recipient policy strip | `lib/shares/`, `supabase/migrations/`, lifecycle and concurrency tests |
| The recipient experience handles real boundaries | Open a generated link and exercise reveal, expiry, release window, attachments, or discussions | `app/s/[publicId]/`, browser suites, and Axe checks |
| Revocation is useful without overclaiming erasure | Revoke a share, then inspect the unavailable state and Privacy Receipt | Atomic lifecycle RPCs, uniform failure contracts, and receipt tests |
| Offline portability remains local-only | Download a `.securebin` parcel and restore it through **Open parcel** | `lib/shares/parcel.ts`, parcel unit tests, and parcel browser coverage |
| The repository is reproducible and reviewable | Check the CI badge and validation commands above | GitHub Actions, `pnpm validate`, reproducibility script, and `info/HANDOFF.md` |

## Documentation index

Use the shortest document that answers the question:

| Need | Read |
| --- | --- |
| Product behavior, setup, demo, and security summary | This README |
| Protocol, trust boundaries, schemas, RPCs, and lifecycle semantics | [`docs/architecture.md`](docs/architecture.md) |
| UX direction and accessibility expectations | [`docs/SPEC.md`](docs/SPEC.md) |
| Deployment, environment variables, migrations, and smoke checks | [`docs/deployment.md`](docs/deployment.md) and [`docs/self-hosting.md`](docs/self-hosting.md) |
| Validation evidence and what still needs owner verification | [`docs/evidence.md`](docs/evidence.md) and [`info/HANDOFF.md`](info/HANDOFF.md) |
| Final verification and demo checklist | [`LAST_DAY.md`](LAST_DAY.md) and [`docs/DAY-7-PLAN.md`](docs/DAY-7-PLAN.md) |
| Historical decisions and resolved incidents | [`docs/archive/implemented-history.md`](docs/archive/implemented-history.md) and [`docs/archive/`](docs/archive/) |

The in-app **How it works** panel at [`/new#how-it-works`](https://secure-bin.vercel.app/new#how-it-works) is the quickest product-level explanation; the documents above provide the implementation evidence behind it.

## License and security

Original SecureBin code is released under the permissive [MIT License](LICENSE).
You may use, modify, distribute, sublicense, and sell copies of it, provided
the copyright and license notices are preserved. The license also provides the
software without warranty and limits author liability to the extent permitted
by law. Third-party dependencies remain under their own licenses.

Please read the [security policy](SECURITY.md) before reporting a suspected
vulnerability. Never include real secrets or private share material in a
report.

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
| `docs/` | Architecture, UX specification, deployment, evidence, final verification, and historical references |
| `LAST_DAY.md` | Release-freeze and final demo checklist |
| `info/plan_v3.md` | Active roadmap and current release status |
| `info/HANDOFF.md` | Current implementation status and owner handoff record |
| `docs/archive/implemented-history.md` | Consolidated implementation history and capability record |
| `docs/self-hosting.md` | Expanded self-hosting reference |
| `docs/bugs.md` | Known bug and interaction tracker |

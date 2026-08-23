# SecureBin

SecureBin is an independently implemented, browser-encrypted sharing platform
for sensitive text, Markdown, code, and files. It combines a zero-knowledge
storage boundary with server-enforced expiry, scheduled availability,
revocation, and atomic reveal limits. Optional two-channel unlock and a Privacy
Receipt make the protection model visible to both sender and recipient.

This repository is being built for CloneFest 2.0's “Legacy Modernisation:
PrivateBin” challenge. It preserves the underlying problem—controlled sharing
of sensitive information—without copying PrivateBin source, wire formats,
templates, or visual identity.

## Current status

Days 1 through 5 are implemented and fully verified. That covers the core cryptographic engine, lifecycle policy correctness with concurrency proofs, safe multi-mode content (plain notes, sanitized Markdown, syntax-highlighted code) with SBCT binary framing, encrypted attachments up to five files per share with drag-and-drop and Download-all ZIP, password factors (PBKDF2-HMAC-SHA-256, 600,000 iterations), two-channel unlock codes (Crockford Base32 with check symbol), custom reveal counts from 1 to 100, "Never" expiry, Markdown Edit/Split/Preview authoring, code mode with local language detection, encrypted discussions, QR + native share + email actions, and the Privacy Receipt with a pre-flight "What will SecureBin see?" disclosure.

All gates pass locally: 145 unit tests (21 files), 14 integration tests, 115 pgTAP database tests (7 files), 10 Playwright E2E tests, and 2 Axe accessibility tests. The previous production incident is closed (see [`docs/PRODUCTION-INCIDENT.md`](docs/archive/PRODUCTION-INCIDENT.md)).

Development happens on the `dev` branch, which deploys as a Vercel preview; `main` remains production. CI automatically validates all gates against local Supabase and Playwright browsers on every commit and pull request.

## Product and UX direction

SecureBin uses a light-first **quiet proof** visual language: a warm Linen
canvas, Ink typography, Mineral actions, a restrained Copper accent, and an
asymmetrical single-surface layout. A small “proofline” connects browser,
sealed parcel, and recipient as a visual explanation of the flow. It is not a
cryptographic proof or a threat meter. The interface should feel calm and
precise, with a cybersecurity subject expressed through evidence and data
movement rather than neon, hacker-terminal, matrix, shield, or lock clichés.

Headings, body text, and receipt labels have distinct typographic roles; fonts
are bundled or system-fallback only because secret routes must not fetch remote
assets. State is always communicated with words and accessible structure in
addition to color or motion. See the detailed tokens, layout, motion rules,
and copy guidance in [`docs/SPEC.md`](docs/SPEC.md#experience-direction--quiet-proof).

## Why judges should care

- Content keys, passwords, unlock codes, filenames, and plaintext stay in the
  browser; infrastructure receives ciphertext and bounded lifecycle metadata.
- Availability, expiry, revocation, and reveal limits are transactional policy,
  not client-side suggestions.
- Two-channel shares require both the URL fragment and an independently
  shared unlock code; either component alone cannot decrypt.
- The Privacy Receipt explains what was protected and what metadata remains
  visible, before the share is created.
- The design explicitly documents residual risks: browser compromise,
  recipient copying, and network metadata are not solved by zero-knowledge
  storage.

## Documentation map

- [`docs/architecture.md`](docs/architecture.md) — protocol, schemas, API contracts, and
  lifecycle semantics.
- [`docs/threat-model.md`](docs/threat-model.md) — assets, trust boundaries,
  threats, controls, and limitations.
- [`docs/architecture-diagrams.md`](docs/architecture-diagrams.md) — standalone
  system, sequence, and trust-boundary diagrams.
- [`docs/policy-state.md`](docs/policy-state.md) — atomic lifecycle state model.
- [`docs/deployment.md`](docs/deployment.md) — fresh-clone, environment, and
  deployment checklist.
- [`docs/PRODUCTION-INCIDENT.md`](docs/archive/PRODUCTION-INCIDENT.md) — resolved
  2026-08-21 create-failure incident record and investigation order.
- [`docs/DAY-4-PLAN.md`](docs/archive/DAY-4-PLAN.md) and
  [`docs/DAY-5-PLAN.md`](docs/archive/DAY-5-PLAN.md) — executed Day 4 and Day 5
  plans, each with an appended outcome record.
- [`docs/DAY-6-PLAN.md`](docs/DAY-6-PLAN.md) and
  [`docs/DAY-7-PLAN.md`](docs/DAY-7-PLAN.md) — locked, gated plans for the
  remaining roadmap days.
- [`docs/SPEC.md`](docs/SPEC.md) — five-day delivery schedule and the quiet-proof
  visual/copy direction.
- [`docs/DAY-2-PLAN.md`](docs/archive/DAY-2-PLAN.md) — detailed lifecycle, concurrency,
  cleanup, and verification sequence.
- [`docs/DAY-2-UI.md`](docs/archive/DAY-2-UI.md) — implementation-ready quiet-proof UI
  contract for Day 2.
- [`docs/DAY-3-PLAN.md`](docs/archive/DAY-3-PLAN.md) — detailed safe-content and encrypted
  attachment sequence.
- [`info/plan.md`](info/plan.md) — product priorities, delivery order, and
  future roadmap (read-only planning source).

## Reproducible setup

The repository check is intentionally dependency-free Python. Run it in the
repo-local virtual environment:

```bash
python3 -m venv .venv
.venv/bin/python scripts/verify-reproducibility.py
```

When the Node application is present, use the exact pins committed in
`.nvmrc`/`.node-version` (`Node 22.23.2`) and `package.json`
(`pnpm@10.15.1`). Corepack provides the pnpm shim, so a globally installed pnpm
binary is not required:

```bash
node --version  # v22.23.2
corepack enable
corepack install
pnpm --version  # 10.15.1
pnpm install --frozen-lockfile
pnpm validate
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:a11y
```

On a fresh Linux host that lacks Chromium system libraries, use
`pnpm exec playwright install --with-deps chromium` instead.

Do not create a second package manager lockfile. Copy `.env.example` to an
untracked `.env` only when local application work requires configuration. Keep
server-only values out of browser imports and logs.

## Demo smoke check

The smoke script is a safe, read-only health check. It does not create a share,
handle a secret, or prove the cryptographic and database acceptance criteria.

```bash
APP_URL=http://localhost:3000 scripts/demo-smoke.sh
```

PowerShell users can run `.\scripts\demo-smoke.ps1` with `$env:APP_URL` set.
The `/api/health` endpoint is included in the application.

## Give this repository to a friend

Send your friend the GitHub repository URL, the exact commit SHA you want them
to review, and [`docs/deployment.md`](docs/deployment.md). Do not send an
`.env` file or any Supabase/Vercel secret. From a fresh clone, they should use
Node `22.23.2`, Corepack, and the committed `pnpm@10.15.1`, then run:

```bash
git checkout <commit-sha>
python3 -m venv .venv
.venv/bin/python scripts/verify-reproducibility.py
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm validate
pnpm test:integration
pnpm test:e2e
pnpm test:a11y
```

For review only, no provider access is necessary. For deployment, either add
them to the Vercel and Supabase projects through provider team access or let
them create independent projects; never copy service-role, rate-limit, cron,
password, unlock, fragment, or deletion secrets through chat. The complete
owner deployment, production verification, and return-evidence checklist is in
the deployment runbook.

## Judge demo flow

Every step of the rehearsed 60–90 second path is now implemented and covered
by tests; only the production redeploy of the newest migrations is an owner
step:

1. Create a Markdown share with encrypted files and a chosen reveal policy.
2. Show the Privacy Receipt and ciphertext-only server record.
3. Demonstrate that the URL fragment alone cannot decrypt a two-channel share.
4. Provide the unlock code through a separate channel and reveal successfully.
5. Show the concurrency test never exceeds the configured reveal limit.
6. Revoke a second share and show the uniform `unavailable` response.
7. Finish with CI, accessibility, architecture, and limitation evidence.

The concurrency step can cite the dedicated custom-limit test (exactly N of M
authorized at a non-preset limit).

## Rubric evidence

| Rubric area | Evidence location | Status |
| --- | --- | --- |
| Problem understanding | This README, local planning references, threat model | Foundation documented |
| Innovation | Browser-only encryption, atomic reveal authorization, password/unlock factors, encrypted discussions, custom policies, Privacy Receipt | Implemented through Day 5; plan_v3 Phases C–G in flight |
| Architecture | [`docs/architecture.md`](docs/architecture.md), diagrams | Documented through discussions and multi-file model |
| UX/accessibility | Playwright keyboard, mobile viewport, and axe tests | Composer, viewer, factor prompts, receipt, and discussions covered |
| Reliability/demo | CI, unit/integration/browser tests, smoke script, deployment runbook | Local + CI gates green: 145 unit / 14 integration / 115 pgTAP / 10 E2E / 2 Axe |
| Documentation | This README, threat model, architecture, runbook | Present |

## Security and limitations

Read [`docs/threat-model.md`](docs/threat-model.md) before handling sensitive data. SecureBin is not
DRM and cannot protect plaintext after it is rendered or copied. A malicious
application deployment can capture browser plaintext and keys. Infrastructure
can still observe ciphertext size, timestamps, network metadata, and access
patterns. These boundaries are part of the product's honest security story.

## License and reference boundary

The `info/Challenge_1.md`, `info/clonefest.md`, and nested `info/PrivateBin`
material are read-only references. SecureBin must remain an independent
implementation; do not copy source, wire formats, templates, or visual
identity from the reference checkout.

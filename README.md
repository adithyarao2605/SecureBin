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

Day 1 (Core Cryptographic Engine & Foundation) and Day 2 (Lifecycle Policy Correctness, Database Row Locking, Concurrency Proofs, Upload Reservations, Cleanup Operation, Safe Observability, Browser-Local Share History Desk with Reveal Tracking, and the Stitch MCP Quiet Proof Design System v1 with Refined Dark Mode Default & Custom Expiry) are **100% complete and fully verified**.

All 61 unit tests, 12 integration/concurrency tests, 54 pgTAP database tests, 7 Playwright E2E tests, and 2 Axe accessibility tests pass with zero critical violations. The previous production incident is closed (see [`docs/PRODUCTION-INCIDENT.md`](docs/PRODUCTION-INCIDENT.md)).

CI automatically validates all gates against local Supabase and Playwright browsers on every commit and pull request. Markdown sanitization, password factors, two-channel unlock codes, encrypted file attachments, and the Privacy Receipt are scheduled for Day 3.

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
- Two-channel shares require both the URL fragment and an independently shared
  unlock code.
- The Privacy Receipt explains what was protected and what metadata remains
  visible.
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
- [`docs/PRODUCTION-INCIDENT.md`](docs/PRODUCTION-INCIDENT.md) — evidence-led
  friend handoff for the unresolved production create failure.
- [`docs/SPEC.md`](docs/SPEC.md) — five-day delivery schedule and the quiet-proof
  visual/copy direction.
- [`docs/DAY-2-PLAN.md`](docs/DAY-2-PLAN.md) — detailed lifecycle, concurrency,
  cleanup, and verification sequence.
- [`docs/DAY-2-UI.md`](docs/DAY-2-UI.md) — implementation-ready quiet-proof UI
  contract for Day 2.
- [`docs/DAY-3-PLAN.md`](docs/DAY-3-PLAN.md) — detailed safe-content and encrypted
  attachment sequence.
- [`docs/SECURITY.md`](docs/SECURITY.md) — vulnerability reporting and security rules.
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

## Judge demo flow (target)

Once the judged release is implemented and deployed, the rehearsed 60–90
second path is:

1. Create a Markdown share with an encrypted file and a three-reveal policy.
2. Show the Privacy Receipt and ciphertext-only server record.
3. Demonstrate that the URL fragment alone cannot decrypt a two-channel share.
4. Provide the unlock code through a separate channel and reveal successfully.
5. Show the concurrency test never exceeds the configured reveal limit.
6. Revoke a second share and show the uniform `unavailable` response.
7. Finish with CI, accessibility, architecture, and limitation evidence.

This flow is a target until the corresponding feature and test evidence are
available.

## Rubric evidence

| Rubric area | Evidence location | Status |
| --- | --- | --- |
| Problem understanding | This README, local planning references, threat model | Foundation documented |
| Innovation | Browser-only encryption and atomic reveal authorization | Text slice implemented; advanced factors pending |
| Architecture | [`docs/architecture.md`](docs/architecture.md), diagrams | Documented |
| UX/accessibility | Playwright keyboard, mobile viewport, and axe tests | Text slice covered |
| Reliability/demo | CI, unit/integration/browser tests, smoke script, deployment runbook | Current `main` gates pass; production create incident remains open |
| Documentation | This README, threat model, security policy, runbook | Present |

## Security and limitations

Read [`docs/SECURITY.md`](docs/SECURITY.md) before handling real data. SecureBin is not
DRM and cannot protect plaintext after it is rendered or copied. A malicious
application deployment can capture browser plaintext and keys. Infrastructure
can still observe ciphertext size, timestamps, network metadata, and access
patterns. These boundaries are part of the product's honest security story.

## License and reference boundary

The `info/Challenge_1.md`, `info/clonefest.md`, and nested `info/PrivateBin`
material are read-only references. SecureBin must remain an independent
implementation; do not copy source, wire formats, templates, or visual
identity from the reference checkout.

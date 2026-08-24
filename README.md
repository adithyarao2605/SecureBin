# SecureBin

SecureBin is an independently implemented, browser-encrypted platform for sharing notes, Markdown, code, and files. The browser owns encryption and decryption; the service stores ciphertext plus bounded lifecycle metadata and atomically enforces availability, expiry, revocation, and reveal limits.

It modernises the problem behind CloneFest 2.0's PrivateBin challenge without copying PrivateBin source, formats, templates, or visual identity.

## Release status

Days 1–5 are implemented. The Day 6 surfaces—release windows, privacy veil, portable `.securebin` parcels, local share management, expanded receipts, and self-host tooling—are present on `dev`, but the audit found lifecycle, compatibility, recovery, accessibility, and evidence gaps. Day 6 is **not yet a green release gate**. Complete [`docs/before-day-7.md`](docs/before-day-7.md) and the quiet-proof UI overhaul before starting the release freeze.

The last full local baseline passed 170 unit, 16 integration, 145 pgTAP, 17 development E2E, 17 production-build E2E, and 7 Axe tests. Those tests do not cover every audited regression; the pre-freeze plan names the missing cases. Production promotion and verification of the newest migrations remain owner-operated. Development is on `dev`; `main` is not the current audit target.

## Why the design matters

- Content keys, passwords, unlock codes, filenames, and plaintext remain in the browser.
- Reveal limits and lifecycle state are database transactions, not UI claims.
- Optional two-channel unlock means the URL fragment alone is insufficient.
- Decrypted Markdown and attachments cross explicit safe-render boundaries.
- The product states its limits: a compromised browser can capture plaintext, recipients can save copies, and infrastructure can observe traffic metadata.

The UI contract is light-first **quiet proof**: Linen, Ink, Mineral, Copper, and Mist; one primary surface plus a narrow evidence rail; a compact mobile status strip; and one restrained browser → sealed parcel → recipient proofline. It avoids cyberpunk decoration and never presents a visual as cryptographic evidence. See [`docs/SPEC.md`](docs/SPEC.md).

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — protocol, trust model, lifecycle state, schemas, APIs, diagrams, and residual risks.
- [`docs/SPEC.md`](docs/SPEC.md) — standing product and experience contract.
- [`docs/deployment.md`](docs/deployment.md) — fresh clone, local/self-hosted, preview, production, and owner handoff.
- [`docs/evidence.md`](docs/evidence.md) — reproducible test, concurrency, performance, and demo evidence.
- [`docs/before-day-7.md`](docs/before-day-7.md) — required remediation and UI gate.
- [`docs/UI-REDESIGN.md`](docs/UI-REDESIGN.md) — implementation-ready visual-system and route/state redesign contract.
- [`docs/DAY-7-PLAN.md`](docs/DAY-7-PLAN.md) — final release-freeze checklist.
- [`info/plan_v3.md`](info/plan_v3.md) — active roadmap and scope decisions.
- [`info/HANDOFF.md`](info/HANDOFF.md) — branch, validation, owner actions, and recent work.
- [`docs/archive/history.md`](docs/archive/history.md) and [`docs/archive/PRODUCTION-INCIDENT.md`](docs/archive/PRODUCTION-INCIDENT.md) — delivery history and the resolved production incident.

`info/plan.md`, `info/Challenge_1.md`, `info/clonefest.md`, and `info/PrivateBin/` are read-only references, not implementation contracts.

## Reproducible setup

Use Node `22.23.2`, Corepack, and committed `pnpm@10.15.1`:

```bash
python3 -m venv .venv
.venv/bin/python scripts/verify-reproducibility.py
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm validate
pnpm test:integration
pnpm supabase:test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:e2e:prod
pnpm test:a11y
```

The smoke script only checks health; it does not prove cryptographic or database behavior:

```bash
APP_URL=http://localhost:3000 scripts/demo-smoke.sh
```

## Judge demo

After the pre-freeze gate is green, demonstrate one end-to-end story: create a protected Markdown share with files, inspect the Privacy Receipt, show that a fragment alone cannot open a two-channel share, reveal with both factors, show release-window/veil behavior, cite concurrency evidence, revoke a second share, and finish with the uniform unavailable state and honest limitations. Use synthetic content only.

For handoff, send the repository URL, an exact reviewed commit, and [`docs/deployment.md`](docs/deployment.md). Never send environment files, provider secrets, capabilities, passwords, unlock codes, or real fragment URLs.

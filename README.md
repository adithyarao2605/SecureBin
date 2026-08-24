# SecureBin

SecureBin is an independently implemented, browser-encrypted platform for sharing notes, Markdown, code, and files. The browser owns encryption and decryption; the service stores ciphertext plus bounded lifecycle metadata and atomically enforces availability, expiry, revocation, and reveal limits.

It modernises the problem behind CloneFest 2.0's PrivateBin challenge without copying PrivateBin source, formats, templates, or visual identity.

## Release status

The complete pre-freeze implementation is present on `dev`, including lifecycle parity, strict parcels, upload recovery, cleanup retry, release-window veil behavior, local history, receipts, isolated self-host tooling, and the quiet-proof redesign. The local gate is green: 191 unit tests, 16 integration tests, 155 pgTAP assertions after a clean reset/replay, 19 development Playwright tests, 19 production-build Playwright tests, 7 Axe checks, nine reviewed route/state screenshots, reproducibility, dependency, and source/log audits all pass.

Production promotion, the newest remote database migration, and hosted cleanup verification remain owner-operated. Release-freeze work has not started.

## Why the design matters

- Content keys, passwords, unlock codes, filenames, and plaintext remain in the browser.
- Reveal limits and lifecycle state are database transactions, not UI claims.
- Optional two-channel unlock means the URL fragment alone is insufficient.
- Decrypted Markdown and attachments cross explicit safe-render boundaries.
- The product states its limits: a compromised browser can capture plaintext, recipients can save copies, and infrastructure can observe traffic metadata.

The UI contract is **quiet proof** with default dark mode: Linen, Ink, Mineral, Copper, and Mist; a Stitch-matched compact technical landing shell with high-contrast light and dark themes; one primary application surface plus a narrow evidence rail; a compact mobile status strip; and one restrained browser → sealed parcel → recipient proofline. It avoids cyberpunk decoration and never presents a visual as cryptographic evidence. See [`docs/SPEC.md`](docs/SPEC.md).

## Documentation

- [`history.md`](history.md) — consolidated record of all implemented features, cryptographic protocols, database functions, and testing evidence.
- [`bugs.md`](bugs.md) — active tracker for known visual, interaction, and editor issues.
- [`LAST_DAY.md`](LAST_DAY.md) — Day 7 release freeze plan, fresh-clone verification, and demo script.
- [`docs/architecture.md`](docs/architecture.md) — protocol, trust model, lifecycle state, schemas, APIs, diagrams, and residual risks.
- [`docs/SPEC.md`](docs/SPEC.md) — standing product and experience contract.
- [`docs/deployment.md`](docs/deployment.md) — fresh clone, local/self-hosted, preview, production, and owner handoff.
- [`docs/evidence.md`](docs/evidence.md) — reproducible test, concurrency, performance, and demo evidence.
- [`info/plan_v3.md`](info/plan_v3.md) — active roadmap and scope decisions.
- [`info/HANDOFF.md`](info/HANDOFF.md) — branch, validation, owner actions, and recent work.
- [`docs/archive/PRODUCTION-INCIDENT.md`](docs/archive/PRODUCTION-INCIDENT.md) — resolved production incident investigation.

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

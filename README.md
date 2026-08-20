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

The Day 1 text-sharing slice works end to end: the browser encrypts a plain-text
note, the API and database accept only ciphertext plus bounded policy metadata,
and the recipient authorizes a reveal before decrypting locally. Unit,
integration, browser, mobile-keyboard, and accessibility coverage exercise that
path. Markdown, passwords, two-channel unlock, files, and the Privacy Receipt
remain roadmap work. The current repository has no live demo URL.

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
pnpm test:e2e
pnpm test:a11y
```

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
| Reliability/demo | CI, unit/integration/browser tests, smoke script, deployment runbook | Local gates present; deployment pending |
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

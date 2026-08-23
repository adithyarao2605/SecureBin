# SecureBin Agent Guide

## Mission

Build a polished, reliable, independently implemented zero-knowledge sharing platform that maximizes the CloneFest rubric. Protect the working core, deployment, tests, accessibility, and judge demo before starting roadmap work.

## UX and visual direction

The product surface follows the **quiet proof** direction in
`docs/SPEC.md#experience-direction--quiet-proof`. Treat it as a public design
contract, not optional decoration:

- Use the light-first Linen `#F4F0E8`, Ink `#17242D`, Deep Slate `#2D4148`,
  Mineral `#2F7071`, Copper `#B86848`, and Mist `#DCE9E3` token family, with a
  warm, high-contrast dark counterpart. Never use neon green, matrix rain,
  hacker-terminal panels, shield/lock hero art, fake threat meters, or generic
  cyberpunk grids.
- Compose the experience as one primary content surface plus a narrow evidence
  rail; collapse the rail to a status strip on mobile. Avoid a dashboard made
  from interchangeable cards.
- Use one restrained **proofline** (browser → sealed parcel → recipient) as the
  signature visual. It explains the flow only; it never stands in for a
  cryptographic result or a server authorization decision.
- Prefer bundled/self-hosted display, body, and utility fonts with fallbacks;
  secret routes must remain free of remote font and media requests. Respect
  visible focus, semantic landmarks, keyboard/mobile use, contrast, and reduced
  motion.
- Keep copy active and honest: “Your browser encrypts this before it leaves the
  page.”, “Create share”, “Reveal once”, “Copy link”, and “Unavailable”. Do not
  claim unhackability or imply that a visual state proves more than the
  protocol actually knows.

## Sources of Truth

- `info/plan.md` defines product priorities and delivery order; `info/plan_v3.md`
  is the active implementation roadmap.
- `docs/architecture.md` defines protocol, trust boundaries, schemas, APIs, and lifecycle semantics.
- `docs/archive/PRODUCTION-INCIDENT.md` records the resolved 2026-08-21 production create incident and its investigation order; it is history, not an open blocker.
- Supabase migrations define the deployed database contract.
- `package.json` scripts define executable validation commands.

Update the documents in the same change whenever a public contract or security invariant changes.
The five-day SPEC plan (Days 1–5) is complete. `info/plan_v3.md` is the single active roadmap (landing page at `/`, app at `/new`, UI fixes, discussion edit/delete, batch status sync, rubric backlog; Day 6/7 detail stays in `docs/DAY-6-PLAN.md`/`DAY-7-PLAN.md`). Implement plan_v3 phase by phase with green gates between phases. Historical day plans and the resolved incident live in `docs/archive/`.
`info/plan.md` serves as product priorities reference; record any project decisions in `info/HANDOFF.md`.

## Reference Boundary

- Treat `info/PrivateBin`, `info/Challenge_1.md`, and `info/clonefest.md` as read-only reference material.
- Do not copy PrivateBin source, wire formats, templates, or visual identity.
- Preserve the challenge's underlying purpose while implementing SecureBin independently.

## Toolchain and Commands

Use the active Node LTS pinned by the repository and pnpm through Corepack. Do not introduce a second package manager or lockfile.

Create and use the repository-local Python virtual environment at `.venv` for Python tooling (`python3 -m venv .venv` when absent). Keep all setup reproducible from committed pins and lockfiles; never rely on unrecorded global packages. Validate fresh-clone setup with `pnpm install --frozen-lockfile`, and run `.venv/bin/python scripts/verify-reproducibility.py` before handoff.

Supported repository scripts:

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm test:e2e:prod
pnpm test:a11y
pnpm build
pnpm validate
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:test
pnpm local:setup
pnpm local
pnpm local:stop
```

Keep this list synchronized with `package.json`. Use `pnpm validate` as the final local gate.

## Non-Negotiable Security Invariants

- Encryption, decryption, key derivation, QR generation, and decrypted rendering happen in the browser.
- Never send or log plaintext, URL fragments, link secrets, passwords, unlock codes, deletion or upload-reservation capabilities, plaintext filenames, plaintext MIME types, or ciphertext bodies.
- Never reuse an AES-GCM nonce with the same key.
- Use Web Crypto and small reviewed wrappers. Never implement a cryptographic primitive manually.
- Derive independent object keys with the exact versioned HKDF labels in `docs/architecture.md`.
- Reject unknown envelope versions, fields, algorithms, parameters, sizes, and factor masks before cryptographic work.
- Any envelope-format change requires a version decision, architecture update, and golden compatibility vectors.
- Change reveal counts and lifecycle state only through atomic database functions.
- Keep Supabase service-role credentials and server-only environment variables out of client imports and bundles.
- Render decrypted content only through the approved plain-text, Markdown sanitizer, code, or safe-preview boundary.
- Secret routes must not load third-party scripts, analytics, embeds, fonts, or remote Markdown media.

## Data and API Rules

- Validate every external payload with shared strict schemas; reject unknown fields.
- Enforce limits on both client and server. Client validation is UX, not authorization.
- Store only HMACed network discriminators for rate limiting; never persist raw IP addresses.
- Use random Storage paths that contain no user filenames or content hints.
- Return the uniform recipient-facing `unavailable` state for missing, expired, exhausted, and revoked shares.
- Preserve idempotency for upload reservation, share creation, reveal, and deletion flows.
- A reveal counts a server authorization lease, not successful decryption or human viewing.
- Do not change RLS or grants without integration tests proving anonymous clients cannot read tables or private objects directly.

## Coding Rules

- Keep strict TypeScript enabled. Avoid `any`, non-null assertions, silent catches, and unchecked type casts.
- Keep browser-only crypto modules separate from server-only database and credential modules.
- Prefer pure functions for envelope encoding, validation, policy summaries, and state transitions.
- Use UTC in persistence and localized presentation at the UI boundary.
- Keep dependencies minimal. Document why each security-sensitive production dependency is necessary.
- Do not add speculative abstractions or roadmap infrastructure to the judged-release path.
- Preserve user changes and inspect the current diff before editing.
- Never commit secrets, generated credentials, local Supabase state, test artifacts, or decrypted fixtures.

## Agent Workflow and Handoff

- Use subagents for bounded parallel work when it helps. Subagents must use `gpt-5.6-luna` with medium or high reasoning effort. Record delegated work and its outcome in `info/HANDOFF.md`.
- Make frequent, coherent Conventional Commits as work progresses so GitHub history shows the implementation sequence. Keep commits small enough to validate and review; never commit broken checkpoints merely to increase commit count. Push to the configured GitHub remote when credentials and network access are available.
- Update `info/HANDOFF.md` at the end of every run with completed work, current validation results, remaining work, blockers, and the latest relevant commits.
- Treat `info/plan.md` as a read-only planning reference: never modify or move it, and do not re-stage incidental changes to it.
- Keep every `main` CI run as a completed audit record. CI may cancel a
  superseded pull-request run, but it must queue rather than cancel pushed
  `main` commits.
- Deployment is an owner-operated step unless the user explicitly delegates
  it. For a friend handoff, share the repository URL, exact commit, and
  `docs/deployment.md`—never an `.env` file, provider credential, fragment URL,
  password, unlock code, or deletion capability. Record the recipient, commit,
  validation state, and remaining owner actions in `info/HANDOFF.md`.

## Verification by Change Type

- **Crypto:** run unit tests, wrong-factor/tamper tests, nonce checks, and golden vectors.
- **Database or policy:** run migrations from a clean reset, integration tests, RLS tests, and concurrency tests.
- **API:** test schemas, size limits, authorization, rate limiting, idempotency, and uniform failures.
- **UI:** run the primary Playwright flow, mobile viewport, keyboard flow, and axe checks.
- **Attachments:** test encrypted upload, object-size validation, reveal lease retry, safe preview, download, and cleanup.
- **Documentation or public behavior:** synchronize `docs/architecture.md`, README, `docs/SPEC.md`, and submission evidence without modifying or committing `info/plan.md`.

Run the smallest relevant checks while iterating and `pnpm validate` before handoff.

## Definition of Done

- Requested behavior works through the production-shaped path, including failure states.
- Lint, typecheck, relevant tests, and production build pass.
- Security-sensitive changes include regression tests.
- No secrets, unsafe logs, debug code, dead prototypes, or unrelated generated files appear in the diff.
- Public contracts and environment variables are documented.
- The default demo flow remains stable and understandable without developer intervention.

## Code Review Rules

Flag and fix:

- Plaintext or secret material crossing the browser/server boundary.
- AES-GCM nonce reuse or missing domain separation.
- Non-atomic reveal, expiry, or revocation changes.
- Direct anonymous database or Storage access.
- Service-role credentials reachable from client code.
- Unsafe Markdown, HTML, SVG, MIME, or attachment rendering.
- Unbounded payloads, KDF parameters, timestamps, or counters.
- Logs or errors containing secret URLs, tokens, content, or ciphertext bodies.
- New features that destabilize core reliability, accessibility, deployment, or the judge demo.

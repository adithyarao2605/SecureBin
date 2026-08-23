# SecureBin five-day delivery specification

This document turns the repository’s product, architecture, security, and
CloneFest reference material into a five-day execution plan. It is an
implementation schedule, not a second protocol specification: the technical
contracts remain in `docs/architecture.md`, database behavior remains in the
Supabase migrations, and product priorities remain in the read-only
`info/plan.md` reference.

## North star

Deliver a judge-ready, independently implemented zero-knowledge sharing
platform. A sender can create a controlled share without an account; the
browser encrypts the content; the service stores only ciphertext and bounded
lifecycle metadata; and a recipient can authorize and decrypt the share in
their own browser.

The five-day scope is deliberately staged. The core path, policy correctness,
security boundaries, accessibility, deployment, and evidence take priority
over breadth. Features that cannot be implemented and tested completely stay
clearly marked as future work.

## Progress snapshot

Days 1 through 5 are implemented and fully green across local gates: reproducible tooling, multi-mode browser encryption (plain note, sanitized Markdown, and syntax-highlighted code with binary `SBCT` framing), encrypted attachments up to five files per share with staged reservations, drag-and-drop, safe previews, and Download-all ZIP, atomic database lifecycle policy with upload reservations and a rotation cleanup queue, clean local history desk, password factors (PBKDF2-HMAC-SHA-256 at 600,000 iterations), two-channel unlock codes (27-character Crockford codes with check symbol), custom reveal counts (1–100), "Never" expiry, Markdown Edit/Split/Preview authoring, code mode with local language detection, encrypted discussions with lifecycle inheritance, QR + native share + email actions, the Privacy Receipt with ciphertext fingerprint, the pre-flight "What will SecureBin see?" disclosure, production build, 145 unit tests (21 files), 14 live concurrency/integration tests, 115 pgTAP database tests (7 files), 10 Playwright E2E tests, and 2 Axe accessibility tests.

The production incident is closed.

Scope reconciliation: SPEC Day 4 shipped exactly as planned. Where this SPEC's Day 5 called only for polish, validation, deployment, and demo evidence, the implementation also deliberately delivered `info/plan_v2.md` §3 (custom reveal counts, "Never" expiry, presets, rich Markdown authoring, code detection, multi-file attachments, encrypted discussions) after the Day 4 factors were green. That decision is recorded in `info/HANDOFF.md`, and this SPEC's former
preset-only restriction is retired with it. `info/plan_v2.md` Days 6–7 remain gated future work behind the Day 6 entry gate in [`DAY-6-PLAN.md`](DAY-6-PLAN.md).

When another maintainer or friend continues the schedule, hand them the exact commit and [`docs/deployment.md`](deployment.md), have them reproduce the gates from a fresh clone, and exchange provider access through team membership rather than copied secrets.

## Experience direction — quiet proof

SecureBin should feel like a calm evidence desk for sharing something sensitive,
not like a hacker terminal. The audience is a person sending an ordinary note,
snippet, or file who needs to understand two things quickly: what happens in
their browser, and what the service can still see. The primary job of the
surface is to complete a share or reveal without making security claims the
interface cannot prove.

### Visual system

- **Palette:** light-first Linen `#F4F0E8` for the canvas, Ink `#17242D` for
  text, Deep Slate `#2D4148` for quiet panels, Mineral `#2F7071` for actions
  and focus, Copper `#B86848` for the one accent and attention states, and Mist
  `#DCE9E3` for confirmed local states. Dark mode uses Deep Ink `#11242A` and
  warm Mist `#ECF1EB` rather than a black/neon reversal. Every status also has
  text and an icon or shape; color is never the only signal.
- **Typography:** use a self-hosted, bundled display face such as Bricolage
  Grotesque for short headings, Atkinson Hyperlegible for body and controls,
  and IBM Plex Mono for compact receipt labels and technical values. Provide
  deliberate system fallbacks if the bundled faces are unavailable. No remote
  font request is allowed on a secret route.
- **Layout:** use one large primary compose/reveal surface with a narrow
  evidence rail, rather than a grid of interchangeable cards. On desktop the
  rail carries lifecycle state and the main surface carries the content/action;
  on mobile the rail becomes a short status strip above the surface. Keep
  controls close to the content they affect and leave generous quiet space.

```text
desktop  [ proofline / state rail ] [ one compose or reveal surface       ]
                                   [ one action row + receipt              ]
mobile   [ proofline + state ]
         [ one primary surface ]
         [ one action row ]
```

- **Signature element:** the **proofline** is a single fine route-like line
  with three square evidence nodes—browser, sealed parcel, recipient—used on
  the primary surface and receipt. It is a restrained nod to data movement,
  not a circuit-board background. The proofline is never a cryptographic proof
  or an authority signal; its labels and state are always accompanied by plain
  text.
- **Motion:** one short 150–220ms seal/reveal transition may draw the
  proofline when a real local state changes. Do not add looping glows, glitch
  effects, matrix rain, or decorative progress meters. Respect
  `prefers-reduced-motion` by removing the transition while retaining the
  state change.

### Interface language

Use plain, active, user-facing copy: “Your browser encrypts this before it
leaves the page.”, “Create share”, “Reveal once”, “Copy link”, and “Unavailable”.
Explain what is visible as “The service stores a sealed parcel and limited
policy metadata.” Avoid “unhackable”, “military-grade”, fake threat scores,
and unexplained protocol jargon in primary actions. The unavailable state stays
uniform for missing, expired, exhausted, and revoked shares; recovery guidance
may explain the next safe action without guessing which condition occurred.

This direction is a release requirement for the UI, copy, screenshots, and
demo evidence. It is intentionally distinct from PrivateBin and must not turn
security controls into decorative cyberpunk styling.

## Non-negotiable release rules

- Keep the implementation independent. Use the challenge and nested
  PrivateBin checkout only to understand the underlying problem. Do not copy
  PrivateBin source, wire formats, templates, or visual identity.
- Keep the URL secret in the fragment. Plaintext, content keys, passwords,
  unlock codes, filenames, plaintext MIME types, capabilities, and ciphertext
  bodies must not appear in server logs, analytics, database columns, or
  client-to-server metadata except where the encrypted envelope contract
  explicitly requires ciphertext.
- Perform key generation, KDFs, encryption, decryption, QR generation, and
  decrypted rendering in the browser using Web Crypto and reviewed wrappers.
  Use fresh AES-GCM nonces, exact versioned HKDF labels, strict envelope
  validation, and golden compatibility vectors.
- Enforce availability, expiry, revocation, reveal limits, idempotency, and
  cleanup through atomic server/database operations. A reveal is a server
  authorization lease for ciphertext, not proof that a human decrypted it.
- Keep service-role credentials and server-only configuration out of browser
  imports and bundles. Keep Storage private, paths random, schemas strict,
  limits bounded, and recipient failures uniform (`unavailable`).
- Render only through the approved plain-text, sanitized Markdown, code, or
  safe-preview boundary. Secret routes load no third-party scripts, fonts,
  embeds, analytics, or remote media.
- Use the pinned Node LTS and Corepack-managed pnpm. Keep the committed lockfile
  authoritative, use the repository-local Python virtual environment for the
  reproducibility check, and never add a second package manager or lockfile.
- Keep changes reviewable and commit coherent slices frequently. Every run
  leaves an update in `info/HANDOFF.md`; that file and all reference material
  under `info/` are maintained without changing the read-only planning source
  `info/plan.md`.

## Five-day work plan

### Day 1 — Foundation and a production-shaped text slice

**Outcome:** a fresh clone can install deterministically and exercise
compose → browser encrypt → store → status → reveal → browser decrypt for a
plain-text share.

**Build**

- Confirm the Node, pnpm, TypeScript, Next.js, Supabase, and Playwright pins;
  make `pnpm install --frozen-lockfile`, Corepack setup, and the repo-local
  `.venv` reproducibility check work from a clean checkout.
- Establish the App Router shell from the **quiet proof** direction above:
  design tokens, the proofline, light/dark/system themes, mobile layout,
  semantic landmarks, focus states, honest state copy, reduced motion, and a
  health endpoint.
- Implement the v1 browser-only AES-256-GCM text envelope: random public ID,
  fragment link secret, nonce, HKDF salt, canonical AAD, strict fields and
  sizes, and fail-closed malformed/tampered input handling.
- Implement the minimum strict API and database path for create, status, reveal,
  and delete. Store only ciphertext and policy metadata; keep server modules
  separate from browser crypto modules.
- Add CSP/security headers, no-store behavior, safe redacted errors, and a
  judge-readable README/deployment runbook.

**Evidence gate**

- Unit tests cover Unicode round trips, wrong keys, tampering, unknown fields,
  canonical encoding, nonce rules, size limits, and a golden vector.
- Integration tests prove strict API mapping and that plaintext or fragments
  do not cross the boundary.
- Chromium tests cover the main flow; axe and keyboard/mobile tests cover the
  composer and viewer.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`,
  `pnpm build`, and the reproducibility script pass.
- Commit the foundation and text vertical slice separately if they are
  independently reviewable; record the exact commits and remaining gaps in
  the handoff.

### Day 2 — Lifecycle policy, concurrency, and operational correctness

Detailed execution: [`DAY-2-PLAN.md`](DAY-2-PLAN.md) and
[`DAY-2-UI.md`](DAY-2-UI.md).

**Outcome:** access policy is server-enforced and remains correct under
retries, simultaneous requests, and lifecycle races.

**Build**

- Finish the policy model for scheduled availability, expiry, one/three/five/
  ten/unlimited reveals, burn-after-opening, revocation, and idempotent create
  and delete.
- Use atomic RPCs/transactions for reveal leases and counters. A retry with
  the same client token receives the same active lease without incrementing;
  distinct concurrent requests cannot exceed the configured limit.
- Add rate limiting per operation using only an HMACed network discriminator,
  strict request-size/field validation, uniform unavailable responses, and
  safe request IDs/status/latency/coarse-size logging.
- Complete staged upload reservation and cleanup primitives for encrypted
  objects, while keeping Storage private and object paths content-free.
- Add migration reset/seed tests, RLS/grant tests proving anonymous clients
  cannot read tables or private objects, and race tests for reveal vs expiry or
  revocation.

**Evidence gate**

- Clean Supabase reset plus pgTAP/integration tests pass.
- Twenty concurrent requests yield exactly one success for a one-reveal share
  and exactly three for a three-reveal share.
- Idempotent retries, invalid deletion capabilities, scheduled/expired/
  revoked states, abandoned uploads, and cleanup are covered.
- API and database changes are committed as a coherent slice, then the
  handoff records migration names, test commands, and any environment blocker.

### Day 3 — Content breadth and safe encrypted attachments

Detailed execution: [`DAY-3-PLAN.md`](DAY-3-PLAN.md).

**Outcome:** the core share supports the judged content types without weakening
the zero-knowledge boundary.

**Build**

- Add plain text, sanitized Markdown, and syntax-highlighted code modes with
  bounded UTF-8 input. Parse and sanitize only after local decryption; reject
  XSS payloads and unsafe HTML/Markdown media.
- Add one encrypted file per share, bounded to the documented plaintext limit.
  Encrypt file bytes, filename, and MIME metadata in the browser; send only
  the encrypted envelope/reference and declared bounded sizes.
- Implement private Storage upload reservation, random object paths, signed
  short-lived operations, overwrite protection, actual-size verification,
  attachment linking, retry-safe reveal download, and orphan cleanup.
- Add safe image/plain-text previews and a download path for other formats.
  Never infer trust from a client MIME declaration and never expose plaintext
  filenames or MIME types to infrastructure.
- Lazy-load editor, highlighting, Markdown, QR, and preview code only where
  needed; measure whether file encryption needs a Worker.

**Evidence gate**

- Crypto vectors cover text, Unicode, Markdown, code, and binary content;
  content/file keys differ and every object has a fresh nonce.
- File tests cover size rejection, encrypted upload, object-size validation,
  safe preview/download, reveal lease retry, failed upload recovery, and
  cleanup without harming active shares.
- Browser tests cover create/reveal for each content mode and malformed or
  unsafe rendered input.
- Commit content and attachment work separately when possible; update the
  handoff with what is implemented versus deliberately deferred.

### Day 4 — Meaningful differentiation, UX completeness, and hardening

**Outcome:** the project tells a compelling, verifiable security story and
handles the non-happy paths judges will try.

**Build**

- First, complete the pre-implementation UI stabilization from the T1 scope
  (§0.A–D): full-viewport application shell, View Share polish parity with
  Create, header/navigation rendering consistency across refreshes and direct
  navigation, hydration/theme-flash fixes, and stable lazy-load fallbacks. If
  this pass shows the design itself is insufficient, a scoped UI redesign is
  in-scope (and again at Day 6), within the quiet-proof direction.
- Add optional browser-native PBKDF2 password protection with bounded input
  and exact supported parameters. Add two-channel unlock with an independent
  readable code, separate-channel guidance, factor-mask domain separation,
  and tests proving either component alone cannot decrypt.
- Add Privacy Receipt output describing browser encryption, protected
  material, lifecycle policy, ciphertext fingerprint/algorithm details, and
  metadata still visible to infrastructure—without exposing secrets.
- Add QR, copy-link, native-share, email-client, raw-text, and download
  actions with accessible fallbacks and no secret leakage.
- Complete loading, offline, malformed-link, wrong-factor, wrong-key,
  scheduled, retry, refresh, double-submit, unavailable, and network-failure
  states. Preserve only an unsent in-memory draft during recoverable failures.
- Apply the quiet-proof layout and proofline consistently across composer,
  viewer, receipt, and error states; use one clear action per state and keep
  security language specific and verifiable.
- Review CSP, HSTS, `no-store`, `nosniff`, frame denial, referrer and
  permissions policies, dependency minimization, bundle boundaries, and logs.
  Add manual keyboard/screen-reader review alongside axe.

**Evidence gate**

- Browser, unit, integration, and security tests cover every newly exposed
  path, including Markdown XSS rejection and factor failure behavior.
- A reviewer can trace each public contract to `docs/architecture.md`, the
  migration, the tests, and the threat model.
- The demo path is stable on desktop and mobile; all work is committed before
  the final polish day.

### Day 5 — Polish, validation, deployment, and demo evidence only

**Outcome:** a stable, judge-ready release candidate. Day 5 adds no new
product capability, protocol feature, schema feature, or roadmap item.

**Polish and verify**

- Run the complete gate from a clean checkout: Corepack/pnpm frozen install,
  repo-local Python reproducibility check, lint, typecheck, unit,
  integration, Supabase reset/tests, production build, Playwright Chromium
  flow, mobile/keyboard flow, axe checks, and smoke check.
- Measure deployed performance, including representative mobile LCP, bundle
  loading, and documented file-size limits. Fix only regressions, accessibility
  defects, unsafe states, copy clarity, layout issues, and release blockers.
- Review the light/dark surfaces, proofline states, typography fallbacks,
  focus visibility, reduced-motion behavior, and mobile status-strip layout in
  the actual deployment. Remove any accidental neon, terminal, or decorative
  security theatre before the demo.
- Verify environment variables, server-only boundaries, CSP, deployment
  configuration, cron/cleanup scheduling, health checks, migration order,
  redacted logs, and rollback instructions against a fresh deployment.
- Rehearse the 60–90 second judge flow: create a protected share, show the
  receipt and ciphertext-only record, demonstrate two-channel separation,
  prove reveal-limit/concurrency behavior, revoke another share, and show
  the uniform unavailable result.
- Update README, deployment instructions, threat model, architecture diagrams,
  rubric evidence, known limitations, and `info/HANDOFF.md` with exact test
  results, deployment URL if available, commit range, and demo script.
- Make final small commits for documentation, release configuration, and
  evidence. Do not squash away the regular implementation history. Tag or
  identify the release commit for submission and verify the GitHub repository
  contains no secrets, generated credentials, decrypted fixtures, local
  Supabase state, or ignored `info/plan.md` changes.

**Final gate**

`pnpm validate` is green, the deployed demo is reachable, the primary flow is
rehearsed, all rubric evidence is linked, and all known limitations are honest.
If a required feature or deployment is still incomplete, document it in the
handoff and README rather than silently presenting roadmap work as shipped.

## Explicitly deferred

Recipient-bound accounts/passkeys, Secure Rooms, device-key management, localization, service-worker caching, alternate storage adapters, SDKs/extensions, interoperability import, Argon2id, padding, key transparency, sender signatures, and richer traffic-analysis defenses are future roadmap work. They must not destabilize the judged release and must never be represented as implemented in the demo or submission evidence. Encrypted discussions, custom reveal counts, "Never" expiry, multi-file attachments, code auto-detection, and the Day 4 factor work are no longer deferred: they are implemented and tested as recorded above.

`info/plan_v2.md` continues past this point with its Days 4–7 (§3 shipped deliberately; §4–§6 remain). That plan is a read-only roadmap source: its remaining scope starts only through [`DAY-6-PLAN.md`](DAY-6-PLAN.md) once the Day 5 exit gate is green, followed by the Day 7 freeze.

## Per-day handoff checklist

At the end of every run, update `info/HANDOFF.md` with:

- date, current commit, and the day/phase completed;
- files or contracts changed, with security/public-contract notes;
- commands run and pass/fail results;
- known blockers, deferred work, and any environment assumptions;
- the exact next starting task and whether a clean migration/install was used.

The handoff is operational state, not a substitute for architecture or tests.
Never place secrets, plaintext share contents, URL fragments, passwords,
unlock codes, capabilities, or decrypted fixtures in it.

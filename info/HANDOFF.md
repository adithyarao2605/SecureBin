# SecureBin handoff

Updated: 2026-08-25 (UTC)

## CI attachment and selector hardening

- Increased the first real attachment reveal assertions to a 30-second budget
  because the cold path includes signed Storage download and browser-side file
  decryption before content is mounted.
- Made the visual-contract parcel selector exact so `Open parcel` cannot match
  the separate `Open Parcel Utility` button in the documentation panel.
- `pnpm validate` passes with 214 unit tests, lint, typecheck, source audit,
  and production build. Playwright lists all 19 development tests; browser
  execution remains CI-only in this workspace.
- No push was performed.

## CI browser-contract refresh

- Updated the landing E2E assertion to match the intentional external
  `self_hosting.md` link and its new-tab behavior.
- Updated the visual-contract test to use the current `Open parcel` utility
  label and the protected-share test to read the current semantic `.unlock-code`
  result element.
- `pnpm validate` passes with 214 unit tests, lint, typecheck, source audit,
  and production build. Both development and production Playwright configs
  enumerate all 19 tests; Chromium execution remains CI-only in this
  workspace because the pinned browser binary is unavailable locally.
- No push was performed.

## Landing capability tile polish

- Scoped the Technical Capabilities tile styling to direct child items so the
  nested checkmark glyph no longer receives its own border and rounded box.
  The outer capability tiles remain unchanged.
- `pnpm validate` passes with 214 unit tests, lint, typecheck, source audit,
  and production build. No push was performed.

## README focus update

- Removed the release checklist, deferred-scope inventory, and contribution
  rules from the public README as requested. The README now ends with the
  evaluation evidence map and repository map, keeping implementation and
  judge-facing product information prominent.
- Removed the corresponding table-of-contents links and confirmed the edited
  Markdown passes `git diff --check`.

## Test and revoked-history polish update

- Replaced the reveal-window E2E test's fixed 10.5-second sleep with a wait on
  the actual user-visible closed-window state, leaving the browser timer room
  to complete on a busy CI runner.
- Replaced date-of-run-looking integration fixtures with named far-future
  constants so the RPC mapping suite remains deterministic as the calendar
  advances.
- Preserved the sender-local `revoked` history label across recipient-facing
  `unavailable` status refreshes. Removing that revoked row now reloads the
  workspace; ordinary local-history removal remains in place. Added two unit
  regressions for the merge and reload behavior.
- `pnpm validate` passes with 214 unit tests, lint, typecheck, source audit,
  and production build. The targeted history suite passes (13 tests), and the
  share-service mapper suite passes (6 tests).
- `pnpm test:integration` still runs the mapper suite locally, while cleanup,
  reveal-concurrency, and upload-service require Supabase credentials that are
  supplied by CI after `supabase start`. Playwright lists all 19 E2E tests and
  7 accessibility tests; browser execution was not rerun locally because the
  managed workspace lacks the pinned Chromium executable.
- No push was performed. Implementation commit: `0cdce55`.

## Friend-owned security/lifecycle takeover

- Tightened the recipient reveal contract at both server and browser
  boundaries: attachment rows now require exact fields, valid encrypted file
  envelopes, owned Storage paths, bounded ciphertext sizes, unique slots
  `0–4`, valid timestamps, and safe HTTP(S) signed URLs. All attachment
  metadata is validated before any signed URL is requested.
- Tightened encrypted discussion response parsing: comment rows now require
  exact fields, UUID relationships, valid timestamps, strict encrypted
  envelopes, and unique comment ids. Mutation responses are also strict.
- Made cleanup fail closed on malformed candidate/result RPC payloads instead
  of silently filtering rows and potentially calling an unscoped finalizer.
- Added 19 regression tests. `pnpm test` passes with 212 tests; typecheck,
  lint, build, and diff checks pass. The environment-backed integration
  command ran the six share-service tests but the three Supabase-backed suites
  require credentials that are not present in this workspace.
- No production migration or deployment was performed. The owner still needs
  to push commit `9ba6b4f` and verify the hosted migration and cleanup schedule.

## Code authoring polish update

- Added Code-mode Edit, Split, and Preview views using the existing browser-only
  `lowlight` renderer and language registry. The textarea remains the source of
  truth; the preview is read-only and does not alter the encrypted payload.
- Added responsive stacked preview behavior, keyboard-operable view tabs,
  language-aware line numbers, an empty-preview state, and clearer light/dark
  semantic token colors.
- Updated README and in-product documentation to describe the authoring
  preview accurately. The unit baseline is now 193 tests.
- Validation: lint, typecheck, full unit suite (193 tests), targeted rendering
  suite (25 tests), production build, and diff checks pass.
- This Code-mode batch is committed as `51f65eb` and is ready for owner review
  before pushing.

## Competitive presentation polish update

- Reorganized the existing share-result surface into a sender workflow:
  delivery, second-channel factors, sealed-material proof, offline parcel,
  transport options, and sender controls.
- Added an honest recipient policy strip before reveal and a four-step proof
  path to the in-product documentation center so the current depth is visible
  during a short evaluation.
- Added a README evidence map linking observable product surfaces to the
  existing crypto, lifecycle, parcel, browser, accessibility, and CI evidence.
- Reset the copy status when starting another share and added composer UI
  assertions for the result-card proof surface.
- Validation: lint, typecheck, full unit suite (193 tests), targeted composer
  suite, production build, and diff checks pass. Local Playwright could not
  launch because the managed environment lacks the pinned Chromium executable;
  no browser assertion reached the application.
- This presentation batch is committed as `aa7ab13` and is ready for owner
  review before pushing.

## UI polish update

- Repaired local-history status badge styling so active, scheduled, checking,
  revoked, and unavailable states receive the intended quiet-proof treatment.
- Improved narrow-screen history metadata wrapping and added a visible retry
  action when an encrypted discussion cannot load.
- Clarified the viewer heading boundary: unopened shares are labelled
  `Protected share`, while `Decrypted share` appears only after local
  decryption. Discussion threads now expose their client-encrypted boundary,
  loading state, and a clear cancel-reply path.
- This pass stayed in UI components and styles; friend-owned lifecycle,
  attachment, API, migration, and cryptographic files were not changed.
- Validation: `pnpm lint`, `pnpm typecheck`, `pnpm test` (191 tests),
  `pnpm build`, and `git diff --check` all pass.

## UI Harmonization Update

- Reverted `app/styles/landing.css` to restore the original, preferred landing page design language.
- Harmonized `/new` workspace and its subviews (`base.css`, `composer.css`, `history.css`, `receipt-actions.css`, `viewer.css`) to match the landing page's floating pill navigation header, pill action buttons, monospace uppercase metadata badges, and refined surface card styling.
- Terminated running background dev server (`pnpm dev`).
- Local validation suite: `pnpm validate` (191 unit tests, TypeScript typecheck, ESLint, source audit, and Next.js production build) all passed with zero errors.

## Pre-freeze remediation update

- Delegated Luna audits covered backend lifecycle/upload recovery, UI/accessibility, CI, documentation, and the final diff. `backend_remaining_build`, `history_composer_build`, and `viewer_parcel_build` completed bounded implementation slices; the read-only backend, UI, browser-failure, documentation, and `final_diff_review` audits supplied and verified the remaining review list. The final review found no security or retained-requirement regression.
- Added forward migration `20260901000000_pre_freeze_lifecycle_uploads.sql` for lifecycle parity, idempotency, unlock-only creation, and upload recovery.
- Rebuilt the public landing route and header against the supplied Stitch technical-split screenshot while retaining truthful SecureBin copy, verified local commands, real routes, bundled assets, responsive behavior, and WCAG AA contrast.
- Local verification: clean migration reset/replay passed; pgTAP passed (155 assertions); integration passed (16 tests); `pnpm validate` passed (191 unit tests plus lint, typecheck, and production build); development and production-build Playwright passed (19 each); Axe passed (7 checks, zero serious/critical findings); nine desktop/mobile/light/dark/reduced-motion screenshots were reviewed; reproducibility, dependency, and source/log audits passed.
- Remaining owner work: apply the remote migration, promote the reviewed commit, and verify the hosted cleanup schedule and production smoke path.

## Current state

- Branch: `main`, six commits ahead of `origin/main`; no push was performed.
- Pre-freeze implementation and its complete local gate remain green; the
  latest security/lifecycle batch is committed as `9ba6b4f` and awaits the
  owner's push/hosted verification.
- Required work is consolidated in `docs/before-day-7.md`; Day 7/release-freeze work has not begun.
- The user's existing uncommitted `app/page.tsx` change was preserved.
- Do not claim a hosted deployment until the owner verifies the remote migration, production promotion, cleanup schedule, and smoke path.

## Current core validation

- `pnpm validate`: pass — 214 unit tests plus lint, source audit, typecheck, and production build.
- `pnpm test:integration`: 6 share-service tests pass; cleanup, reveal-concurrency,
  and upload-service suites require Supabase credentials not present locally.
- `pnpm supabase:reset` followed by `pnpm supabase:test`: 155 pgTAP assertions pass.
- `pnpm audit:prod` and `pnpm audit:source`: pass.
- `pnpm test:e2e`: 19 pass (Chromium).
- `pnpm test:e2e:prod`: 19 pass (Chromium production build).
- `pnpm test:a11y`: 7 pass; zero serious or critical Axe findings.
- Visual review: 9 screenshots pass across major routes/states, 320/390 px mobile, light/dark, and reduced motion.
- `.venv/bin/python scripts/verify-reproducibility.py`: pass.

## Latest implementation commits

- `0cdce55` — `fix(ui): refresh revoked history removal and CI tests`
- `9ba6b4f` — `fix(security): harden response and cleanup contracts`
- `51f65eb` — `feat(ui): add live code authoring preview`
- `4258a92` — `feat(ui): polish viewer discussion and history states`
- `e4f7fa0` — `fix(security): close lifecycle gaps`
- `9b4104d` — `feat(ui): unify quiet-proof experience`
- `9895544` — `ci: harden reproducible release gates`

Documentation synchronization follows these implementation commits. Historical
commit messages remain unchanged; no history rewrite was performed. Remote push
and CI state must be recorded after they are verified.

The results include the pre-freeze regression additions. The local release
gate is closed green; hosted evidence remains owner-operated.

## Resolved pre-freeze audit findings

- Forward lifecycle/upload migration and regression coverage now enforce retry leases, closed-window parity, unlock-only creation, complete idempotency, attachment cleanup retry, and lost-response upload recovery.
- Envelope v2/HKDF labels, factor-mask/file/content vectors, canonical unlock format, strict discussion/parcel validation, and language IDs are frozen in code and tests.
- Release-window countdown/hide cleanup, parcel restore, Markdown/code modes, searchable picker, keyboard tabs, confirmations/fallbacks, receipt print, evidence rail, and isolated production-shaped self-host scripts are implemented.
- Discussion diagnostics and proxy trust are redacted/configured; source and dependency audits pass.

See `docs/before-day-7.md` for exact fixes and regression requirements.

## Documentation consolidation

Three delegated read-only audits mapped references, checked code/document contracts, and reviewed judge/rubric clarity. Outcome:

- merged threat model, diagrams, and policy state into `docs/architecture.md`;
- merged self-hosting into `docs/deployment.md`;
- merged validation, concurrency, performance, and demo material into `docs/evidence.md`;
- summarized historical day plans in `docs/archive/history.md` while retaining the production incident;
- retained the separately requested pre-freeze checklist and final freeze plan;
- removed the superseded plan v2 and standalone Day 6 plan from the active set; exact snapshots remain under `docs/archive/legacy/`.

The supplied Stitch export was reviewed read-only. `docs/UI-REDESIGN.md` is now the implementation contract for the UI gate: it preserves the current route topology and application palette, makes light-first quiet proof the default, keeps OLED treatment to the landing's dark counterpart, and excludes fictional API/Docker content, activity receipts/acknowledgment, named policy presets, unsupported discussion formatting, and nonexistent product routes.

## Owner actions

1. Complete and validate the pre-freeze plan on `dev`.
2. Verify the hosted migration list; apply missing forward migrations only after local reset/pgTAP/integration proof.
3. Verify cleanup scheduling and provider environment separation.
4. Review the preview, then promote the exact reviewed commit to `main` and redeploy.
5. Record production URL, SHA, timestamps, migration IDs, checks, browsers, and synthetic demo result here without secrets.

## Scope decisions

- Defer Secure Drop, recipient acknowledgment, and ciphertext-size padding.
- Keep envelope v2 and deployed v2 HKDF labels during remediation.
- Keep current 27-character/124-random-bit unlock format and correct documentation/tests.
- Preserve language IDs `0–8`; append IDs `9–20` only with vectors and cached-client incompatibility documented.
- Commit subjects are Conventional Commits without day numbers.

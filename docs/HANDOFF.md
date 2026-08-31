# SecureBin release record

Updated: 2026-08-31 (UTC)

## Current release maintenance pass

- Preserved the sender result-card and security-flow mobile fixes: optional
  sections now number consecutively, and the `+` control stays on the summary
  row at narrow widths.
- Added the released-product manual QA matrix at
  [`docs/feature-checklist.md`](feature-checklist.md) and linked it from the
  README, deployment, evidence, self-hosting, and in-product documentation.
- Prepared a dependency candidate containing the seven Dependabot updates,
  the Next.js 16 `proxy.ts` migration, flat ESLint compatibility, and a split
  CI workflow. Static gates pass locally: frozen install, lint, typecheck,
  217 unit tests, source audit, dependency audit, and production build.
- Local database, integration, development-browser, production-browser, and
  accessibility execution remains blocked by this host's Docker socket
  permission (`/var/run/docker.sock`); no result is reported as passed here.
- Delegation outcome: the CI audit subagent recommended independent static,
  database, development-browser, production-browser, and accessibility jobs;
  that workflow split was applied. The documentation audit subagent could not
  start because its isolated shell was unavailable, so no delegated doc edits
  were accepted from it.
- No remote push has been made for this maintenance pass. The candidate must
  complete CI before it is merged into the release branch.

## Final submission documentation cleanup

- Removed completed planning, redesign, and incident documents; retained the
  architecture, evidence, deployment, self-hosting, and history records.
- Consolidated history in `docs/history.md` and updated README, agent guidance,
  deployment, architecture, evidence, and reproducibility references.
- Delegated a read-only documentation-reference audit to a `gpt-5.6-luna`
  subagent; its findings were applied before validation.

SecureBin is released at `https://secure-bin.vercel.app`. This document keeps
the final release evidence and historical implementation notes; older entries
below are retained as history and do not describe an active development state.

## Documentation layout pass

- Moved the expanded self-hosting runbook to `docs/self-hosting.md` and kept
  the implemented capability record in `docs/history.md`.
- Removed the superseded `docs/bugs.md` tracker after the documentation update
  from the current maintainer branch; no replacement tracker is advertised.
- Removed completed planning checklists; final verification and demo evidence
  are retained in `docs/evidence.md`.
- Updated the landing page, in-product documentation link, README, E2E
  expectation, and historical cross-references to the current paths.
- Kept `README.md`, `LICENSE`, `SECURITY.md`, and `AGENTS.md` as the standard
  entry points for the final submission.
- No product behavior, cryptography, database contract, or feature scope was
  changed. `new_plan_final.md` remains intentionally untracked and untouched.
- Documentation link checks, lint, typecheck, unit tests, source audit, and
  production build remain the relevant validation gates; no push was performed.

## Documentation and repository hygiene pass

- Synchronized the README, evidence record, architecture, deployment runbook,
  self-hosting guide, visual contract, history record, and final checklist with
  the current dark-first implementation.
- Added a concise documentation index, corrected stale validation claims,
  named the latest lifecycle cleanup migration, and removed the implication
  that `vercel.json` already configures a cleanup scheduler.
- Added repository metadata for GitHub, the live application, and issue
  reporting. No product behavior, cryptography, database function, or feature
  scope was changed.
- Refined the README with compact reviewer entry points, an evaluation-at-a-
  glance table, an architecture summary, and a documentation index inspired by
  the repository's strongest review flow.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (217 tests), and `pnpm build`
  pass. `new_plan_final.md` remains intentionally untracked and untouched.
- Supabase replay, environment-backed integration tests, and browser/Axe
  execution remain CI/owner-hosted checks. No push was performed.

## Dark default theme

- Restored dark mode as the first-visit/default theme across the pre-hydration
  layout and theme toggle. Explicitly choosing light mode remains supported and
  persists locally.
- Updated the visual-contract E2E expectations and the architecture wording to
  match the dark-first default.
- Lint, typecheck, and Playwright test discovery pass. Full browser execution
  remains CI-only in this environment. No push was performed.

## Judge-facing polish and lifecycle hardening

- Aligned the public copy with the implementation: the link key is documented
  as 256-bit, unsupported PDFs/executables/markup are download-only, and the
  landing preview now matches the one-time, 24-hour safe default.
- Switched the first-load theme to light, added honest transport feedback and
  fragment-link warnings, made the evidence/parcel/transport sections
  collapsible, and surfaced staged recipient decryption/download progress.
- Added a focus-trapped code-editor mode with Escape restoration, deferred
  highlighting with a large-snippet pause, asynchronous ZIP creation with an
  actionable failure state, and a beforeunload warning for unsaved drafts.
- Hardened local Share History validation so only same-origin, canonical share
  links and capabilities are stored; removed the plaintext note snippet from
  the local schema.
- Added cleanup coverage for expired, revoked, exhausted, and note-only shares,
  including the five-minute reveal-retry lease window, via
  `20260902000000_exhausted_share_cleanup.sql` and its pgTAP regression suite.
- `pnpm validate` passes: lint, typecheck, 217 unit tests, source audit, and
  production build. Supabase reset/replay could not run because this host has
  neither Docker nor Podman. No commit or push was performed.

## Remaining polish pass and open licensing

- Added an IDE focus mode with Escape-to-exit, active documentation section
  highlighting, a safe example loader, and a visible composer readiness
  checklist.
- Added staged attachment progress for browser encryption, Storage upload, and
  share finalization, plus narrow/mobile/zoom layout safeguards for the
  composer, documentation, landing preview, and application header.
- Added the permissive MIT license, package metadata, and a `SECURITY.md`
  reporting policy with explicit browser-compromise and recipient-copy limits.
- Lint, typecheck, all 214 unit tests, source audit, and production build pass.
  Playwright and Axe execution remains blocked before launch on this Ubuntu
  26.04 host because no compatible Chromium binary is available. No push was
  performed.

## Product-surface polish and evidence refresh

- Made the landing page accurately surface existing notes, Markdown, code,
  attachments, encrypted discussion, Privacy Receipt, local history, revoke,
  and offline parcel capabilities.
- Replaced stale burn-after-reading and code-editor wording in the README,
  active roadmap, and in-app documentation; refreshed the implementation
  evidence counts to 214 unit, 20 development/20 production Playwright, and
  7 Axe checks.
- Added copy/download actions for revealed notes and Markdown, local-only
  history wording with status refresh and filter counts, skip links, social
  metadata, and a dynamically loaded documentation panel for the main
  workspace.
- `pnpm validate` passes: lint, typecheck, 214 unit tests, source audit, and
  production build. Browser and accessibility suites were attempted but are
  blocked before test execution because this Ubuntu 26.04 host has no system
  Chromium and the pinned Playwright browser installer does not support this
  host image. No push was performed.


## Full-width composer and evidence drawer

- Moved the create-share composer out of the desktop two-column layout so code
  and long-line editing use the full available width.
- Replaced the always-visible evidence sidebar with a compact full-width
  summary below the composer. It keeps phase, availability, expiry, and reveal
  facts visible; the proofline, policy details, and zero-knowledge flow remain
  available through the expandable `View proof` drawer.
- Lint, typecheck, and focused composer/policy tests pass. No push was
  performed.

## Single-panel code editor

- Replaced the code-mode Edit/Split/Preview layout with one editable IDE-style
  panel: the real textarea remains the accessible editing surface while a
  synchronized syntax-highlighted layer and line-number gutter provide the
  preview underneath it.
- Code mode now defaults to `plaintext`; normal typing never auto-detects or
  changes the language. The first non-empty text paste may detect once, after
  which the selected language changes only through the explicit picker.
- Styled vertical and horizontal IDE scrollbars keep long snippets inside the
  single editor surface.
- Updated the composer documentation copy and regression tests. Focused
  composer tests, lint, and typecheck pass; no push was performed.

## Documentation guide navigation

- Fixed the documentation guide pills (`Quickstart`, `Multi-Factor`, policies,
  files, parcels, self-hosting, and security) so their section hashes keep the
  documentation tab active instead of falling back to the create-share tab.
- Added an E2E regression covering all seven guide links and their targets.
- Lint, typecheck, and Playwright test discovery pass; the development suite
  now lists 20 tests. Chromium execution remains CI-only in this workspace.
- No push was performed.

## CI accessibility contrast hardening

- Fixed the dark landing preview link and primary action so their foreground
  follows the theme-aware mineral accent instead of forcing white text onto
  `#79b8b0`.
- Changed danger actions to use a dark foreground against both copper theme
  values, avoiding another low-contrast accent button.
- Lint, typecheck, all 214 unit tests, production build, and the seven-test
  accessibility suite listing pass. Chromium execution remains CI-only in
  this workspace because no local browser binary is installed.
- No push was performed.

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
  `docs/self-hosting.md` link and its new-tab behavior.
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
- Historical release note: the remote migration, promotion, cleanup-schedule
  verification, and production smoke path were completed for the published
  release.

## Released state

- Branch: `main`; the reviewed release is published at
  `https://secure-bin.vercel.app`.
- The implementation, documentation, migration contract, and CI validation are
  complete for the published release.
- `new_plan_final.md` is intentionally untracked and was preserved without
  modification; its strict-burn work is not part of this release pass.
- The released deployment and its final verification record are the source for
  the public product state; self-hosting instructions remain operator guidance.

## Current core validation

- `pnpm lint`: pass.
- `pnpm typecheck`: pass.
- `pnpm test`: pass — 217 unit tests.
- `pnpm audit:source`: pass during the latest `pnpm validate` run.
- `pnpm build`: pass.
- Playwright: 20 development and 20 production-build Chromium tests pass in CI.
- Clean Supabase reset/pgTAP, environment-backed integration, production-browser,
  accessibility, reproducibility, source audit, and dependency audit pass for
  the release SHA.

## Latest implementation commits

- `0cdce55` — `fix(ui): refresh revoked history removal and CI tests`
- `9ba6b4f` — `fix(security): harden response and cleanup contracts`
- `51f65eb` — `feat(ui): add live code authoring preview`
- `4258a92` — `feat(ui): polish viewer discussion and history states`
- `e4f7fa0` — `fix(security): close lifecycle gaps`
- `9b4104d` — `feat(ui): unify quiet-proof experience`
- `9895544` — `ci: harden reproducible release gates`

Documentation synchronization follows these implementation commits. Historical
commit messages remain unchanged; no history rewrite was performed. The
published release and passing CI state are recorded in `docs/evidence.md`.

The results include the pre-freeze regression additions. The released gate is
green.

## Resolved pre-freeze audit findings

- Forward lifecycle/upload migration and regression coverage now enforce retry leases, closed-window parity, unlock-only creation, complete idempotency, attachment cleanup retry, and lost-response upload recovery.
- Envelope v2/HKDF labels, factor-mask/file/content vectors, canonical unlock format, strict discussion/parcel validation, and language IDs are frozen in code and tests.
- Release-window countdown/hide cleanup, parcel restore, Markdown/code modes, searchable picker, keyboard tabs, confirmations/fallbacks, receipt print, evidence rail, and isolated production-shaped self-host scripts are implemented.
- Discussion diagnostics and proxy trust are redacted/configured; source and dependency audits pass.

The exact fixes and regression results are recorded above and in `docs/evidence.md`.

## Documentation consolidation

Three delegated read-only audits mapped references, checked code/document contracts, and reviewed judge/rubric clarity. Outcome:

- merged threat model, diagrams, and policy state into `docs/architecture.md`;
- merged self-hosting into `docs/deployment.md`;
- merged validation, concurrency, performance, and demo material into `docs/evidence.md`;
- summarized historical work in `docs/history.md`;
- removed completed planning and design checklists from the final submission.

The supplied Stitch export was reviewed read-only. The implemented interface preserves the route topology and application palette, uses dark-first quiet proof with an explicit light counterpart, and excludes fictional API/Docker content, activity receipts, named policy presets, unsupported discussion formatting, and nonexistent routes.

## Released operator notes

Operators of a separate SecureBin deployment should follow
`docs/deployment.md` and record their own non-secret deployment evidence. The
published SecureBin service is already covered by this release record.

## Scope decisions

- Defer Secure Drop, recipient acknowledgment, and ciphertext-size padding.
- Keep envelope v2 and deployed v2 HKDF labels during remediation.
- Keep current 27-character/124-random-bit unlock format and correct documentation/tests.
- Preserve language IDs `0–8`; append IDs `9–20` only with vectors and cached-client incompatibility documented.
- Commit subjects are Conventional Commits without day numbers.

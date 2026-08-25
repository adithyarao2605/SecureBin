# SecureBin handoff

Updated: 2026-08-25 (UTC)

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

- Branch: `main`, aligned with `origin/main` before this polish batch.
- Pre-freeze implementation and its complete local gate remain green; this
  polish batch is committed as `4258a92` and awaits the owner's push/hosted
  verification.
- Required work is consolidated in `docs/before-day-7.md`; Day 7/release-freeze work has not begun.
- The user's existing uncommitted `app/page.tsx` change was preserved.
- Do not claim a hosted deployment until the owner verifies the remote migration, production promotion, cleanup schedule, and smoke path.

## Current core validation

- `pnpm validate`: pass — 191 unit tests plus lint, typecheck, and production build.
- `pnpm test:integration`: 16 pass.
- `pnpm supabase:reset` followed by `pnpm supabase:test`: 155 pgTAP assertions pass.
- `pnpm audit:prod` and `pnpm audit:source`: pass.
- `pnpm test:e2e`: 19 pass (Chromium).
- `pnpm test:e2e:prod`: 19 pass (Chromium production build).
- `pnpm test:a11y`: 7 pass; zero serious or critical Axe findings.
- Visual review: 9 screenshots pass across major routes/states, 320/390 px mobile, light/dark, and reduced motion.
- `.venv/bin/python scripts/verify-reproducibility.py`: pass.

## Latest implementation commits

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

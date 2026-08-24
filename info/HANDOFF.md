# SecureBin handoff

Updated: 2026-08-24 (Asia/Kolkata)

## Current state

- Branch: `dev`. `main` was not inspected for this audit.
- Days 1–5 are implemented. Day 6 surfaces are present, but the exit gate is not green.
- Required work is consolidated in `docs/before-day-7.md`; the release freeze remains blocked.
- The user's existing uncommitted `app/page.tsx` change was preserved.
- Local documentation commit `e075ff0` added the pre-freeze plan. It is not claimed as pushed; verify `git status`, `git log`, and `git rev-parse origin/dev` before handoff.

## Last validation baseline

- `pnpm validate`: pass — 170 unit tests / 27 files plus build.
- `pnpm test:integration`: 16 pass.
- `pnpm supabase:test`: 145 pgTAP pass / 9 files.
- `pnpm test:e2e`: 17 pass.
- `pnpm test:e2e:prod`: 17 pass.
- `pnpm test:a11y`: 7 pass.
- `.venv/bin/python scripts/verify-reproducibility.py`: pass.

These results predate the required regression additions and do not make Day 6 complete.

## Audit findings that block freeze

- Retry leases precede revocation/expiry checks; closed windows are absent from status parity.
- Unlock-only create fails; create idempotency comparisons are incomplete.
- Attachment cleanup candidates are dropped and lost Storage PUT responses are not recovery-safe.
- Parcel schema/bounds are insufficiently strict and evidence is incomplete.
- An E2E diagnostic logs discussion capabilities/request bodies.
- Release-window countdown/automatic hide is incomplete.
- Composer modes are visually identical; detector is unwired; language expansion and accessible picker are pending.
- Keyboard tabs, destructive-action confirmations, clipboard failures, receipt print, mobile evidence rail, and serious Axe handling need work.
- Self-host scripts can retain unsafe environment state, use development mode, and stop arbitrary port owners.

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
- Preserve language IDs `0–8`; append new IDs only with vectors and cached-client incompatibility documented.
- Commit subjects are Conventional Commits without day numbers.

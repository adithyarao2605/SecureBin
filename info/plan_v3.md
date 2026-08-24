# SecureBin active roadmap

Status: **Pre-freeze implementation and local evidence complete on `dev`; owner-hosted actions pending; release freeze not started.**

This is the single active roadmap. Historical plans remain in Git history and are summarized in `docs/archive/history.md`. Security/protocol contracts live in `docs/architecture.md`; experience requirements live in `docs/SPEC.md`; current operational state lives in `info/HANDOFF.md`.

## Shipped foundation

- Browser-only encryption/decryption, versioned envelopes, strict render boundaries, and fragment-held link secrets.
- Atomic lifecycle policy, expiry/revocation/reveal limits, request-token leases, private encrypted attachments, cleanup, and local history.
- Password and two-channel factors, QR/native sharing, receipts, custom reveal counts, Never expiry, Markdown/code modes, multi-file ZIP, encrypted discussions with edit/delete, and batch status.
- Public `/` and sharing app `/new`; release-window, privacy-veil, portable-parcel, local-manager, and self-host surfaces exist on `dev`.

The pre-freeze gate passes locally: 191 unit tests, 16 integration tests,
155 pgTAP assertions after clean reset/replay, 19 development and 19
production-build Playwright tests, 7 Axe checks, nine reviewed screenshots,
production build, reproducibility, dependency, and source/log audits. Remote
migration, production promotion, and hosted cleanup verification remain owner-operated.

## Required before the release freeze

Execute [`../docs/before-day-7.md`](../docs/before-day-7.md) in this order:

1. Restore lifecycle, idempotency, cleanup, discussion, logging, and proxy correctness with forward migrations and regressions.
2. Freeze deployed cryptographic labels/unlock format and add strict vectors and parcel validation.
3. Complete release-window hide behavior, parcel evidence, upload recovery, safe self-hosting, and cleanup scheduling.
4. Fix Markdown/code composer distinction, detection/language expansion, tabs, feedback, destructive actions, receipts, and accessibility gates.
5. Complete the full light-first quiet-proof UI overhaul in [`../docs/UI-REDESIGN.md`](../docs/UI-REDESIGN.md): one primary surface, narrow evidence rail, compact mobile status strip, restrained proofline, honest copy, keyboard/mobile/contrast/reduced-motion coverage.
6. Rerun every local gate and record exact evidence.

No release-freeze work has begun; it begins only after the final evidence items
are green.

## Release freeze

Follow [`../docs/DAY-7-PLAN.md`](../docs/DAY-7-PLAN.md): no features; fresh-clone reproduction; full test matrix; security and secret/log audit; Chromium/mobile/keyboard/Axe checks; production-shaped performance; repository cleanup; judge demo rehearsal; owner migration/deployment evidence; rubric mapping; early submission buffer.

## Deferred by decision

Do not add without explicit approval: Secure Drop request links, recipient acknowledgment, ciphertext-size padding, accounts/passkeys, rooms/realtime, Argon2id/WASM, localization waves, alternate databases/Kubernetes, PrivateBin compatibility, blockchain, or AI features.

## Working rules

- Develop and audit on `dev`; the owner promotes to `main` later.
- Use short Conventional Commit subjects with no day number.
- Never modify `info/plan.md` or the challenge/reference material.
- Keep public contracts synchronized with code and migrations.
- A phase is complete only when its production-shaped failure paths and evidence are green.

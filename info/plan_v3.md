# SecureBin active roadmap

Status: **Release preparation is active on `main`; implementation and local JavaScript validation are complete; owner-hosted release evidence is pending.**

This is the single active roadmap. Historical plans remain in Git history and are summarized in `docs/archive/history.md`. Security/protocol contracts live in `docs/architecture.md`; experience requirements live in `docs/SPEC.md`; current operational state lives in `info/HANDOFF.md`.

## Shipped foundation

- Browser-only encryption/decryption, versioned envelopes, strict render boundaries, and fragment-held link secrets.
- Atomic lifecycle policy, expiry/revocation/reveal limits, request-token leases, private encrypted attachments, cleanup, and local history.
- Password and two-channel factors, QR/native sharing, receipts, custom reveal counts, Never expiry, Markdown/code modes, multi-file ZIP, encrypted discussions with edit/delete, and batch status.
- Public `/` and sharing app `/new`; release-window, privacy-veil, portable-parcel, local-manager, and self-host surfaces exist on `main`.

The current local JavaScript gate passes with lint, strict typechecking, 217
unit tests, source audit, and production build. Supabase replay, environment-
backed integration tests, browser execution, accessibility execution, remote
migration, production promotion, and hosted cleanup verification remain
owner-operated release evidence.

## Current release-preparation state

The current release pass prioritizes documentation, repository hygiene, bug
fixes, and verification of the already-shipped behavior. New capabilities and
protocol changes remain outside this release scope.

Before submission, follow [`../docs/DAY-7-PLAN.md`](../docs/DAY-7-PLAN.md) for:

1. A fresh-clone install and the complete CI matrix.
2. Clean Supabase migration replay, including
   `20260902000000_exhausted_share_cleanup.sql`.
3. Hosted smoke coverage for creation, factors, policies, attachments,
   discussions, parcels, revocation, and unavailable states.
4. A recorded final SHA, deployment URL, migration list, cleanup schedule,
   browser/accessibility results, and synthetic demo rehearsal.

## Deferred by decision

Do not add without explicit approval: Secure Drop request links, recipient acknowledgment, ciphertext-size padding, accounts/passkeys, rooms/realtime, Argon2id/WASM, localization waves, alternate databases/Kubernetes, PrivateBin compatibility, blockchain, or AI features.

## Working rules

- Develop and audit on the active branch; the owner promotes the reviewed commit to the hosted deployment.
- Use short Conventional Commit subjects with no day number.
- Never modify `info/plan.md` or the challenge/reference material.
- Keep public contracts synchronized with code and migrations.
- A phase is complete only when its production-shaped failure paths and evidence are green.

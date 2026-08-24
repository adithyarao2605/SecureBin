# SecureBin Handoff

Updated: 2026-08-24 (Asia/Kolkata) — **post–Day 6 handoff**

## Pre-freeze audit addendum

- Three read-only subagent audits covered Day 6/docs completeness,
  backend/security/database behavior, and frontend/accessibility quality.
- The consolidated remediation order is now recorded in
  `docs/before-day-7.md`. Day 6 is implemented in broad shape but its exit gate
  is not considered green until that plan and the separately planned UI
  overhaul are complete.
- Audit-time validation on `dev@719af57`: `pnpm validate` passed (170 unit
  tests across 27 files plus build), 16 integration tests passed, 145 pgTAP
  tests passed, 17 development E2E passed, 17 production-build E2E passed,
  7 accessibility tests passed, and reproducibility verification passed.
  These suites need the new regression cases listed in the remediation plan.
- Highest-priority findings: retry leases currently precede revoke/expiry
  checks; unlock-only creates are rejected; attachment cleanup candidates are
  dropped; closed-window status remains active; immutable idempotency checks
  are incomplete; and an E2E diagnostic logs raw discussion capabilities.
- Existing user work in `app/page.tsx` remains unmodified and uncommitted.

## Read this first

- Active roadmap: **`info/plan_v3.md`**. Status: **Phases A–F complete**
  (Days 1–5 + the full Day 6 batch). Phase G (Day 7 freeze/validation/
  submission) is next; detail in `docs/DAY-7-PLAN.md`.
- Branch model: develop on `dev` (Vercel preview); `main` is production.
  Commit messages: short conventional subjects, **no day references**.
- Deferred by owner decision (do not build without approval): Secure Drop
  request links (ECDH P-256 + HKDF), recipient acknowledgment button.
- **Deferred by explicit HANDOFF decision (Day 6 §8): ciphertext-size
  padding.** Bucketed-length framing would rush a protocol change for
  marginal metadata concealment; revisit only if a rubric item demands it,
  and then via a new versioned envelope decision per AGENTS.md.

## Current state (all committed on `dev`, pushed)

- Days 1–5 shipped previously (crypto core, lifecycle, attachments,
  factors, discussions data layer, batch status sync, landing/app split).
- Day 6 batch now shipped:
  - **Encrypted discussions enabled end-to-end**: composer toggle seals the
    SBCT `0x02` discussion capability into the content frame; only its
    SHA-256 digest (over the RAW 32 bytes — string-hashing caused and fixed
    a real mismatch) reaches the server. Browser round trip covered by E2E;
    thread has an Axe scan.
  - **Reveal window**: presets none/10s/30s/1m/5m/custom ≤24h. Migration
    `20260831000000_reveal_window.sql`: nullable window columns, 11-arg
    `create_share`, `reveal_share` stamps `first_released_at`/`window_ends_at`
    atomically at first release and enforces uniform unavailability after the
    close while preserving the original token's 5-minute retry lease.
  - **Privacy veil**: local hide on the opened view (toggle/Esc/window blur),
    `inert` while hidden, honest "not screenshot prevention" copy.
  - **Self-host**: `pnpm local:setup | local | local:stop` +
    `docs/self-hosting.md`. Verified end-to-end on this machine from setup
    through create→reveal on http://127.0.0.1:3101.
  - **`.securebin` parcels** (SBPX v1): export offered at creation; strict
    offline restore panel on `/new` (magic/version/length-exact, trailing
    bytes rejected). Carries envelopes+ciphertexts+non-secret metadata incl.
    the AAD public id; never keys/passwords/codes/revocation abilities.
  - **Manager upgrades**: history-desk labels + policy view; expanded
    privacy receipt (content type, attachment count, discussion state,
    release window, what-stayed-local row, .txt download).
- Audit-driven fixes landed this run (see commits): attachment-slot
  forwarding to the reservation RPC, SBCT v0x02 decode acceptance + error
  wrapping, streamed-body caps with early abort, stale-poll clobbering in
  the discussion list (sequence numbers), CI (dev-branch runs, prod-build
  E2E job, deploy-trigger concurrency), and a latent production bug where
  `validateFileEnvelope` clobbered masked factor blocks — protected shares
  WITH attachments decrypt correctly again.

## Validation (exact results at last green, 2026-08-24)

- `pnpm validate` (lint, typecheck, **170 unit tests / 27 files**, build) ✓
- `pnpm test:integration` — **16** ✓
- `pnpm supabase:test` — **145 pgTAP across 9 files** ✓
- `pnpm test:e2e` — **17** ✓ · `pnpm test:e2e:prod` — **17** ✓
- `pnpm test:a11y` — **7** ✓
- `.venv/bin/python scripts/verify-reproducibility.py` ✓
- `pnpm audit --audit-level=high` clean ✓

Gotchas that still apply: kill stray listeners on :3100 before E2E
(`fuser -k 3100/tcp`); Playwright workers stay at **1**; self-host serves on
**:3101** so it never fights the suites.

## Owner actions before production promotion

1. Apply the two newest migrations to hosted Supabase:
   `supabase migration list`, then `supabase db push`
   (`20260830000000_discussion_comment_edit_delete.sql`,
   `20260831000000_reveal_window.sql`). Hosted DB last verified applied
   through `20260829000000_encrypted_discussions.sql`.
2. Redeploy production from `dev` after verifying on the preview URL.
3. Re-run the demo rehearsal checklist (`docs/evidence/demo-rehearsal-checklist.md`)
   against production once deployed.

## Next steps (Phase G / Day 7)

1. Follow `docs/DAY-7-PLAN.md`: fresh-clone verification, production smoke
   matrix, concurrency evidence refresh under `docs/evidence/`, Chromium/
   Firefox/mobile passes, repo cleanup, judge-first README pass.
2. Keep every gate green between slices; freeze means freeze.

## Key decisions recorded this run

- Discussions capability digest convention: SHA-256 over raw capability
  bytes (matches pgTAP/RPC); never hash the base64url string form.
- Veil starts REVEALED; hiding is user-initiated (Esc/blur/toggle).
- Parcel format SBPX v1: length-prefixed sections, exact-consume parsing,
  publicId carried as AAD context (not a secret).
- Self-host port :3101; secrets generated locally into `.env.local`.

## Recent Commits (this run)

- `ce2c04d` fix: masked file envelopes validate end-to-end; audit remediation
- `7cff9b1` feat: sender manager upgrades and expanded privacy receipt
- `fe71b30` feat: one-command self-hosting with runbook
- `b26e41d` feat: portable .securebin parcels with offline decryption
- `82cb5be` feat: local privacy veil on the opened view
- `929ec0f` feat: reveal window from first opening to uniform close
- `d470dc2` feat: enable encrypted discussions from the composer
- `ab43021` test: receipt unit, multi-file drag-drop e2e, expanded axe coverage
- `1d28009` fix(security): forward attachment slots, decode SBCT v0x02 frames…

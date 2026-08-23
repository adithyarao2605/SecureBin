# SecureBin Handoff

Updated: 2026-08-23 (Asia/Kolkata) — branch `dev`, HEAD `4658c5e30e3f`

## Completed

- **Days 4 and 5 are fully implemented, tested, and audited.**
  * Day 4: PBKDF2-HMAC-SHA-256 password factor (600,000 iterations, 16-byte salt), 27-character Crockford unlock codes with check symbol, all four factor masks with per-mask HKDF input keying material (`linkSecret ‖ passwordKey ‖ unlockBytes`), viewer factor gates, QR + native share + email actions, Privacy Receipt with ciphertext fingerprint and infrastructure-visibility note, and the pre-flight "What will SecureBin see?" disclosure.
  * Day 5: custom reveal counts 1–100 (constraint + UI + concurrency proof at a custom limit), "Never" expiry (nullable `expires_at`, revocable, cleanup-skipping), Markdown Edit/Split/Preview, code mode with local language detection, multi-file attachments (≤5, `share_attachments` child table, slot-staged reservations, reveal `files[]`, drag-and-drop, Download-all ZIP via `fflate`), and encrypted discussions (append-only `share_comments`, capability-digest model, SBCT `0x02` trailer, `securebin/v2/{mask}/discussion` HKDF label, lifecycle inheritance, route + database rate limits).
  * Migrations through `20260829000000_encrypted_discussions.sql` (also `20260826000000` stale-constraint drop, `20260827000000` custom policies, `20260828000000` multi-file attachments).
  * Refactors: composer is now a ~317-line shell over `app/components/composer/*` modules and the `use-staged-create` hook; viewer is a 283-line shell over `viewer-parts/*`; `globals.css` split into seven partials under `app/styles/`.
  * Friend's UI polish (language-select theme, decrypted viewer alignment) merged into the modular architecture (`ce7a950`).
  * Day 4/5 audit remediation batch landed (`4658c5e`): discussion lifecycle gating centralized in `securebin_discussion_share`, comment envelope size CHECKs, stale Day-2 reservation-pair constraint dropped, comment capability moved from query param to `x-discussion-capability` header, UUID pre-validation on parent comment ids, thread-component in-flight/polling guards.
- **Documentation sweep (this run):** README, AGENTS, SPEC, architecture, diagrams, threat model, deployment, policy-state, and the four DAY plan files synchronized with the shipped surface and verified test counts. `info/plan.md`, `info/plan_v2.md`, and the other read-only references untouched.

## Validation Status

All green locally against Docker-backed Supabase at `4658c5e30e3f`:

- `pnpm test`: 145 tests, 21 files, all passing (policy-presets slice removed by owner decision).
- `pnpm test:integration`: 14 tests, 4 files, all passing.
- `pnpm supabase:reset` + `pnpm supabase:test`: 7 files, 115 pgTAP tests, PASS.
- `pnpm test:e2e`: 10 passed. `pnpm test:a11y`: 2 passed.

## Known Limitations (documented, accepted)

- A plausible-but-wrong client-only factor (password/unlock) cannot be verified by the zero-knowledge server: it authorizes — and consumes — a reveal lease, then fails local decryption. Format-level errors are rejected client-side before any network call.
- The reveal lease is consumed before signed-URL minting; returning after the 5-minute lease window spends a second authorization.
- Rate-limit discriminator falls back to client-forwarded headers off Vercel.
- E2E runs against `next dev`, not the production build.
- The discussion capability is a bearer secret: anyone who holds it can read or post until the share's lifecycle closes the thread. It travels in the `x-discussion-capability` header (moved out of the query string), never in URLs.

- 2026-08-23 (owner): the Day 5 **policy-presets** feature was removed after
  live evaluation - the individual controls already express every policy it
  covered. Code, tests and docs scrubbed.

## Project Decisions

- **Branch model (2026-08-23):** development happens on `dev` (Vercel preview); `main` is production. Promotion to `main` is an owner step after preview verification.
- **Friend merge strategy (2026-08-23):** friend UI-polish contributions were rebased onto the modular composer/viewer architecture and merged as `ce7a950`; contract behavior was preserved and the full gate re-run.
- **plan_v2 §3 shipped deliberately (2026-08-23):** after SPEC Day 4 factors were green, the implementation delivered plan_v2 §3 (custom reveals, Never expiry, rich authoring, code detection, multi-file, discussions) instead of a polish-only SPEC Day 5. The preset-only restriction in `docs/SPEC.md` no longer applies.
- 2026-08-22 (owner): zero key material policy — no credentials anywhere in tracked files or history; CI extracts the local service key at runtime from `supabase status -o env`.
- 2026-08-22 (owner): scoped UI redesign remains in-scope at Day 6 if real usage shows the interface itself is insufficient; quiet-proof direction and all gates stay the safety net.

## Production Status (end of run)

- All four Day 4–5 migrations (`20260826000000`–`20260829000000`) were applied to the hosted Supabase project via `supabase db push` from the linked CLI (verified via `migration list`).
- Production verified live on https://secure-bin.vercel.app with browser automation: three-tab layout, Markdown create → reveal with styled headings/bullets, health 200, CI success on the deployed commit.
- `dev` mirrors production and receives Vercel preview deployments for continued work.

## Next Steps

Start `docs/DAY-6-PLAN.md` (plan_v2 §4–§5): reveal window, privacy veil, one-command self-hosting, `.securebin` parcels, local sender manager, expanded Privacy Receipt — entry gate is green at the current commit. The Day 7 release freeze follows and stays gated until the Day 6 exit gate is green.

## Recent Commits

- `4658c5e` fix(day5): audit remediation batch
- `ce7a950` merge: incorporate friend's UI polish into modular architecture
- `3fbd793` chore: trigger deploy [skip ci]
- `4c3cfd6` feat(day5): policy presets, landing reorder, CSS module split, multi-file e2e fixes
- `28a5c62` docs: update handoff with UI improvements commit
- `1735dbf` feat(ui): match code dropdown theme and align decrypted viewer
- `5ec7785` feat(day5): discussion threads, drag-drop attachments, ZIP download-all
- `c8c359a` feat(day5): multi-file staged uploads end-to-end

## History

- **2026-08-22 audit + stabilization:** base64url >76-char create fix (`20260825000000`), CSP `connect-src` storage origin, audit logging wired, log redaction, attachment round-trip e2e, full-history secret scrub with SHA remap.
- **2026-08-22 independent review pass:** stale Day-3 size constraints dropped (`20260826000000`), create_share client-class rejections map to 400, history-desk terminal-404 fix, viewer failure notices + retryable network errors, staged-upload component tests.
- **2026-08-23 discussion/attachment audit:** superseded by the remediation batch recorded above; its validation numbers (115 pgTAP / 151 unit) carried into this run.

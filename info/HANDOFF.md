# SecureBin Handoff

Updated: 2026-08-22 (Asia/Kolkata)

## Completed

- **2026-08-22 audit-and-stabilization pass** (this run):
  * Full-codebase bug hunt plus a second secrets audit; findings fixed and verified.
  * **CSP fix (critical):** `middleware.ts` now adds the configured Supabase project origin to `connect-src`; previously `'self'` alone blocked the browser's signed-upload PUT and reveal download fetch, so attachments could never upload or preview in any CSP-enforcing browser. Covered by `tests/unit/csp.test.ts` (set / fallback / malformed / unset cases).
  * **Contracts fix:** parenthesized the `availableAt` guard in `parseCreateShareInput` (`lib/shares/contracts.ts`); an unparseable scheduled time was silently coerced to `null`, turning scheduled shares immediately available. Regression test added.
  * **Composer:** draft limit now enforced in UTF-8 bytes with a clear error before any crypto work; byte-accurate counter replaces the UTF-16 char counter/maxLength.
  * **Revoke flow:** history entry is marked revoked on success.
  * **Log redaction:** `upload-routes.ts` prints only coarse `status`/`code`; `RpcRequestError.message` intentionally carries upstream detail for incident diagnosis but must never reach persisted logs.
  * **DB contract:** forward migration `20260824000000_finalize_single_signature.sql` drops the ambiguous two-array `finalize_expired_securebin` overload in deployed projects (the applied `20260821010000` file was left untouched). pgTAP updated.
  * **Test config:** integration tests read every credential from the environment via native `process.loadEnvFile()` and fail fast when missing; no hardcoded keys anywhere.
  * **Safety cleanups:** leading-`<` attachment text goes to download-only preview; removed accidental JS label in history parsing; dead typeof re-checks removed from envelope validation.

- Earlier state (verified this run): Day 1–3 complete — multi-mode SBCT v2 content, single-file encrypted attachments, storage reservation/rotation/cleanup, atomic lifecycle RPCs, quiet-proof UI. Production incident closed; remote Supabase migrated through `20260823000000`.

## Validation Status

All commands run locally against Docker-backed Supabase:

- `pnpm validate`: passed (lint, strict typecheck, 106 unit tests, production build).
- `pnpm supabase:reset` + `pnpm supabase:test`: passed, 82 pgTAP tests across 5 files.
- `pnpm test:integration`: passed, 12/12.
- `pnpm test:e2e`: passed, 8/8. `pnpm test:a11y`: passed, 2/2.
- `.venv/bin/python scripts/verify-reproducibility.py`: passed.

Environment note: Playwright ≥1.55.1 needs browser build v1193; its CDN download stalled at the extraction step on this machine, so the archive was extracted manually into `~/.cache/ms-playwright/chromium_headless_shell-1193` with an `INSTALLATION_COMPLETE` marker. Other machines are unaffected.

## Secrets Audit Result

- Only tracked secret-looking value is the well-known Supabase CLI local constant (`*REMOVED*<local-CLI-constant>…`) in `ci.yml`, valid solely against ephemeral `127.0.0.1:54321` stacks; now labeled as such inline. Hosted projects generate unique keys, so it cannot authenticate there.
- `.env` is gitignored and was never committed; `.env.example` holds placeholders only; no real credentials exist anywhere in tracked files or git history.
- Owner hygiene check (optional): confirm/rotate the service key in the Supabase dashboard if desired; rotation is free.

## Known Limitations (documented, accepted)

- Reveal lease is consumed before signed-download generation; a recipient returning after the 5-minute lease window spends a second authorization. Documented in `docs/architecture.md`.
- Rate-limit discriminator falls back to client-forwarded headers off Vercel (platform header first). Documented in code.
- No live Markdown authoring preview in the composer (feature request, not a defect) — deferred with plan_v2 scope.

## Next Steps for Session (Day 4 Scope)

Day 4 is the active milestone: PBKDF2 password factor, two-channel unlock codes with factor-mask domain separation, QR + share actions, Privacy Receipt, complete non-happy-path states, security-header review. `info/plan_v2.md` Days 4–7 remain gated until SPEC Day 5 completes (see `docs/SPEC.md#explicitly-deferred-beyond-this-five-day-release`).

## Recent Commits

- `e2f063b` test(db): forward migration for single finalize signature; env-only test config
- `c81cc15` fix(server): redact upstream RPC details from persisted logs
- `3c764f2` fix(ui): byte-accurate content limit, history revoke sync, safety cleanups
- `875d1ee` fix(contracts): reject unparseable scheduled availability
- `3b06492` fix(csp): allow configured Supabase storage origin in connect-src

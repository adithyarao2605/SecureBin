# SecureBin Handoff

Updated: 2026-08-22 (Asia/Kolkata)

## Completed

- **2026-08-22 full audit + stabilization + history scrub**:
  * **Root cause of persistent share-creation failures found and fixed:** Postgres `encode(bytea,'base64')` wraps output every 76 characters and the canonical base64url round-trip check stripped only `=` padding, so every content envelope whose ciphertext exceeded 76 base64 characters (~any real note) was rejected with `invalid content envelope` at create time. Forward migration `20260825000000` replaces both `securebin_b64url` helpers with newline-tolerant canonical comparison; pgTAP regression vectors cover the >76-character case. Masked until now because unit tests mock the RPC layer and early smoke notes were shorter than the wrap width.
  * **CSP fix:** `middleware.ts` adds the configured Supabase origin to `connect-src`; previously the browser could not PUT uploads or fetch signed downloads. Unit-tested.
  * **Contracts fix:** parenthesized the `availableAt` guard in `parseCreateShareInput`; unparseable scheduled times no longer silently become `null`. Regression test added.
  * **Composer:** draft limit enforced in UTF-8 bytes before crypto work; byte counter replaces UTF-16 char maxLength.
  * **Revoke flow** marks the local history entry revoked.
  * **Audit logging wired** (`withAudit`) across all six API routes — sanitized request-id echo, coarse status/duration/size lines, uniform JSON 500 on unexpected throws. The observability module is no longer dead code.
  * **Log redaction:** share/upload routes print only coarse RPC status/code.
  * **New e2e:** real-backend attachment round trip (`tests/e2e/attachment.spec.ts`) covering reservation → Storage PUT → size-verified create → signed download → magic-byte preview. This is the coverage gap that let both the CSP and base64 defects ship green.
  * **Secret hygiene:** the Supabase CLI's well-known local-stack constant was removed from `ci.yml` (now read from repository secret `CI_LOCAL_SUPABASE_SERVICE_KEY`) and scrubbed from every commit via `git filter-repo --replace-text`; all SHAs changed, subjects preserved, doc references updated. Full-history scan found no other credential material (no GitHub/OpenAI/Google tokens, no private keys, no non-demo JWTs).
  * **Docs synchronized:** architecture (CSP connect-src rule, finalize single signature, b64url newline contract, documented reveal-lease limitation), threat-model/diagrams/deployment/README/incident staleness cleared, incident SHAs remapped, DAY-2/DAY-3 errata appended, SPEC snapshot refreshed with explicit plan_v2 precedence gate.

## Validation Status

All commands green locally against Docker-backed Supabase:

- `pnpm validate`: lint, strict typecheck, 110 unit tests, production build.
- `pnpm supabase:reset` + `pnpm supabase:test`: 85 pgTAP tests, 5 files.
- `pnpm test:integration`: 12/12. `pnpm test:e2e`: 9/9 (incl. attachment round trip, run 3x stable). `pnpm test:a11y`: 2/2.
- `.venv/bin/python scripts/verify-reproducibility.py`: OK. `pnpm audit`: zero advisories.

Environment note: Playwright ≥1.55.1 browser v1193 had to be installed manually on this workstation (CDN extraction step stalls); see git log message of the CSP fix era for the recipe. Other machines unaffected.

## Secrets Audit Result

- No real credentials exist anywhere in tracked files or in any commit after the scrub. The only historical value was the public-by-design local CLI constant, now `*REMOVED*` markers in old blobs and a repository secret going forward.
- `.env` remains gitignored and was never committed; `.env.example` holds placeholders only.
- Owner checklist: set `CI_LOCAL_SUPABASE_SERVICE_KEY` in GitHub repo secrets (value = the key `supabase start` prints locally), then push migrations `20260824000000` and `20260825000000` (`pnpm supabase db push`) and redeploy. Verify production with a **long** (>80 character) note plus an attachment.

## Known Limitations (documented, accepted)

- Reveal lease is consumed before signed-download generation; returning after the 5-minute lease window spends a second authorization (`docs/architecture.md`).
- Rate-limit discriminator falls back to client-forwarded headers off Vercel.
- No live Markdown authoring preview in the composer (deferred with plan_v2 scope).

## Next Steps

Day 4 is planned in `docs/DAY-4-PLAN.md` and ready to implement: PBKDF2 password factor, two-channel unlock codes, QR + share actions, Privacy Receipt, complete non-happy-path states. `info/plan_v2.md` Days 4–7 stay gated until SPEC Day 5 completes.

## Recent Commits

- `13d8cd9` fix(db): accept canonical base64url longer than 76 chars; wire audit logging
- `11b26ad` docs: sync stale incident/scope claims; document CSP storage origin and finalize contract
- `1108210` test(db): forward migration for single finalize signature; env-only test config
- `1da368a` fix(server): redact upstream RPC details from persisted logs
- `ced000e` fix(ui): byte-accurate content limit, history revoke sync, safety cleanups
- `3916bab` fix(contracts): reject unparseable scheduled availability
- `3aaddfe` fix(csp): allow configured Supabase storage origin in connect-src

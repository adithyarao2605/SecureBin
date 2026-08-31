# Validation and judge evidence

This file consolidates reproducible evidence for the released SecureBin
application at `https://secure-bin.vercel.app`. It records observations, not a
substitute for rerunning the gates at a later commit.

## Current release record

Updated 2026-08-31 for the released application and dark-default theme. This
section records the completed release gates and their production-shaped CI
evidence.

| Gate | Current evidence |
| --- | --- |
| JavaScript validation | Pass: lint, strict typecheck, 217 unit tests, source audit, and production build |
| Supabase migrations and pgTAP | Pass: clean replay and 155 pgTAP assertions in `main` CI |
| Backend integration tests | Pass: 16 environment-backed tests in `main` CI |
| Development and production Playwright | Pass: 20 development and 20 production-build Chromium tests |
| Accessibility | Pass: 7 Axe checks with no serious or critical findings |
| Reproducibility and dependency audit | Pass in `main` CI |

The complete synthetic-data manual verification matrix is maintained in
[`feature-checklist.md`](feature-checklist.md). CI is split into independent
reproducibility, static-quality, database/integration, development-browser,
production-browser, and accessibility jobs so an unrelated slow suite does
not hide a faster failure.

The released feature set and its local/CI gates are established. The deployment
runbook remains available for operators who deploy their own SecureBin instance.

## Concurrency evidence

`tests/integration/reveal-concurrency.test.ts` races 20 parallel calls through
the atomic `reveal_share` path. It covers exactly-N authorization, over-limit
uniform failures, retry-token idempotency, and unlimited shares. pgTAP checks
row locking, count constraints,
leases, RLS, and the forward cleanup behavior when run against a clean
database.

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm test:integration
pnpm supabase:test
```

The current regression suites cover same-token retry after revocation, expiry,
and window closure; closed-window status parity; unlock-only shares; full
create idempotency mismatches; partial attachment cleanup/recovery; and cleanup
of exhausted and note-only shares after retry leases close.

## Performance baseline

The 2026-08-24 `next dev`/Chromium baseline at 390×844 measured warm LCP of
168 ms for `/` and 528 ms for `/new`; cold values included compilation. The
latest production build reports approximately 102 kB shared first-load JS,
232 kB for `/new`, and 217 kB for `/s/[publicId]`. AES-GCM measured about 188
MiB/s, so a Worker was deferred for the current 10 MB-per-file limit. These
figures are comparative measurements, not production guarantees.

## Demo rehearsal

- Fresh clone installs with the frozen lockfile; CI records the release gates
  for the deployed SHA.
- Create and reveal note, Markdown, code, password, unlock-only, combined-factor, and multi-file shares with synthetic data.
- Show truthful receipt download/print, release-window countdown, automatic hide, manual privacy veil, and the saved-copy limitation.
- Restore a portable parcel after the application loads and network access is blocked; demonstrate tamper and future-version rejection.
- Show atomic concurrency, retry without double spend, cleanup retry, manager refresh, revoke, and the uniform unavailable state.
- Exercise mobile status strip, keyboard tabs/picker, focus restoration, clipboard fallback, and Axe with serious findings reviewed.
- Verify local/self-hosted production mode uses an isolated loopback environment and only stops its own process.
- Revoke demo shares and clear synthetic local history after judging.

The release evidence contains the exact SHA, deployment URL, browser/OS, gate
output, synthetic screenshots, migration list, and cleanup schedule. Never
capture secrets, request bodies, ciphertext, capabilities, or fragment URLs.

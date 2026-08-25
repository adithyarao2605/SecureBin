# Validation and judge evidence

This file consolidates reproducible evidence. It records observations, not a substitute for rerunning the gates at the release commit.

## Current release record

Updated 2026-08-25 after the final implementation and dark-default theme
commits. This section distinguishes checks completed in the current workspace
from checks that require Docker, Supabase credentials, or a Chromium runner.

| Gate | Current evidence |
| --- | --- |
| JavaScript validation | Pass: lint, strict typecheck, 217 unit tests, source audit, and production build |
| Supabase migrations and pgTAP | Pending clean replay on CI or an owner-hosted Supabase environment |
| Backend integration tests | Pending environment-backed run; the configured command is `pnpm test:integration` |
| Development and production Playwright | 20 tests discovered; full Chromium execution belongs to CI |
| Accessibility | 7 tests configured; full Axe execution belongs to CI |
| Reproducibility and dependency audit | Configured in GitHub Actions and must be recorded for the release SHA |

The current feature set is established. Remote migration, production promotion, hosted
cleanup verification, and the final browser/accessibility matrix remain owner-
operated release evidence rather than missing product features.

## Concurrency evidence

`tests/integration/reveal-concurrency.test.ts` races 20 parallel calls through
the atomic `reveal_share` path. It covers exactly-N authorization, over-limit
uniform failures, retry-token idempotency, and unlimited shares. Upload tests
cover concurrent reservation convergence and conflicts. The release checklist
in [`LAST_DAY.md`](../LAST_DAY.md) separately calls for a larger owner-run
concurrency proof. pgTAP checks row locking, count constraints, leases, RLS,
and the forward cleanup behavior when run against a clean database.

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

- Fresh clone installs with the frozen lockfile; CI or the owner must record all
  release gates for the final SHA.
- Create and reveal note, Markdown, code, password, unlock-only, combined-factor, and multi-file shares with synthetic data.
- Show truthful receipt download/print, release-window countdown, automatic hide, manual privacy veil, and the saved-copy limitation.
- Restore a portable parcel after the application loads and network access is blocked; demonstrate tamper and future-version rejection.
- Show atomic concurrency, retry without double spend, cleanup retry, manager refresh, revoke, and the uniform unavailable state.
- Exercise mobile status strip, keyboard tabs/picker, focus restoration, clipboard fallback, and Axe with serious findings reviewed.
- Verify local/self-hosted production mode uses an isolated loopback environment and only stops its own process.
- Revoke demo shares and clear synthetic local history after judging.

At the final commit, record the exact SHA, preview URL, browser/OS, gate output, screenshots with synthetic content, migration list, cleanup schedule, and owner deployment confirmation in `info/HANDOFF.md`. Never capture secrets, request bodies, ciphertext, capabilities, or fragment URLs.

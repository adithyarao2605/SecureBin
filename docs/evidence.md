# Validation and judge evidence

This file consolidates reproducible evidence. It records observations, not a substitute for rerunning the gates at the release commit.

## Pre-freeze verification snapshot

Recorded 2026-08-24 on `dev` after the forward migration and remediation work:

| Gate | Result |
| --- | ---: |
| Unit / validate | 191 tests; lint, typecheck, build pass |
| Integration | 16 tests pass |
| PostgreSQL pgTAP | 155 assertions after clean reset/replay |
| Dependency audit | pass |
| Source/log audit | pass |
| Reproducibility | pass |
| Development Playwright | 19 Chromium tests pass |
| Production-build Playwright | 19 Chromium tests pass |
| Axe | 7 checks pass; zero serious or critical findings |
| Visual review | 9 route/state screenshots reviewed at desktop, 320 px, and 390 px in light/dark and reduced-motion states |

The complete local pre-freeze gate is green. Remote migration, production
promotion, and hosted cleanup verification remain owner-operated. Release-freeze
work has not begun.

## Concurrency evidence

`tests/integration/reveal-concurrency.test.ts` races parallel calls through the atomic `reveal_share` path. It covers exactly-N authorization, over-limit uniform failures, retry-token idempotency, and unlimited shares. Upload tests cover concurrent reservation convergence and conflicts. pgTAP additionally checks row locking, count constraints, leases, and anonymous-deny RLS.

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm test:integration
pnpm supabase:test
```

The new pre-freeze regression suite covers same-token retry after revocation,
expiry, and window closure; closed-window status parity; unlock-only shares;
full create idempotency mismatches; and partial attachment cleanup/recovery.

## Performance baseline

The 2026-08-24 `next dev`/Chromium baseline at 390×844 measured warm LCP of 168 ms for `/` and 528 ms for `/new`; cold values included compilation. Build output was approximately 102 kB shared first-load JS, 166 kB for `/new`, and 210 kB for `/s/[publicId]`. AES-GCM measured about 188 MiB/s, so a Worker was deferred for the current 10 MB-per-file limit. Re-measure a production build after the UI overhaul; these figures are not production guarantees.

## Demo rehearsal

- Fresh clone installs with the frozen lockfile and all release gates pass.
- Create and reveal note, Markdown, code, password, unlock-only, combined-factor, and multi-file shares with synthetic data.
- Show truthful receipt download/print, release-window countdown, automatic hide, manual privacy veil, and the saved-copy limitation.
- Restore a portable parcel after the application loads and network access is blocked; demonstrate tamper and future-version rejection.
- Show atomic concurrency, retry without double spend, cleanup retry, manager refresh, revoke, and the uniform unavailable state.
- Exercise mobile status strip, keyboard tabs/picker, focus restoration, clipboard fallback, and Axe with serious findings reviewed.
- Verify local/self-hosted production mode uses an isolated loopback environment and only stops its own process.
- Revoke demo shares and clear synthetic local history after judging.

At the final commit, record the exact SHA, preview URL, browser/OS, gate output, screenshots with synthetic content, migration list, cleanup schedule, and owner deployment confirmation in `info/HANDOFF.md`. Never capture secrets, request bodies, ciphertext, capabilities, or fragment URLs.

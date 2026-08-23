# Concurrency evidence

Recorded: 2026-08-24, local Supabase stack (`pnpm supabase:start`) with
`pnpm test:integration`.

## Reveal-limit concurrency (`tests/integration/reveal-concurrency.test.ts`)

Six tests race parallel reveal requests against one atomic RPC
(`securebin_attempt_reveal`) to prove the counter can never overspend:

- Parallel reveals beyond the limit: exactly N succeed, the rest receive the
  uniform unavailable response.
- Exact-N boundary: 7-of-max-7 custom policy admits exactly seven.
- Retry-token idempotency: the same request token inside the lease window
  never double-spends.
- Unlimited shares stay unlimited; exhausted ones reject.

```
 ✓ tests/integration/reveal-concurrency.test.ts (6 tests) 574ms
 ✓ tests/integration/share-service.test.ts (6 tests)
 ✓ tests/integration/cleanup-service.test.ts (2 tests)
 ✓ tests/integration/upload-service.test.ts (2 tests)
 Tests  16 passed (16)
```

## Upload reservation races (`tests/integration/upload-service.test.ts`)

Parallel reservations of the same `(publicId, idempotencyKeyHash, slot)` tuple
converge on one live reservation; conflicting envelope/size reuse returns
`reservation_conflict`; attached tuples refuse re-upload.

## Database-level proofs

The pgTAP suite (`pnpm supabase:test`, 131 tests across 8 files) additionally
covers row-lock ordering, `reveal_count <= max_reveals` constraints,
lease-window idempotency, and anonymous-deny RLS on every table.

Reproduce with:

```bash
pnpm supabase:start && pnpm test:integration && pnpm supabase:test
```

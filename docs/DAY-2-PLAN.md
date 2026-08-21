# Day 2 implementation plan: lifecycle correctness

Status: **approved for implementation after the prerequisites below pass**

Audience: low-context implementation agents; follow the order and do not invent contracts

Companion: [`DAY-2-UI.md`](DAY-2-UI.md)

Production prerequisite: close
[`PRODUCTION-INCIDENT.md`](PRODUCTION-INCIDENT.md) before starting this plan.

## Outcome and boundaries

Day 2 turns the Day 1 encrypted-note slice into a lifecycle-correct service. Availability, expiry, reveal limits, retries, revocation, rate limiting, and cleanup must remain correct under concurrency. The UI exposes only policies the server enforces.

Do not begin Markdown, code highlighting, file encryption, passwords, two-channel unlock, QR codes, receipts, or analytics.

## Executor rules

1. Work in numbered order. Do not start a phase until its checks pass.
2. Before edits run `git status --short` and inspect every target file.
3. Never edit or stage `info/plan.md` or read-only references in `info/`.
4. Add migrations; never rewrite the deployed foundation migration.
5. Preserve envelope version 1 and its exact fields. Day 2 does not change crypto.
6. Repeat policy validation at client, API, and database boundaries.
7. Commit only coherent green slices using the suggested Conventional Commits.
8. After each phase update `info/HANDOFF.md` with commit, checks, result, and remainder.
9. Stop at section 14 conditions. Do not improvise.

## 1. Prerequisite and production baseline

```bash
git status --short
git log -1 --oneline
node --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile
if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; fi
.venv/bin/python scripts/verify-reproducibility.py
corepack pnpm validate
```

Baseline must include `c07804a` or a descendant. Confirm Vercel Production actually runs that commit; green GitHub CI does not prove promotion. The RPC client supports both an opaque `sb_secret_...` key and a legacy service-role JWT beginning `eyJ`. This production incident uses the opaque form; do not reject a valid legacy key.

Run a synthetic create/status/reveal smoke flow. `POST /api/shares` must return `201`, not `503`. This deployment is confirmed to use the supported `sb_secret_...` form. If production still returns `503`, stop feature work and inspect the matching Vercel function log. Confirm variable names `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `RATE_LIMIT_HMAC_KEY`, deployment commit, and the redacted Supabase error. Never record values.

## 2. Existing foundation: do not rebuild it

`20260820000000_securebin_foundation.sql` already provides shares, upload reservations, reveal leases, rate buckets, a private bucket, forced RLS, and lifecycle/cleanup RPCs. `reveal_share` already locks rows and supports retry leases. The HTTP layer already has strict share parsing, body limits, an HMACed network discriminator, and per-action rate calls.

Day 2 hardens, exposes, and proves this foundation. Do not build a parallel policy engine.

## 3. Locked lifecycle contract

| Policy | API value | Behavior |
| --- | --- | --- |
| Available now | `availableAt: null` | Active after creation |
| Scheduled | ISO UTC | Unavailable before it; earlier than expiry |
| Expiry | ISO UTC | Future, at most 30 days; unavailable at/after |
| Burn | `maxReveals: 1` | One distinct authorization lease |
| Limited | `3`, `5`, `10` | Never authorize beyond limit |
| Unlimited | `null` | Expiry and revocation still apply |
| Revoke | deletion capability | Blocks future status/reveal uniformly |

A reveal is a server authorization lease, not proof of delivery, decryption, or reading. Missing, expired, exhausted, and revoked recipients all receive exactly `{ "status": "unavailable" }` with no causal field.

Retry rules:

- create: same idempotency key and identical immutable request returns the original; conflicting reuse fails;
- reveal: same token within its lease returns the authorization without incrementing;
- revoke and cleanup are safe to retry and never resurrect state.

## 4. Freeze contracts and fixtures

Targets:

```text
lib/shares/contracts.ts
tests/unit/api/share-routes.test.ts
tests/integration/share-service.test.ts
```

Tasks:

1. Centralize `MaxReveals = 1 | 3 | 5 | 10 | null`.
2. Preserve exact-key parsing.
3. Accept all five values; reject `0`, `2`, negatives, floats, strings, and unknown fields.
4. Test past/beyond-30-day expiry, invalid UTC, and availability at/after expiry. Accept a valid availability timestamp that has just passed and make the share immediately active; client/server clock drift must not reject it.
5. Use a controllable clock; avoid wall-clock margins.
6. Add active, scheduled, unavailable, limited, and unlimited fixtures.
7. Assert invalid input never reaches the service.
8. Assert unavailable responses contain only `status`.

```bash
corepack pnpm test -- tests/unit/api/share-routes.test.ts
corepack pnpm test:integration
corepack pnpm typecheck
```

Commit: `test(policy): lock lifecycle contracts`

## 5. Database policy hardening

Create `supabase/migrations/<timestamp>_day2_policy_hardening.sql` and `supabase/tests/02_policy.sql`. Never edit the foundation migration.

### Idempotent create

Replace `create_share` in the new migration. Keep the unique `idempotency_key_hash` constraint as arbiter. Attempt the insert; on unique conflict, `SELECT ... FOR UPDATE` the existing share by that digest. Compare every immutable input and the bound upload-reservation tuple by joining `upload_reservations` on `attached_share_id = shares.id`. Return `created = false` only when all match. Otherwise raise SQLSTATE `23505` with an internal marker mapped to HTTP `409` and exactly `{ "error": "idempotency_conflict" }`; return no original ID, envelope, or policy. Add RPC/route mapping and concurrent same-key tests.

### Reveal order

In one transaction:

1. validate token digest;
2. lock share row;
3. find a live matching lease;
4. return the lease without incrementing when present;
5. check schedule, expiry, revocation, and count;
6. increment once;
7. insert lease;
8. return authorization.

Never update counters in TypeScript or split checking/incrementing.

### Revoke race

Lock the same row. Reveal-first consumes one authorization then revoke blocks later calls; revoke-first makes reveal unavailable without consumption. Tests assert invariants, not which contender wins.

Explicitly revoke lifecycle functions from `public`, `anon`, and `authenticated`; grant only intended functions to `service_role`. Preserve forced RLS and private Storage.

```bash
corepack pnpm supabase:reset
corepack pnpm supabase:test
```

Commit: `fix(db): harden lifecycle transactions`

## 6. Real concurrency and access evidence

Create `tests/integration/reveal-concurrency.test.ts` plus a dedicated serial Vitest config/script. Use local Supabase RPC, not an in-memory service fake. Read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the documented local Supabase environment. Run `pnpm supabase:reset` before the dedicated race command, never inside a normal Vitest test. Give every test unique random public IDs and idempotency digests.

Race procedure:

1. reset local Supabase;
2. create a valid `maxReveals = 1` share;
3. generate 20 distinct 32-byte tokens;
4. launch together with `Promise.allSettled`, classify every result, and fail on transport errors, `503`, malformed bodies, or any result outside authorized/unavailable;
5. assert exactly 1 authorization and 19 unavailable;
6. retry winner and assert count stays 1;
7. repeat at limit 3 and assert exactly 3;
8. retry all winners and assert count stays 3;
9. assert remaining reveals is zero.

Also test scheduled/reveal, expiry/reveal, and revoke/reveal races. Extend pgTAP to assume real `anon` and `authenticated` roles and prove they cannot select application tables, execute lifecycle RPCs, list/read private objects, or change the bucket. “RLS enabled” alone is insufficient.

Record exact race counts in `info/HANDOFF.md`.

Commit: `test(db): prove policy concurrency and RLS`

## 7. Upload reservation boundary

Day 2 builds the server primitive for Day 3 but no attachment UI.

Create:

```text
app/api/uploads/route.ts
lib/server/upload-service.ts
lib/server/storage.ts
tests/unit/api/upload-routes.test.ts
tests/integration/upload-service.test.ts
```

Remove the current attachment capability instead of replacing it with a digest that would itself be a bearer capability. Locked request:

```json
{
  "publicId": "<future share ID>",
  "idempotencyKeyHash": "<future create digest>",
  "fileEnvelope": { "objectType": "file", "ciphertext": "<absent>", "...": "..." },
  "expectedCiphertextSize": 12345
}
```

Locked end-to-end flow:

1. Browser prepares the future public ID, idempotency digest, metadata-only file envelope, and ciphertext size.
2. `/api/uploads` stores a reservation bound to that exact tuple; add the required columns and constraints in the Day 2 migration.
3. API returns only the short-lived signed Storage upload operation and expiry. No attachment token, digest, or reference is created.
4. Browser uploads ciphertext with that operation.
5. `POST /api/shares` sends its normal public ID, idempotency digest, file envelope, and size; no reservation credential.
6. `create_share` locks the one unexpired unattached matching tuple, verifies actual size, and attaches it.
7. Remove `uploadReservationCapability`, its hash call, and reservation-token SQL field/arguments in replacement functions.

Synchronize architecture, contracts, service, routes, SQL, and tests. No attachment bearer capability exists to cross HTTP or be logged.

Replacement database contract:

```sql
upload_reservations.reserved_public_id text not null
upload_reservations.idempotency_key_hash bytea not null check (octet_length(...) = 32)
upload_reservations.file_envelope jsonb not null
upload_reservations.expected_ciphertext_size bigint not null
unique (reserved_public_id, idempotency_key_hash)

create_upload_reservation(
  p_public_id text,
  p_idempotency_key_hash bytea,
  p_file_envelope jsonb,
  p_expected_ciphertext_size bigint
)

create_share(
  p_public_id text,
  p_content_envelope jsonb,
  p_available_at timestamptz,
  p_expires_at timestamptz,
  p_max_reveals integer,
  p_delete_token_hash bytea,
  p_password_required boolean,
  p_unlock_required boolean,
  p_idempotency_key_hash bytea,
  p_file_envelope jsonb,
  p_file_ciphertext_size bigint
)
```

The new migration drops `reservation_token_hash` only after replacing the RPC and tests. Validate public ID with the existing canonical helper. `file_envelope` has exactly the v1 metadata fields `version`, `objectType`, `algorithm`, `nonce`, `hkdfSalt`, `passwordSalt`, `kdf`, `kdfParameters`, and `factorMask`; `objectType` is `file` and `ciphertext` or any unknown field is rejected by both `parseFileEnvelope` and `securebin_valid_envelope`.

Drop and revoke the old 12-argument `create_share(..., bytea, jsonb, bigint)` overload and token-based `create_upload_reservation(bytea, bigint)` so they cannot remain callable. Update pgTAP `has_function`/privilege assertions, `share-service.ts` RPC mappings, contracts, mocks, and integration fixtures to the exact signatures above.

Reservation idempotency:

- same tuple and exact envelope/size while unexpired/unattached returns the existing path and a newly generated signed upload operation;
- same public-ID/idempotency pair with different envelope or size returns HTTP `409` `{ "error": "reservation_conflict" }`;
- an attached tuple returns its existing reservation state only to a create retry and `/api/uploads` returns `409` `{ "error": "reservation_attached" }`;
- an expired unattached tuple is transactionally reinitialized with a fresh random path and 15-minute expiry before issuing a new signed operation;
- cleanup treats `attached_share_id is null and expires_at <= now()` as abandoned, while attached rows follow their share lifecycle.

Lock the tuple row during reinitialization/attachment. Tests cover two concurrent identical reservations, conflicting envelopes, refreshed signed operation, expired retry, attached retry, and cleanup classification.

Server-only injectable boundary:

```ts
interface SecureStorage {
  createSignedUpload(path: string, expiresInSeconds: number): Promise<{ url: string; token?: string }>;
  createSignedDownload(path: string, expiresInSeconds: number): Promise<string>;
  inspectSize(path: string): Promise<number | null>;
  remove(path: string): Promise<"deleted" | "missing">;
}
```

Implement this adapter with pinned server-only `@supabase/supabase-js@2.50.0`; do not hand-build Storage REST authentication. Instantiate it only in a server module with service-role configuration, session persistence and refresh disabled, and the official signed-upload/download/remove APIs. Before installation, check official advisories and stop if affected. Update the pnpm lockfile and dependency rationale.

Rules: upload expiry at most 15 minutes; octet-stream; no overwrite/upsert; integer shared size bounds; random `objects/<48 hex>.bin` path; reject unknown fields, filename, MIME, plaintext, raw bytes, or ciphertext body; rate-limit before reservation; never log URL, token, path, or discriminator.

Commit: `feat(storage): add private upload reservations`

## 8. Cleanup operation

Create:

```text
app/api/internal/cleanup/route.ts
lib/server/cleanup-service.ts
tests/unit/api/cleanup-route.test.ts
tests/integration/cleanup-service.test.ts
```

Add server-only `CRON_SECRET` to config and deployment docs.

Algorithm: authenticate; list candidates; validate exact random paths; delete via Storage; treat missing as deleted; finalize only deleted/missing identifiers; preserve rows when deletion fails; return aggregate counts only.

Test expired text/file shares, revoked file shares, abandoned/attached reservations, active shares, deletion failure, missing objects, repeat execution, stale leases, and expired buckets. Do not deploy a cron; deployment remains owner-operated.

Commit: `feat(cleanup): finalize expired share state`

## 9. Safe observability and rate limiting

Create `lib/server/observability.ts`. Log only bounded request ID, route/action, status class, elapsed milliseconds, and coarse size bucket. Return `X-Request-Id` after validating or replacing inbound IDs.

Never log content, ciphertext, full URL/fragment, link secret, factors, deletion/reservation capability, request token, signed URL, raw IP, filename, or MIME.

Test upload/create/status/reveal/delete thresholds, action separation, HMACed-discriminator separation, malformed proxy headers, `429`, bucket atomicity, and absence of raw IP persistence.

Commit: `feat(api): add safe request auditing`

## 10. Day 2 UI

Follow [`DAY-2-UI.md`](DAY-2-UI.md) and the approved design system in Stitch MCP project **`SecureBin Quiet Proof Design System v1`** (`projects/12991627127209989717`). Exact mapping:

```text
Available now -> null
Scheduled local time -> validated ISO UTC
24h / 7d / 30d / Custom (1-720h) -> expiresAt ISO UTC
Burn / 3 / 5 / 10 / Unlimited -> 1 / 3 / 5 / 10 / null
```

Use pure mapping/time helpers. Double-submit must reuse prepared idempotency material until definite success or a user edit invalidates it.

Test every payload, scheduled conversion, limited confirmation, same-token uncertain retry, uniform unavailable, mobile width, keyboard/focus, announcements, dark contrast, axe, and reduced motion.

Commit: `feat(ui): expose lifecycle policy controls`

## 11. Failure matrix

| Failure | Required result |
| --- | --- |
| Malformed policy | `400`; no service/RPC call |
| Rate limit | `429`; no existence disclosure |
| Missing/expired/exhausted/revoked | uniform unavailable |
| Conflicting idempotency key | conflict; one original row |
| Lost reveal response | same token retry; no increment |
| Invalid deletion capability | no state change |
| Storage delete failure | retain recoverable row |
| Missing Storage object | treat as deleted, finalize safely |
| Upstream unavailable | redacted `503`, request ID only |

## 12. Final gate

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:integration
corepack pnpm supabase:reset
corepack pnpm supabase:test
corepack pnpm test:e2e
corepack pnpm test:a11y
corepack pnpm build
corepack pnpm validate
.venv/bin/python scripts/verify-reproducibility.py
git diff --check
```

Done requires: exactly 1/20 and 3/20 authorizations; retry counts unchanged; uniform unavailable; conflicting retries rejected; invalid revoke rejected; anonymous DB/Storage denied; cleanup failure recoverable; no raw IP/capability logs; all checks green; handoff complete.

## 13. Documentation synchronization

Update `docs/architecture.md`, `docs/policy-state.md`, `docs/deployment.md`, README, tests/evidence documentation, and `info/HANDOFF.md` when their contracts change. Record environment variable names only. Never modify `info/plan.md`.

## 14. Stop conditions

Stop for review if work would change envelope version/fields, move counters outside RPC, distinguish unavailable causes, expose/log a secret or raw IP, introduce an upload-reservation bearer capability, edit the foundation migration, permit direct anonymous access, delete DB state before Storage, use mock race evidence, pull Day 3/4 forward, add unpinned dependencies, or proceed with an unexplained production `503`.

## 15. Handoff entry

Record UTC time, baseline/deployed commit, delegated audits, commits, migration, every validation result, 1/20 and 3/20 counts, RLS and cleanup evidence, production smoke, variable names added, Day 3 prerequisites, blockers, and owner actions.

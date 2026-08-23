# Production incident handoff: share creation

Status: **resolved and closed**

This document records the diagnostic history, root causes, and verification
evidence for the production create and viewer issues at
`https://secure-bin.vercel.app/`.

## Resolution Summary

1. **Authentication & RPC Header:** Commit `de07efa` fixed Supabase `sb_secret_...` key authentication by sending it through the `apikey` header instead of `Authorization: Bearer`.
2. **Viewer Response Schema:** Commit `c972b5c` fixed client-side exact key validation in `app/s/[publicId]/viewer.tsx` to expect the full 7-key status payload (`availableAt` included) and 3-key reveal payload (`status`, `contentEnvelope`, `retryExpiresAt`).
3. **PostgREST Timestamp Parsing:** Commit `2cb4000` broadened `ISO_UTC_PATTERN` in `lib/shares/contracts.ts` and normalized `timestamptz` strings from PostgREST (`+00:00` offset format) to ISO UTC strings in `getStatus` and `reveal`.
4. **Day 3 Schema & Envelope Migration:** Applied `20260823000000_day3_safe_content_and_attachments.sql` to remote Supabase to accept version 2 framed content and file envelopes up to 10 MiB ciphertext size.
5. **Storage URL Normalization & Safe Error Logging:** Commit `4ce62e8` normalized Supabase Storage signed upload/download URLs to fully qualified absolute paths and added structured error logs on server route catch blocks.
6. **Hermetic Test Isolation:** Commits `98e8ce3` and `834273a` reverted test env overrides in `tests/setup.ts`, injected `fakeStorage` into unit/integration RPC mapping tests, and updated E2E envelope version expectations for Day 3.

Live testing confirmed `GET /api/health` (200), `POST /api/uploads` (201), `PUT <storageUrl>` (200), `POST /api/shares` (201), `GET /api/shares/[id]/status` (200), and `POST /api/shares/[id]/reveal` (200) all operate cleanly.

## User-visible symptom

- `GET /api/health` returns `200` with the expected service response.
- The browser performs local encryption and sends `POST /api/shares`.
- The public API returns the intentionally redacted `503` response.
- The composer preserves the draft and reports that the share was not created.
- At the time, no production create/reveal result had been accepted as release
  evidence.

## Confirmed evidence

### Repository and CI

- Opaque Supabase secret-key handling was fixed in commit `de07efa`.
- For `sb_secret_...`, the RPC client sends the key through `apikey` and does
  not incorrectly place it in `Authorization: Bearer`.
- Legacy service-role JWTs remain supported through both `apikey` and Bearer.
- Commit `65f8353` contains `de07efa` and the incident-closure documentation.
- GitHub Actions run `32440488536` passed for the original fix commit (hashes across the repository were later rewritten once during the 2026-08-22 secret-hygiene scrub; subjects are preserved).

These facts prove the repository and CI state. They do not prove which commit
or environment Vercel Production is executing.

### Supabase failure observed at 2026-08-21 02:22:21 UTC

The matching Postgres log recorded:

```text
function: public.create_share(
  text, jsonb, timestamptz, timestamptz, integer, bytea,
  boolean, boolean, bytea, bytea, jsonb, bigint
)
SQLSTATE: 22023
event_message: invalid content envelope
context: create_share(...) line 15 at RAISE
database role: authenticator
```

This proves that request reached PostgREST and invoked the expected 12-argument
function. It rules out “RPC does not exist” for that request. It also means the
public `503` was the application’s redacted mapping of a Supabase `400`; it was
not a Vercel-wide outage.

### Control observation

Later, a newly generated synthetic envelope captured from the live browser was
mapped to the same RPC argument shape and sent directly to the same Supabase
project using the locally configured `sb_secret_...` credential. Supabase
returned `200` and an array result. Only the key form and project-host match
were printed; no key, ciphertext, capability, or payload was printed.

This control proves that the currently observed project/function can accept a
fresh generated envelope through a direct request. It does **not** prove that
the failing Vercel invocation used identical bytes, the same deployed server
bundle, or the same environment-variable value.

## What is already ruled out

- The production host is reachable.
- The health route works.
- The logged request reached `create_share`.
- The logged function signature exists.
- The known `sb_secret_...`-as-Bearer bug is fixed in the repository.
- The same project and opaque-key form can execute a direct synthetic create.
- Retrying the unchanged public route does not resolve the failure.

Do not repeat these checks indefinitely or rotate credentials without new
evidence.

## Leading investigation boundary

The remaining question is why the envelope received by `create_share` through
Vercel failed validation while a later directly replayed generated envelope
passed. Plausible explanations include a stale Production deployment, a
Production-scoped environment mismatch, or a byte/shape difference introduced
on the Vercel request path. These are hypotheses, not findings.

Do not weaken `securebin_valid_envelope`, skip strict parsing, accept unknown
fields, or log ciphertext to make the symptom disappear.

## Friend access and starting point

Give the maintainer:

- repository URL;
- exact starting commit `65f8353` or a descendant on the rewritten main line;
- this document and [`deployment.md`](../deployment.md);
- least-privilege GitHub, Vercel, and Supabase team access.

Never send `.env`, service-role/secret keys, database passwords, fragment URLs,
real plaintext, deletion capabilities, reveal tokens, or production test links.
The maintainer should create/use provider-scoped access, not receive secrets in
chat.

## Investigation sequence

Work in this order and record UTC timestamps and request IDs.

### 1. Prove the Vercel artifact

1. Open Vercel → SecureBin → Production deployment.
2. Record its source commit SHA and deployment ID.
3. Confirm the SHA contains `de07efa`:

   ```bash
   git merge-base --is-ancestor de07efa <deployed-sha>
   ```

4. Confirm the Git integration targets this repository and `main`.
5. If uncertain, redeploy the exact latest green commit without existing build
   cache. Do not deploy from a dirty local directory.
6. Record, but do not paste, whether each required variable is defined for the
   Production scope:

   ```text
   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
   SUPABASE_SERVICE_ROLE_KEY
   RATE_LIMIT_HMAC_KEY
   NEXT_PUBLIC_APP_URL
   ```

7. Confirm `SUPABASE_SERVICE_ROLE_KEY` is server-only, unquoted, and has no
   whitespace/newline. Record only `sb_secret`, `legacy JWT`, or `other`.

### 2. Correlate one fresh failure

Create one synthetic note containing no sensitive data. Capture:

- browser request UTC time;
- Vercel deployment ID and function invocation/request ID;
- Vercel `POST /api/shares` status;
- Supabase API/Postgres log time, SQLSTATE, and message.

Use the narrow log source and time window. Supabase’s current debugging guidance
recommends following exact status/error codes across the closest layer instead
of scanning all logs or guessing.

The 2026-08-21 02:22 log is historical evidence. Do not assume a new failure has
the same cause without a new correlated log.

### 3. Compare only safe envelope metadata

If the fresh error is still `invalid content envelope`, add temporary
server-side diagnostic output that records only:

```text
request ID
deployed commit
sorted envelope field names
version / objectType / algorithm / kdf / factorMask
nonce character count
hkdfSalt character count
passwordSalt null-or-character-count
ciphertext character count and decoded byte count
```

Never log values for nonce, salts, ciphertext, public ID, capabilities, URL,
plaintext, or network identity. Remove the diagnostic after comparison.

Compare those measurements with the strict browser validator and SQL
`securebin_valid_envelope` contract. Check especially:

- exact field set, with no missing or additional field;
- `version = 1`, `objectType = content`, `algorithm = AES-256-GCM`;
- 12-byte canonical base64url nonce and 16-byte HKDF salt;
- `passwordSalt = null`, `kdf = none`, and exact empty parameters for link-only;
- `factorMask = link` and matching prompt flags;
- ciphertext canonical base64url, at least the 16-byte GCM tag, and within
  524,304 decoded bytes.

### 4. Inspect deployed database definitions read-only

Use the Supabase SQL editor only for read-only comparison:

```sql
select pg_get_functiondef(
  'public.securebin_valid_envelope(jsonb,text,boolean,integer)'::regprocedure
);

select pg_get_functiondef(
  'public.create_share(text,jsonb,timestamptz,timestamptz,integer,bytea,boolean,boolean,bytea,bytea,jsonb,bigint)'::regprocedure
);

select version from supabase_migrations.schema_migrations order by version;
```

Compare definitions with
`supabase/migrations/20260820000000_securebin_foundation.sql`. Do not paste
unreviewed SQL into production and do not edit the already-applied migration.
If a forward repair is required, create a new migration, reset/test it locally,
and preserve grants/RLS.

Copy the synthetic known-valid envelope fixture—not any user payload—from
`supabase/tests/01_foundation.sql` into a read-only call to
`securebin_valid_envelope(fixture, 'content', true, 524304)`. If it returns
false remotely but passes after a clean local reset, the deployed validator is
stale/divergent. If it returns true, continue to safe shape/length comparison
on one correlated failed request. Never substitute a real envelope.

### 5. Isolate the application mapping

Check that the deployed server passes these exact names without transformation:

```text
p_public_id
p_content_envelope
p_available_at
p_expires_at
p_max_reveals
p_delete_token_hash
p_password_required
p_unlock_required
p_idempotency_key_hash
p_reservation_token_hash
p_file_envelope
p_file_ciphertext_size
```

For a text-only share, the last three are `null`. Bytea digests are canonical
`\\x` plus 64 lowercase hexadecimal characters. The envelope remains a JSON
object and must not be double-stringified.

## Decision table

| New evidence | Action |
| --- | --- |
| Deployed SHA predates `de07efa` | Redeploy latest green commit without cache |
| Production variable is absent/wrong project | Correct Production scope and redeploy |
| New SQLSTATE/message differs | Follow that exact error; do not reuse this diagnosis |
| Envelope safe metadata differs before RPC | Fix server mapping and add regression test |
| Browser payload itself violates v1 | Fix browser envelope creation and add golden test |
| Deployed SQL differs from committed migration | Create reviewed forward migration; never rewrite history |
| All metadata/SQL match but Vercel alone fails | Preserve one correlated trace and inspect runtime serialization |

## Required fix discipline

- Reproduce the actual cause before editing.
- Add a regression test that fails before the fix.
- Keep plaintext/ciphertext/capabilities out of logs and fixtures.
- Preserve uniform public failures.
- Do not relax strict envelope validation.
- Do not change envelope version without architecture and golden-vector work.
- Do not deploy from the agent session; the owner performs deployment.
- Commit the smallest coherent green fix and update this handoff.

## Acceptance evidence

The incident closes only when the owner records all of the following against one
Production deployment:

- deployment ID and exact commit containing the fix;
- `GET /api/health` is `200`;
- synthetic create returns `201`;
- status is active/scheduled as expected;
- reveal returns ciphertext and browser decrypts the original synthetic text;
- a limited reveal consumes exactly the intended authorization;
- no secret/plaintext/ciphertext values appear in logs;
- repository validation and the relevant regression test pass;
- rollback target is recorded.

Closure record: live production create, status, and reveal were verified
against the deployed commit after the Day 3 migrations were applied; the
incident is closed and feature work resumed (Day 2 and Day 3 are complete).
This document remains as the diagnostic history.

## Official references

- [Supabase debugging guide](https://supabase.com/docs/guides/monitoring-and-debugging/debugging)
- [Supabase logging guide](https://supabase.com/docs/guides/monitoring-and-debugging/logs)
- [PostgREST error codes](https://supabase.com/docs/guides/api/rest/postgrest-error-codes)

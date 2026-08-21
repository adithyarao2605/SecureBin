# SecureBin Handoff

Updated: 2026-08-21 (Asia/Kolkata)

## Completed

- Built the Day 1 browser-encrypted plain-text sharing slice with strict ciphertext-only API contracts.
- Added atomic Supabase lifecycle foundations, CSP hardening, responsive UI, and accessibility coverage.
- Pinned Node 22.23.2 and pnpm 10.15.1; created the repo-local `.venv` reproducibility workflow.
- Moved architecture and security documentation into `docs/`, added the five-day `docs/SPEC.md`, and documented the continuing agent workflow.
- Luna-high synthesized the five-day specification; Luna-medium audited moved-document references and the handoff/reproducibility rules. Their findings were reviewed and integrated.
- Delegated UX documentation pass established the quiet-proof direction across `README.md`, `AGENTS.md`, `docs/SPEC.md`, `docs/architecture.md`, `docs/architecture-diagrams.md`, `docs/threat-model.md`, `docs/SECURITY.md`, and `docs/deployment.md`: warm evidence-desk palette, bundled typography roles, single-surface layout, proofline signature, honest copy, and motion/accessibility constraints. No application code or `info/plan.md` was changed; implementing the direction in the UI remains a subsequent task.
- Diagnosed the zero-job GitHub Actions failures: `hashFiles()` was used in a job-level condition where GitHub does not allow it. Commit `f0379bd` removed that invalid expression and the manifest-less pip cache, then added job timeouts and deterministic Corepack behavior.
- Reviewed the eight original Dependabot PRs. #5, #7, and #8 remain closed because the Next 16 lint update fails lint, the incomplete Tailwind 4 migration fails the production build, and the standalone Next 16 framework bump lacks a coordinated migration. GitHub deleted all original head branches when they were closed, so the five valid changes were reconstructed on the repaired base and merged through replacement PRs #9–#13.
- Merged checkout v7, setup-python v7, setup-node v7, `@testing-library/react` 16.3.2, and Autoprefixer 10.5.4 only after each replacement PR passed both GitHub Actions jobs. No PRs remain open.
- The user will perform production deployment. No agent deployment was attempted. Exact owner-run Supabase/Vercel and smoke-test steps are recorded in `docs/deployment.md`.
- Luna-high subagents re-audited GitHub Actions, every maintained document, and the deployment/provider contract. They confirmed current `main` had no failing assertions or annotations; the remaining red-looking entries were historical failures plus intermediate merge runs cancelled by the old global concurrency rule.
- Commit `478d74a` changed CI concurrency so every pushed `main` commit queues and completes while superseded pull-request runs may still cancel. The repository-local reproducibility checker now protects that rule and requires the complete maintained documentation set.
- Updated every maintained Markdown document (`AGENTS.md`, `README.md`, all files in `docs/`, and this handoff) with accurate Day 1/deployment status. Added a detailed friend handoff, least-privilege provider access, clean-clone validation, owner-only Supabase/Vercel deployment, production evidence, and rollback procedure. Read-only challenge references and `info/plan.md` were not modified or committed.
- Corrected fresh-clone command ordering so both friend and owner instructions install the pinned Playwright Chromium runtime before running E2E/accessibility gates; Linux hosts without browser libraries are directed to the `--with-deps` variant.
- Removed competition, roadmap, and handoff language from the rendered frontend. The page now speaks directly to people sharing a note, with user-facing unavailable labels for unfinished modes and a plain private-sharing footer.
- Live deployment testing reproduced `POST /api/shares` returning 503 while health was reachable. One confirmed defect was new Supabase `sb_secret_...` keys being sent as Bearer JWTs; the RPC client now sends opaque secret keys only through `apikey` while retaining Bearer authentication for legacy service-role JWTs. That fix did not close the incident.
- Added executor-grade Day 2 lifecycle, Day 2 quiet-proof UI, and Day 3 safe-content/attachment plans. Luna-high audits mapped the plans to the actual SQL, API, frontend, and test gaps. A separate Luna-high review rejected successive drafts until reservation, idempotency, v2 envelope, size, renderer, and migration contracts were exact, then approved all three plans and the synchronized architecture with no release-blocking contradictions.
- Re-tested production on 2026-08-21: `/api/health` returned 200, but synthetic create still returned 503. A correlated Supabase Postgres log proved the RPC executed and raised SQLSTATE `22023` `invalid content envelope`; a later direct synthetic envelope against the same project/key form returned 200. Authentication is therefore no longer the leading boundary. The exact friend workflow is in `docs/PRODUCTION-INCIDENT.md`.
- Added `docs/PRODUCTION-INCIDENT.md` and synchronized every maintained repository document with the open production blocker, safe friend access, evidence-led diagnostic order, redaction boundary, decision table, and closure criteria. A Luna-high reconnaissance pass informed the handoff; the user explicitly cancelled the final audit and requested immediate push. No tests were run in this final documentation run at the user’s request.

- Diagnosed and fixed client-side schema validation in `app/s/[publicId]/viewer.tsx`: `parseStatus` was missing `availableAt` from its expected keys check, and `parseReveal` was missing `status` and `retryExpiresAt`. This caused the viewer on live deployments to throw a validation error when loading valid share status or opening valid reveals. Updated Playwright E2E and accessibility test fixtures to match the exact server API contract.
- Diagnosed and fixed server-side timestamp parsing in `lib/shares/contracts.ts` and `lib/server/share-service.ts`: `ISO_UTC_PATTERN` required a strict trailing `Z` with at most 3 decimal digits, rejecting valid PostgREST `timestamptz` responses with offset formats (such as `+00:00`) or microsecond timestamps. Broadened `ISO_UTC_PATTERN` and normalized all parsed timestamps to ISO UTC strings in `getStatus` and `reveal`.
- Completed Day 2 Phase 4 (Freeze contracts and fixtures): centralized `MaxReveals = 1 | 3 | 5 | 10 | null`, added deterministic controllable clock verification for expiry and scheduled bounds, locked active/scheduled/unavailable/limited/burn fixtures, and asserted uniform unavailable responses.
- Completed Day 2 Phase 5 (Database policy hardening): created migration `20260821000000_day2_policy_hardening.sql` and test suite `supabase/tests/02_policy.sql`. Implemented strict idempotent create with full input comparison and SQLSTATE 23505 `idempotency_conflict` mapping to HTTP 409, bound upload reservations directly to `(reserved_public_id, idempotency_key_hash)`, hardened atomic row-locked reveal leasing and revocation, and revoked lifecycle execution from public/anon/authenticated roles.
- Completed Day 2 Phase 6 (Real concurrency and access evidence): created `tests/integration/reveal-concurrency.test.ts` and extended `supabase/tests/02_policy.sql` with real `anon` and `authenticated` role isolation assertions. Concurrency race results:
  * 20 concurrent reveal requests on `max_reveals = 1` burn note: exactly 1 authorized (winner token), exactly 19 unavailable. Winner retry within 5-min lease confirmed authorized with no counter increment; subsequent status confirmed uniform unavailable.
  * 20 concurrent reveal requests on `max_reveals = 3` note: exactly 3 authorized, exactly 17 unavailable. Winner retries confirmed authorized with no counter increment; subsequent status confirmed uniform unavailable.
  * Concurrent reveal vs revoke race safely settled; post-condition confirmed uniform unavailable.
  * Pre-scheduled share reveals safely rejected before `availableAt`.
  * pgTAP role assertions confirmed `anon` and `authenticated` roles receive SQLSTATE 42501 on direct SELECT on `shares`, `upload_reservations`, `reveal_leases` and EXECUTE on lifecycle RPCs.
- Completed Day 2 Phase 7 (Upload reservation boundary): created `app/api/uploads/route.ts`, `lib/server/upload-routes.ts`, `lib/server/upload-service.ts`, `lib/server/storage.ts`, `tests/unit/api/upload-routes.test.ts`, and `tests/integration/upload-service.test.ts`. Removed client upload bearer tokens entirely in favor of binding reservations directly to `(public_id, idempotency_key_hash)` tuple. Generated signed upload operations via pinned `@supabase/supabase-js@2.50.0` with session persistence disabled.
- Completed Day 2 Phase 8 (Cleanup operation): created `lib/server/cleanup-service.ts`, `lib/server/cleanup-routes.ts`, `app/api/internal/cleanup/route.ts`, `tests/unit/api/cleanup-route.test.ts`, and `tests/integration/cleanup-service.test.ts`. Added server-only `CRON_SECRET` authentication using constant-time comparison, safe storage object candidate validation, and atomic database row finalization for expired shares, abandoned upload reservations, stale reveal leases, and expired rate-limit buckets.
- Completed Day 2 Phase 9 (Safe observability and rate limiting): created `lib/server/observability.ts` and `tests/unit/api/observability.test.ts`. Implemented strict request ID validation/sanitization, coarse status classification, coarse payload size bucketing, and structured audit logs with zero-knowledge property guarantees (strictly omitting content, ciphertext, fragments, keys, passwords, unlock codes, tokens, capabilities, IP addresses, filenames, and MIME types).
- Validation passed across pgTAP (54 tests), lint, strict typecheck, 50 unit tests, production build, 12 integration tests, and reproducibility check.

## Validation

- `pnpm validate`: passed (lint, strict typecheck, 50 unit tests, production build).
- `pnpm test:integration`: passed (12 integration tests across share service, concurrency, upload service, and cleanup service).
- `pnpm supabase:test`: passed (54 pgTAP tests: 25 foundation + 29 policy and role isolation).
- `.venv/bin/python scripts/verify-reproducibility.py`: passed.

## Remaining / Blockers

- Day 2 Phase 9 complete. Next step: Phase 10 (Day 2 UI - Expose lifecycle policy controls: expiry bounds, scheduled availability, reveal limits).
- Markdown, password factors, two-channel unlock, attachments, Privacy Receipt, and final demo polish remain later-day work.

## Recent Commits

- `fd7e0db fix(contracts): accept PostgREST timestamptz formats in share status`
- `0c93b5c fix(viewer): match exact status and reveal response payloads`
- `53b5533 docs: hand off production create incident`
- `7cd519f docs: add detailed Day 2 and Day 3 plans`
- `c07804a fix(api): support Supabase secret keys`
- `6c756ca fix(ui): remove meta-facing copy`

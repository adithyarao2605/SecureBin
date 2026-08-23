# SecureBin Handoff

Updated: 2026-08-24 (Asia/Kolkata) — **handoff to the next agent**

## Read this first

- Active roadmap: **`info/plan_v3.md`** (Phases A–G, in order, green gates
  between phases). **Phases A–D are complete.** The next agent starts with
  Phase E pre-Day-6 hardening.
- Day 6/7 detail: `docs/DAY-6-PLAN.md` / `docs/DAY-7-PLAN.md` (referenced by
  plan_v3 Phases F/G). Historical day plans and the resolved incident:
  `docs/archive/`.
- Branch model: develop on `dev` (Vercel preview); `main` is production.
  Keep them identical at each push. Commit messages: short conventional
  subjects, **no day references**.
- Stitch MCP: project `SecureBin Quiet Proof Design System v1`
  (`projects/12991627127209989717`) holds the approved design system. A
  landing-screen generation attempt hit a service "entity not found" error —
  retry, or create a fresh project if it persists.

## Current state (Phases A–D complete; Phase E production slice complete; latest code is uncommitted)

- `/` is now the screenshot-led landing page: black/teal two-column hero,
  three-tab header (`New share`, `My shares`, `How it works`), right-aligned
  `Create share`, local aurora canvas, composer mock, self-hosting section,
  and compact footer.
- `/new` owns the working composer, history desk, and how-it-works app panel.
  Landing tab links open `/new`, `/new#history`, and `/new#how-it-works`.
- The old root composer was extracted to `app/components/app-workspace.tsx`;
  route-specific tests now use `/new`. Duplicate `public/icon.svg` was
  removed because `app/icon.svg` already owns that route.
- Phase B is complete: Code language selector is grouped directly beside Code,
  QR content is centered, Markdown preview styles are scoped, and Privacy
  Receipt is a native collapsible disclosure directly under Copy link.
- Phase C is complete: comment edit/delete uses random client-held proof tokens,
  SHA-256 digests server-side, `edited_at`, and orphan reply markers.
- Phase D is complete: `POST /api/shares/status-batch` and
  `get_share_status_batch(text[])` refresh the visible history desk in one
  capped request with localStorage merge and one refreshing indicator.
- Phase E production slice is complete: `pnpm test:e2e:prod` runs all 12
  Playwright flows against `next start`; the remaining Phase E backlog is not
  yet a green Day 6 entry gate.

## Previous shipped state (before Phase A)

- **Days 1–5 shipped and live in production**
  (https://secure-bin.vercel.app). Day 4: password factor (PBKDF2 600k),
  two-channel unlock codes, factor gates, QR/share actions, Privacy Receipt,
  pre-flight disclosure. Day 5: custom reveals 1–100, Never expiry, Markdown
  Edit/Split/Preview, code mode (detection/line numbers/download), multi-file
  attachments (≤5, slot-staged, Download-all ZIP), drag-and-drop, encrypted
  discussions (capability model, SBCT 0x02 trailer), policy presets removed
  by owner decision.
- **Prod verified live** via Playwright MCP: three-tab app restored, styled
  Markdown reveal, health 200. All migrations `20260826000000`–`20260829000000`
  applied to hosted Supabase (verified via `migration list`).
- **Refactors landed**: composer 753→~298-line shell + `app/components/composer/*`
  + `app/hooks/use-staged-create.ts`; viewer 749→~283 shell +
  `viewer-contracts.ts`/`viewer-parts/*`; `app/globals.css` split into
  `app/styles/*.css` partials (note: the split dropped the viewer header and
  markdown typography blocks — both restored; if styles ever "vanish", diff
  partials against the pre-split monolith).
- **UI decisions**: three-tab layout restored (owner preference); language
  selector is grouped next to the Code tab; Privacy Receipt is a native
  collapsible disclosure directly below Copy link.

## Validation (rerun these; numbers recorded at last green)

`pnpm validate` (lint, typecheck, 159 unit tests, build) · `pnpm test:integration`
(16) · `pnpm supabase:test` (131 pgTAP, 8 files) · `pnpm test:e2e` (12,
**workers: 1 — do not raise**, dev-server compile races flake parallel runs)
· `pnpm test:e2e:prod` (12) · `pnpm test:a11y` (3) · reproducibility script ·
`pnpm audit --audit-level=high` clean. Final rerun: all listed gates green on
2026-08-24.

## Known limitations (accepted, documented)

- Wrong client-only factors consume an authorization (server cannot verify
  without breaking zero-knowledge).
- Reveal lease is consumed before the signed URL is minted; after the 5-minute
  lease window a retry spends a second authorization.
- Rate limiting trusts client-forwarded headers off Vercel.
- The default E2E suite runs against `next dev`; `pnpm test:e2e:prod` now
  covers the same flow against `next start`.
- Discussion capability is a bearer secret held by revealed recipients.

## Phase E decision blocker

- Secure Drop has not been implemented. It needs an explicit protocol decision
  before code changes because recipient-bound sharing is currently deferred in
  `docs/architecture.md`.
- The proposed shape is a separate ECDH P-256 + HKDF-SHA-256 drop envelope,
  requester private key retained in IndexedDB, one response per request,
  bounded request expiry, and atomic request/response lifecycle RPCs. It must
  not extend the existing share envelope.
- Owner decisions required: IndexedDB-only private key persistence versus an
  encrypted recovery export; one response versus multiple responses; request
  expiry/revocation policy; and whether the public key is carried in the URL
  versus trusted from the server record.

Delegated exploration on 2026-08-24 confirmed the above boundary and listed
the required crypto, API, database, storage, UI, test, and documentation
surfaces. No files were edited by the delegate.

## Gotchas

- `pnpm test:e2e` starts its own dev server on :3100 — kill stray listeners
  (`fuser -k 3100/tcp`) or it fails with EADDRINUSE.
- Playwright browser build must match the pinned `@playwright/test`; if
  install hangs at "extracting archive", unzip manually into
  `~/.cache/ms-playwright/<build>` and touch `INSTALLATION_COMPLETE`.
- `supabase status -o env` emits quoted values — strip quotes when exporting.
- CI extracts the local service key at runtime from `supabase status`; no
  repository secret is needed. Never reintroduce key material into the tree
  or history (a filter-repo scrub already happened once).

## Next steps (in order)

1. Continue `info/plan_v3.md` Phase E: Secure Drop, recipient acknowledgment,
   self-host commands, expanded Axe/perf coverage, and evidence pack.
2. Start Phase F / Day 6 only after the pre-Day-6 entry gate is green; then
   follow `docs/DAY-6-PLAN.md` and `docs/DAY-7-PLAN.md` (Day 6 exit gate
   before Day 7; freeze means freeze).
3. Keep `info/HANDOFF.md` updated at the end of every run.

## Recent Commits

- `b4947a4` docs(day6): plan comment edit/delete, my-shares batch status sync, rubric backlog
- `60aa696` feat: add landing route and app split
- `029833c` docs: record landing handoff
- `1961f79` docs(handoff): production migrations applied and live flow verified
- `c730535` fix(ui): restore three-tab layout, markdown preview typography, preset/unlock explanations
- `4658c5e` fix(day5): audit remediation batch
- `963ab8c` fix(e2e): single Playwright worker + doc count refresh

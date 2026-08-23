# SecureBin Handoff

Updated: 2026-08-23 (Asia/Kolkata) — **handoff to the next agent**

## Read this first

- Active roadmap: **`info/plan_v3.md`** (Phases A–G, in order, green gates
  between phases). Your first task is **Phase A: landing page at `/`** and
  moving the app to `/new`.
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

## Current state (all green at `1961f79` + doc commit)

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
  selector themed next to the Code tab; Privacy Receipt currently a card —
  plan_v3 Phase B converts it to a dropdown under Copy link.

## Validation (rerun these; numbers recorded at last green)

`pnpm validate` (lint, typecheck, 145 unit tests, build) · `pnpm test:integration`
(14) · `pnpm supabase:test` (115 pgTAP, 7 files) · `pnpm test:e2e` (10,
**workers: 1 — do not raise**, dev-server compile races flake parallel runs)
· `pnpm test:a11y` (2) · reproducibility script · `pnpm audit` clean.

## Known limitations (accepted, documented)

- Wrong client-only factors consume an authorization (server cannot verify
  without breaking zero-knowledge).
- Reveal lease is consumed before the signed URL is minted; after the 5-minute
  lease window a retry spends a second authorization.
- Rate limiting trusts client-forwarded headers off Vercel.
- E2E runs against `next dev`, not the production build (plan_v3 Phase E #1).
- Discussion capability is a bearer secret held by revealed recipients.

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

1. Implement `info/plan_v3.md` Phase A (landing at `/`, app at `/new`),
   including the e2e path updates.
2. Phase B UI fixes, then C/D/E with green gates.
3. Phases F/G per `docs/DAY-6-PLAN.md` / `DAY-7-PLAN.md` (Day 6 exit gate
   before Day 7; freeze means freeze).
4. Keep `info/HANDOFF.md` updated at the end of every run.

## Recent Commits

- `b4947a4` docs(day6): plan comment edit/delete, my-shares batch status sync, rubric backlog
- `1961f79` docs(handoff): production migrations applied and live flow verified
- `c730535` fix(ui): restore three-tab layout, markdown preview typography, preset/unlock explanations
- `4658c5e` fix(day5): audit remediation batch
- `963ab8c` fix(e2e): single Playwright worker + doc count refresh

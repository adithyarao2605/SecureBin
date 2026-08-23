# SecureBin — Plan v3 (active roadmap)

Status: **Phases A–D complete — Phase E pre-Day-6 hardening next**

This document replaces `info/plan_v2.md` and the per-day plan files as the
single active roadmap. Days 1–5 of the original five-day delivery are
implemented, tested, and live in production; their history lives in
`docs/archive/`. Day 6/7 scope from plan_v2 is absorbed into the phases below
alongside everything approved since.

Source-of-truth order: `docs/architecture.md` → `AGENTS.md` → this file.
If this file conflicts with architecture on security or protocol details,
stop and ask instead of guessing.

## Route architecture

- `/` — public marketing landing page (Phase A complete). No secrets, no composer.
- `/new` — the sharing application: three-tab shell (New share / My shares /
  How it works), unchanged functionally. E2E paths now target this route.

## Non-negotiable rules (unchanged)

Plaintext, fragment secrets, passwords, unlock codes, raw capabilities, and
plaintext filenames/MIME never reach the server or logs. Fresh nonce per
encrypted object. Atomic server-side lifecycle enforcement. A reveal is an
authorization lease, not proof of reading. No third-party scripts, fonts, or
remote media on any route that handles secrets — including the new landing
page assets, which are self-hosted or generated locally.

## Phase A — Landing page + brand

- `/` renders the approved dark OLED design: aurora background, hero
  ("Share sensitive information. / Stay in control."), subcopy, CTAs
  ("Create a Secure Share" → `/new`; "Self-Hosting" → self-hosting section),
  floating feature pills, decorative mock composer card, footer.
- Header reuses the app's three-tab pattern: brand group ("SecureBin"),
  pill tabs **New share → `/new`**, **My shares → `/new#history`**, and
  **How it works → `/new#how-it-works`**, plus the screenshot's right-aligned
  **Create share → `/new`** action.
- Aurora = local canvas component running the teal/indigo shader;
  `prefers-reduced-motion` and no-WebGL fall back to a static gradient.
  Fonts use a system font stack naming the display/body faces ahead of
  fallbacks (no webfont files bundled). Material-symbol icons replaced with
  existing inline SVGs. Zero remote requests.
- Light theme variant derived from tokens; reduced-motion honored.
- The landing keeps the how-it-works and self-hosting sections below the hero;
  the header tab opens the full app explanation panel.

Implementation note: Phases A–D are complete in the current branch. The
landing is responsive, uses a local canvas atmosphere with reduced-motion
handling, and has dedicated E2E/a11y coverage. Phase B grouped the code
selector, centered QR, scoped Markdown preview, and collapsible Privacy Receipt
under Copy link. Phase C added comment edit/delete proof tokens and Phase D
added capped batch status refresh.

## Phase B — App UI fixes (complete)

1. Code language selector sits immediately right of the Code tab (one flex
   row, no gap); themed dropdown styles retained.
2. QR panel content centered.
3. Markdown preview typography restored/scoped so headings, lists, tables,
   and code render styled in the composer preview pane.
4. Privacy Receipt becomes a collapsible dropdown directly beneath the
   "Copy link" action.

## Phase C — Discussions v1.1 (edit & delete, complete)

Per-comment random edit token; server stores only its SHA-256 digest; the
raw token persists client-side (`securebin_comment_tokens_v1`). Edit sets a
new body envelope + `edited_at` (shown as "(edited)"); delete hard-removes
the row (orphaned replies render as "[comment removed]"). Both inherit the
discussion lifecycle gate and rate limits. RPCs `edit_share_comment` /
`delete_share_comment`; API `PATCH|DELETE .../comments/:commentId`; pgTAP for
wrong token / wrong capability / expired share / orphan handling. Losing the
local token makes a comment read-only — documented, accepted.

## Phase D — My-shares batch status sync (complete)

RPC `get_share_status_batch(text[])` (≤50 ids, service-definer, uniform
unavailable rows) behind `POST /api/shares/status-batch`. History desk fires
one request on open, on window focus while visible, and after create/reveal/
revoke; results merge into localStorage. Single desk-level refreshing strip
replaces per-item polling.

## Phase E — Pre-Day-6 hardening and rubric backlog (next, in priority order)

1. E2E against production build (`next start`) instead of dev server (**complete**:
   `pnpm test:e2e:prod`).
2. Secure Drop request links (contributor-side encryption to requester's
   public key; standard WebCrypto only).
3. Recipient acknowledgment button (release time vs explicit ack time; never
   called a read receipt).
4. Self-host scripts pulled forward (`pnpm local:setup | local | local:stop`),
   with the runbook created in Phase F.
5. Axe coverage: factor gate, opened view, discussion thread, mobile.
6. Perf pass: bundle analysis, mobile LCP measurement, Worker decision for
   large-file encryption based on real numbers.
7. Evidence pack: concurrency run records under `docs/evidence/`, diagram
   refresh, demo-script rehearsal checklist.

Pre-Day-6 gate status: Phases B–D and the production-build E2E slice are
complete. Secure Drop, recipient acknowledgment, self-host commands, and the
evidence/performance backlog remain deferred until this gate is recorded green
and Day 6 is started.

## Phase F — Day 6 scope (reveal window, veil, self-host, parcels)

Detail: `docs/DAY-6-PLAN.md` §1–6. In order: finish any discussion residue →
reveal window (server-recorded first-release window + local hide timer, honest
copy) → privacy veil (local hide/Esc/auto-blur; never "screenshot prevention")
→ self-host scripts (`pnpm local:setup | local | local:stop`, fresh-clone
verified, with a runbook created during this slice) → `.securebin` encrypted parcel export/
import with fully offline decryption → local-only sender manager upgrades →
expanded Privacy Receipt fields → ciphertext-size padding only if provably
stable (else explicitly deferred in HANDOFF). Stretch items (Secure Drop,
acknowledgment, short links, strength meter, inline PDF, QR parcel transfer)
only after every required item is green.

## Phase G — Day 7 scope (freeze, validation, submission)

Detail: `docs/DAY-7-PLAN.md`. No new features. Fresh-clone verification;
production smoke matrix across every shipped feature; hero concurrency
evidence (100-request exact-N, lost-response retry) saved under
`docs/evidence/`; security audit checklist; Chromium/Firefox/mobile passes;
axe critical = 0 with serious reviewed; perf measurement; repo cleanup
(archive noise, no PrivateBin checkout in judge tree, no generated files);
code-split sanity; judge-first README + rubric evidence table; rehearsed demo;
submit early with buffer.

## Doc consolidation map

- `docs/archive/`: DAY-2-PLAN, DAY-2-UI, DAY-3-PLAN, DAY-4-PLAN, DAY-5-PLAN,
  PRODUCTION-INCIDENT (historical record only).
- Active at docs root: SPEC (standing contracts + shipped summary),
  architecture(+diagrams), threat-model, deployment, policy-state,
  DAY-6-PLAN/DAY-7-PLAN (Day 6/7 detail retained at owner request).
- Commit messages: short conventional subjects; no day references.

## Gates

Each phase lands green: typecheck, unit, lint; full `pnpm validate`,
integration, pgTAP, e2e, a11y, reproducibility before push; Playwright
behavior pass against production; secrets audit before final push.
Phase F exit = Day 6 exit gate (docs/DAY-6-PLAN.md §"Day 6 exit gate").
Phase G exit = submission checklist complete (docs/DAY-7-PLAN.md).

## Explicit non-goals (unchanged from plan_v2 §9)

Accounts/passkeys, rooms/realtime, moderation or comment histories beyond
edit/delete above, Argon2id/WASM, multi-DB/Kubernetes, localization waves,
PrivateBin compatibility, blockchain/AI add-ons.

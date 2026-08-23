# Day 5 implementation plan: content breadth, multi-file, custom policies, discussions

Status: **implemented and verified — see [Outcome](#outcome) at the end**

Audience: low-context implementation agents. Source of truth for scope:
`info/plan_v2.md` §3; where that file and this document differ, this document
wins on execution detail, `docs/architecture.md` wins on protocol.

## Outcome and non-goals

Turn SecureBin into a complete sharing product: rich Markdown authoring,
code mode with local auto-detection, multiple encrypted attachments with safe
previews and Download All, custom reveal counts, custom expiry plus Never,
policy presets, a product landing layer, and encrypted discussions.

Do not add reveal windows, privacy veil, parcels, self-host scripts, padding,
accounts, editing/deletion of comments, WebSockets, or moderation (Day 6/7 or never).

## 1. Entry gate

Day 4 exit gate green (passwords, two-channel, receipt, share actions, viewer
states, no known blank-screen bug); `pnpm validate`, integration, pgTAP, e2e,
a11y green; production create/reveal verified including factors.

## 2. Locked contracts before code

- **Envelope:** still v2 only; no new fields. Markdown/code remain SBCT modes
  `0x01`/`0x02`. Auto-detected language is **never** sent as server metadata —
  it rides inside the already-encrypted payload only.
- **Multi-file:** generalize to N attachments with bounded count (≤5) and
  aggregate ciphertext size; each object keeps its own random Storage path,
  fresh nonce, staged reservation, size verification, rotation cleanup.
  DB change required: replace the single `file_*` columns with an
  `attachments` child table (forward migration + RPC update + RLS/grants +
  pgTAP). Reveal returns an attachment array; signed URLs stay 60-second.
- **Custom reveals:** widen `MaxReveals` to integer range 1–100
  (`max_reveals between 1 and 100` constraint migration), UI numeric input
  bounded client+server, concurrency tests at custom limits.
- **Never expiry:** `expires_at nullable`; status/RPC branches treat NULL as
  non-expiring but always revocable; cleanup ignores NULL; receipt prints
  "Never". Unlimited-reveals ≠ Never-expiry stays true.
- **Discussions capability model:** random per-share discussion capability;
  only its digest stored; raw capability lives inside the encrypted main
  share; post/fetch require it. Separate HKDF label
  `securebin/v2/{mask}/discussion`; fresh nonce per comment; encrypt body,
  nickname, and format flags. Append-only thread table with parent-reply
  pointer; lifecycle inherits parent (expired/revoked/unavailable ⇒ disabled);
  rate-limited via the existing discriminator mechanism.

## 3. Build slices

1. Markdown Edit/Split/Preview (mobile = toggle), sanitizer unchanged.
2. Code mode: local detection (content heuristics only), manual override,
   line numbers, copy/raw/download; lazy-load highlighter languages.
3. Multi-file composer UX: drop zone, list, per-file status, remove/clear,
   totals; retry-safe staged uploads preserving preparedRef semantics per file.
4. Rich previews: image/text/code-file inline; audio/video via blob element;
   HTML/SVG/unknown stay download-only; Download All as locally-built ZIP.
5. Custom reveal + Never expiry + presets (Quick Share, One-Time Secret,
   Controlled Share, Timed Handoff) mapping onto one policy model; policy
   summary line updated.
6. Landing/product explanation reordering per plan_v2 §3.9.
7. Discussions: schema+RPCs → composer toggle → recipient thread UI →
   rate limiting → lifecycle inheritance tests.

## 4. Evidence gate

- XSS vectors against Markdown/comments fail closed; discussion wrong-capability
  fetch/post rejected uniformly; nested reply renders; burn-policy shares may
  disable discussion (assert).
- Multi-file: upload-failure retry does not duplicate objects; orphan cleanup
  covers every new path; boundary count/size rejections.
- Custom-limit concurrency: exactly N-of-M authorized for custom N.
- Never expiry: status after simulated far-future clock; revoke works; cleanup
  skips.
- Full gates + HANDOFF update with exact results.

## 5. Stop conditions

Stop for review if work would break Day 4 factors, weaken uniform
`unavailable`, store any discussion key material server-side, allow public-ID-
only thread scraping, or pull Day 6 features forward.

## Outcome

Day 5 shipped in full:

- **Custom reveal counts:** integer range 1–100 enforced by a new constraint
  (`max_reveals between 1 and 100`), bounded numeric UI, and a concurrency test
  proving exactly N of M authorized at a custom limit.
- **Never expiry:** `expires_at` is now nullable; `NULL` shares never expire but
  stay revocable; cleanup skips them; receipt and status print "Never".
- **Policy presets:** Quick Share, One-Time Secret, Controlled Share, Timed
  Handoff, plus Custom — all mapping onto one policy model with a summary line.
- **Markdown Edit/Split/Preview** authoring (toggle on mobile), sanitizer
  unchanged; **code mode** with local language detection (never sent as server
  metadata), line numbers, and download.
- **Multi-file attachments:** up to 5 via the new `share_attachments` child table
  (slot 0–4), slot-staged reservations with per-slot uniqueness, reveal
  `files[]` array, drag-and-drop zone, and Download-all as a locally built ZIP
  (`fflate`). The single-file columns were migrated into slot 0 and dropped;
  a stale Day-2 reservation-pair constraint that blocked second slots was
  dropped during the audit pass.
- **Encrypted discussions:** append-only `share_comments` table, capability
  digest model (raw capability sealed in the SBCT `0x02` content trailer,
  digest stored server-side), separate HKDF label
  `securebin/v2/{mask}/discussion`, lifecycle inheritance gated inside the
  atomic RPCs, and rate limiting: route buckets of 120 GET / 30 POST per fixed
  window plus a database-side 60-per-minute limit keyed by
  `discussion/{share_id}`. The GET capability moved from query string to the
  `x-discussion-capability` header during the audit pass.

Deviations from this plan as written:

- Burn-policy shares needed no special "disable discussion" handling:
  discussions are opt-in via a nullable capability, so burn-style shares simply
  do not enable threads — no assert was required.
- The composer and viewer were refactored during implementation into module
  shells plus focused components (`app/components/composer/*`,
  `app/s/[publicId]/viewer-parts/*`, shared styles under `app/styles/`);
  behavior contracts were unchanged.

Evidence gate: `pnpm supabase:reset` + `pnpm supabase:test` → 7 files, 115
tests PASS; unit suite 21 files / 151 tests; integration 14; E2E 10; Axe 2 —
all green. Migrations through `20260829000000_encrypted_discussions.sql`.

# Day 5 implementation plan: content breadth, multi-file, custom policies, discussions

Status: **gated — do not start until the Day 4 exit gate in `DAY-4-PLAN.md` is green**

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

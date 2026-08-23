# Day 6 implementation plan: reveal window, privacy veil, self-host, parcels, local manager

Status: **gated future work — plan_v3 Phases B–E must finish before Day 6**

Audience: low-context implementation agents. Scope authority: `info/plan_v3.md`
Phase F; this document locks execution detail.

## Outcome and non-goals

Finish advanced lifecycle/privacy: post-first-reveal window, privacy veil,
one-command self-hosting, portable encrypted `.securebin` parcels with offline
decryption, a local-only sender manager, expanded Privacy Receipt, and — only
if provably stable — ciphertext-size padding.

**UI redesign if required:** if the Day 4 stabilization pass and real usage up
to this point show the interface itself (layout system, visual hierarchy, or
interaction model) is not good enough — not just individual defects — a scoped
end-to-end UI redesign is explicitly in-scope for Day 6, within the quiet-proof
direction of `docs/SPEC.md` and with all existing accessibility/e2e gates as
the safety net. Redesign means replacing the shell/navigation/surface system;
it does not mean changing copy contracts, protocol, or scope.

Do not add accounts, realtime/presence, moderation, Kubernetes/Terraform, or
any stretch feature before every required Day 4–6 item is green in production
or local mode.

## 1. Entry gate

Day 5 exit gate green; discussions functionally complete (finish them FIRST if
not); full gates green at the starting commit.

## 2. Locked contracts

- **Reveal window:** presets `none | 10s | 30s | 1m | 5m | custom(≤24h)`.
  Server records first-release time and window end atomically inside the
  existing reveal RPC (new nullable columns via forward migration); releases
  after `window_end` return the uniform unavailable path with retry-lease
  semantics preserved for the original token until its lease expires.
  Honest copy only: new ciphertext releases stop; already-saved copies cannot
  be erased.
- **Privacy veil:** local hide/Esc/auto-hide-on-blur; re-show never calls the
  server; never described as screenshot prevention.
- **Parcels:** versioned container `{magic, version, envelope(s), ciphertexts,
  attachment frames}` encrypted exactly like a share; no link secret, password,
  unlock code, or raw revocation capability ever exported. Import validates
  magic+version+schema strictly (reuse contracts validators), prompts factors,
  decrypts fully offline. Tamper/unsupported-version fail closed.
- **Self-host:** `pnpm local:setup | pnpm local | pnpm local:stop` wrapping the
  existing Supabase CLI stack + Next server; migrations applied locally;
  `.env.example` complete; no production credentials anywhere. Docker compose
  only if trivially stable.
- **Local manager:** extends the browser-local history desk (labels, policy
  view, revoke). No plaintext content stored; capabilities stay device-local.
- **Padding (conditional):** bucket sizes 64 KiB/256 KiB/1 MiB/4 MiB with
  authenticated, unambiguous length framing; defer entirely if it would rush a
  protocol change.

## 3. Build slices

1. Discussions completion sweep (if any Day 5 residue).
2. Reveal window: migration → RPC branch → composer control → recipient timer
   UI → tests (window start, inside/outside, retry-token, × max-reveals,
   × expiry, × revoke).
3. Privacy veil + visibility auto-hide.
4. Self-host scripts + fresh-clone doc pass; create the self-host runbook as
   part of this slice before linking it from this document.
5. `.securebin` export/import + offline decrypt demo path.
6. Local sender manager upgrades.
7. Expanded receipt fields (content type, file count, discussion state,
   expiry/Never, reveal count/window, factors, padding state, algorithms,
   fingerprint, what stayed local vs observable) + download/print.
8. Padding slice last; skip by explicit HANDOFF decision if unstable.

## 4. Evidence gate

- Window: pgTAP for window-end enforcement; browser test for timer UI;
  concurrency unchanged (retry token inside window never double-spends).
- Parcel: round-trip text/Markdown/code/files; offline (network intercepted)
  decrypt; wrong factor; tampered byte; future version rejected.
- Self-host: documented commands verified from a clean clone on this machine.
- Veil: keyboard + screen-reader labels; no server call on re-show (assert).
- Full gates + HANDOFF exact results.

## 5. Stretch features (only after required green)

Secure Drop request links (standard reviewed asymmetric crypto only),
recipient acknowledgment button, built-in short links without external
services, local password-strength meter, safe inline PDF, QR parcel transfer,
extra padding controls. Each needs its own mini evidence gate.

## 6. Stop conditions

Stop for review if work would break uniform `unavailable`, leak window/factor
metadata to logs, make offline decryption depend on network, store parcel
secrets server-side, or claim erasure/screenshot-prevention powers the code
does not have.

---

## 7. Discussion v1.1 — comment editing & deletion with proof of authorship

Owner decision 2026-08-23: supersedes the plan_v2 "append-only, no edit/delete"
stance for T1.1. Anonymous comments have no identity, so authorship is proven
the same way every other capability in SecureBin is: a per-comment random
token whose SHA-256 digest is the only thing the server stores.

### Model

- On POST, the client mints a random 32-byte `editToken`, sends the raw value
  once, and persists `{commentId -> editToken}` in localStorage
  (`securebin_comment_tokens_v1`). The server stores `edit_token_hash` only.
- **Edit** = PATCH with `{capability, editToken, bodyEnvelope}` → server
  verifies share active + capability digest + token digest, overwrites
  `body_envelope`, sets `edited_at = now()`. One revision only (no history).
- **Delete** = DELETE with `{capability, editToken}` → hard row delete.
  Replies whose parent disappears render as "[comment removed]" placeholders
  client-side (children are kept — deleting a whole subtree by accident is
  worse than an orphan label).
- Both operations inherit the discussion lifecycle gate (revoked / expired /
  exhausted / scheduled ⇒ 404-uniform) and the existing rate limits.

### Build slices

1. Migration: `edit_token_hash bytea`, `edited_at timestamptz` on
   share_comments; RLS/grants unchanged (RPCs stay service-definer).
2. RPCs `edit_share_comment` / `delete_share_comment` mirroring
   add_share_comment's verification order; pgTAP: wrong token, wrong
   capability, expired share, edited_at set exactly once, orphan handling.
3. API: `PATCH/DELETE /api/shares/:publicId/comments/:commentId`
   (capability + editToken in body; uniform errors).
4. UI: token map hook `useCommentTokens`; Edit inline textarea + Save/Cancel;
   Delete confirm; "(edited)" suffix from `edited_at`; buttons render only
   for locally-owned comments.

### Acceptance

Wrong/missing token ⇒ 400 indistinguishable from unknown comment; lifecycle
rejection ⇒ uniform unavailable; token never appears in logs or server rows
beyond its digest; local token loss simply means that comment becomes
read-only for this device.

## 8. My-shares live status sync

Problem: statuses on the history desk are stale until each item's manual
"Check status" button is pressed.

Chosen design — one batch call per desk-open, plus event-driven refreshes:

- New RPC `get_share_status_batch(p_public_ids text[])` returning
  `(public_id, status, available_at, expires_at, max_reveals,
  remaining_reveals)` rows, capped at 50 ids per call (hard cap in SQL).
  Security identical to get_share_status (service-definer, uniform
  `unavailable` row for missing/expired/exhausted/revoked).
- Thin API: `POST /api/shares/status-batch {publicIds: string[]}` (strict
  schema, ≤50 valid ids, discriminator rate-limit action `status`).
- Client: on history tab open (and on window focus / visibilitychange while
  it is open), fire ONE batch request for all stored public ids; merge
  results into localStorage via updateShareInHistory; per-item spinners
  replaced by a single desk-level "Refreshing…" strip. Reveal/revoke/create
  actions keep their immediate local updates as today.
- Efficiency notes: 1 request regardless of share count (vs N), reuses the
  atomic per-share logic server-side, no polling loop, nothing runs while
  the tab is hidden.

## 9. Rubric-driven improvement backlog (planned candidates, not scheduled)

Ordered by expected rubric payoff (clonefest weights: reliability/demo 20,
problem-core 20, innovation 20, tech 15, UX/a11y 15, docs 10):

1. **Prod-build e2e** — run Playwright against `next start` instead of dev
   (closes the last green-but-broken class of bug; Reliability).
2. **Secure Drop (stretch #1)** — request-a-secret links with contributor
   encryption to a requester public key; strongest remaining Innovation item;
   standard WebCrypto only (ECDH P-256 + HKDF), no home-grown crypto.
3. **Recipient acknowledgment** (stretch #2) — explicit button after reveal;
   sender manager shows release-time vs acknowledgment-time; never called a
   read receipt. Small build, demos well next to discussions.
4. **Self-host scripts early** — `pnpm local:setup/local/stop` wrappers exist
   conceptually in Day 6 scope; pulling them forward makes the judge "runs
   anywhere" story testable before freeze.
5. **Axe coverage expansion** — factor gate, opened view, discussion thread,
   mobile viewport scans (currently only landing + ready viewer).
6. **Perf pass** — bundle analysis, LCP measurement, Worker decision for
   large-file encryption based on real numbers (SPEC Day 5 requirement).
7. **Docs/evidence** — architecture diagram refresh for attachments +
   discussions nodes, recorded concurrency evidence file under docs/evidence/,
   demo script rehearsal checklist.

Explicitly not planned: moderation/bans, comment history/versions, WebSocket
live threads, anonymous identity persistence.

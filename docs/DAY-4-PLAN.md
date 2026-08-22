# Day 4 implementation plan: meaningful differentiation, UX completeness, and hardening

Status: **approved for implementation — all Day 1–3 gates green**

Audience: low-context implementation agents; locked formats must not be improvised

This plan implements SPEC Day 4. It requires the Day 1–3 evidence recorded in
[`../info/HANDOFF.md`](../info/HANDOFF.md) and the production fixes shipped
2026-08-22 (CSP storage origin, base64url canonical newline fix) to be deployed.

## Outcome and non-goals

Add optional password and two-channel unlock protection, QR and share actions,
and a Privacy Receipt; complete every non-happy-path state; keep the
zero-knowledge boundary intact.

Do not add recipient accounts, Secure Rooms, discussions, multi-file
attachments, custom reveal counts, "Never" expiry, code auto-detection, or any
`info/plan_v2.md` scope — those stay gated behind SPEC Day 5.

## 1. Entry gate

`pnpm validate`, `pnpm test:integration`, `pnpm supabase:test`, `pnpm test:e2e`,
`pnpm test:a11y`, and the reproducibility script are green at the starting
commit. Owner has applied migrations `20260824000000` and `20260825000000` to
the remote database and set the `CI_LOCAL_SUPABASE_SERVICE_KEY` repository
secret. Inspect `git status`; never edit `info/plan.md` or `info/plan_v2.md`.

## 2. Locked crypto context (extends Day 3)

The Day 3 context gains two optional factors. Factor masks and HKDF labels are
exactly:

```text
link                     securebin/v1|v2/{mask}/content, /file
link+password            securebin/v1|v2/link+password/content, /file
link+unlock              securebin/v1|v2/link+unlock/content, /file
link+password+unlock     securebin/v1|v2/link+password+unlock/content, /file
```

- **Password factor:** UTF-8 bytes, no Unicode normalization, 1–1024 bytes.
  KDF is `PBKDF2-HMAC-SHA-256` with a fresh random 16-byte `passwordSalt` and
  exactly `{"iterations":600000}` in `kdfParameters`. The password key is an
  *independent* HKDF key derived from `linkSecret ‖ passwordKey` material per
  the architecture labels — never the raw password alone.
- **Unlock factor:** 16 random bytes rendered as Crockford Base32 plus one
  check character (17 characters total). The unlock code travels **out of
  band** (separate channel); the URL fragment never contains it.
- **Domain separation:** every factor combination changes the HKDF `info`
  label; the factor mask is bound into the canonical AAD. Tests must prove a
  share sealed with `link+password` cannot be opened with the link alone and
  vice versa, and that `link+password+unlock` requires both.
- **Server contract:** `passwordRequired`/`unlockRequired` flags already
  exist end-to-end (contracts, RPC, viewer payload). No schema change is
  required for Day 4 crypto; only the browser gains the ability to produce
  non-`link` masks, and the viewer gains factor prompts.

## 3. Locked formats and limits

- Envelope versions, SBCT framing, file framing, and every size bound are
  frozen from Day 3 (`docs/architecture.md` §5). Day 4 adds **no** envelope
  version and **no** field.
- `kdf` is `none` + `{}` + `passwordSalt: null` (link-only) or
  `PBKDF2-HMAC-SHA-256` + `{"iterations":600000}` + 16-byte salt. Reject any
  other combination before Web Crypto work, on both client and server.
- Unlock code check character uses the Crockford alphabet `0123456789ABCDEFGH
  JKLMNPQRSTVWXYZ` excluding `I L O U`; reject wrong check symbols client-side
  before any network call.

## 4. Build slices (each independently green)

1. **Password factor (browser):** composer optional password field (confirm
   field, strength hint copy only — no meters), PBKDF2 derivation, factor-mask
   envelope production, golden vectors for all four masks.
2. **Two-channel unlock (browser):** code generation + check character,
   separate-channel delivery copy ("Send this code over a different
   channel"), viewer unlock prompt with bounded attempts client-side.
3. **Viewer factor prompts:** password and/or unlock inputs before reveal,
   wrong-factor failure states that never consume a reveal lease (factors are
   applied before `requestToken` is minted), uniform `unavailable` untouched.
4. **QR + share actions:** browser-only QR generation (bundled, no remote
   fonts/images; QR encodes the full fragment URL), copy-link, native share
   where available, mail/raw-text fallbacks — with accessible names and no
   secret leakage into logs or analytics.
5. **Privacy Receipt:** local receipt view/download describing browser
   encryption, protected material, lifecycle policy, algorithm/iteration
   details, ciphertext fingerprint (SHA-256 of ciphertext), and the metadata
   visible to infrastructure. No secrets, no fragment, no capabilities.
6. **State completeness sweep:** loading, offline, malformed-link,
   wrong-factor, wrong-key, scheduled, retry, refresh, double-submit,
   unavailable, and network-failure states across composer and viewer; only an
   unsent in-memory draft survives recoverable failures.
7. **Hardening review:** CSP/HSTS/`no-store`/`nosniff`/frame denial/referrer
   and permissions policies re-verified on the deployed origin; bundle
   boundary check that crypto and factor code stay out of non-secret routes;
   manual keyboard + screen-reader pass alongside axe.

## 5. Evidence gate

- Crypto vectors: all four factor masks seal/open round-trip; wrong password,
  wrong unlock, wrong link each fail closed without network calls; iteration
  count and salt length asserted in golden vectors.
- pgTAP: factor-flag ↔ mask consistency already enforced by `create_share`
  (prove with 22023 cases); no new grants or RLS changes.
- Browser tests: password-protected share create → reveal with correct
  factor; wrong-factor dead end; unlock-code two-device flow simulated by
  injecting the code separately; QR renders and encodes the exact URL.
- A11y: factor prompts, QR, and receipt pass axe and keyboard flows.
- `pnpm validate` + integration + pgTAP + e2e + a11y + reproducibility green;
  HANDOFF updated with exact results and any deferred item.

## 6. Stop conditions

Stop for review if work would change envelope versions/fields, move counters
outside RPCs, distinguish `unavailable` causes, weaken the uniform failure,
log or persist any factor value, send factors to the server before lease
minting, add remote assets to secret routes, or pull plan_v2 scope forward.

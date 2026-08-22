# Day 6 implementation plan: reveal window, privacy veil, self-host, parcels, local manager

Status: **gated — do not start until the Day 5 exit gate is green**

Audience: low-context implementation agents. Scope source: `info/plan_v2.md`
§4 and §5 (stretch). This document locks execution detail.

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
4. Self-host scripts + fresh-clone doc pass (`docs/self-hosting.md`).
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

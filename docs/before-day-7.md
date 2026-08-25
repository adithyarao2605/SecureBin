# Before Day 7: pre-freeze remediation plan

Status: **historical pre-freeze remediation complete locally; owner-operated
hosted evidence remains**. This checklist is retained as an audit record. The
the current release scope is limited to verification and release-blocking
regressions; do not reopen completed remediation work without evidence.

## Outcome

The implementation includes lifecycle, cleanup, compatibility, upload
recovery, parcel, self-host, composer, accessibility, and quiet-proof UI
remediation. The current local JavaScript gate is green; environment-backed
database, Chromium, mobile, keyboard, reduced-motion, screenshot, and Axe
evidence must be rerun for the final SHA. Remote migration, production
promotion, and hosted cleanup verification remain owner-operated.

The implementation and UI work are complete locally. Optional roadmap items
remain deferred: Secure Drop, recipient acknowledgment, ciphertext-size
padding, accounts/rooms, and the other explicit `info/plan_v3.md` non-goals.

## 1. Restore security and lifecycle correctness

Create forward Supabase migrations with the pinned repository CLI. Never edit
an already-deployed migration.

- Reorder `reveal_share` so revocation and expiry override active retry leases
  immediately. A live lease may bypass only reveal exhaustion and release-
  window closure for the same authorized release.
- Make single and batch status RPCs classify a closed release window as the
  uniform unavailable state.
- Accept unlock-only `link+unlock` envelopes with `kdf=none` in `create_share`.
- Restore complete create idempotency comparison across the content envelope,
  lifecycle policy, factor flags, deletion digest, discussion digest, release
  window, and attached reservation/slot projection. Any mismatch returns the
  existing `409 idempotency_conflict` without exposing the original record.
- Make cleanup understand attachment candidates, group them by share, and
  finalize a share only after every attachment deletion succeeded or was
  already missing. Partial failure must remain retryable.
- Apply lifecycle behavior consistently to discussions: closed-window,
  revoked, expired, exhausted, and scheduled shares take the same unavailable
  path.
- Remove E2E diagnostics that print discussion capabilities, edit tokens,
  envelopes, and response bodies. Add a source audit that prevents capability
  or request-body logging from returning.
- Reject a malformed optional discussion-capability digest instead of silently
  treating it as disabled.
- Make proxy trust explicit. Vercel may use its overwritten forwarding header;
  direct self-hosting uses a safe shared discriminator unless a configured,
  trusted reverse proxy overwrites forwarding headers.

Required regression tests: same-token retry after revoke/expiry/window close;
new-token terminal behavior; closed-window parity across status, batch,
manager, reveal, and discussions; unlock-only create/reveal with and without
attachments; every immutable idempotency mismatch; multi-attachment cleanup
with partial Storage failure and retry.

## 2. Freeze the deployed cryptographic contracts

Keep envelope v2. Do not introduce v3 during pre-freeze remediation.

- Freeze protected content/file derivation to the deployed
  `securebin/v2/link/content` and `securebin/v2/link/file` labels. Factor
  material remains in the IKM and the factor mask remains authenticated in
  AAD.
- Add golden vectors for all four factor masks and both content/file object
  types so the deployed behavior cannot drift.
- Keep the current 27-character, 124-random-bit unlock format. Reject body
  digits outside its canonical base-28 alphabet, retain the full checksum
  alphabet, and correct every 128-bit/modulo claim.
- Require exactly 16 bytes for file-envelope password salts.
- Strictly validate discussion envelopes before Web Crypto: exact fields,
  version, algorithm, canonical base64url, 12-byte nonce, and bounded
  ciphertext.
- Preserve existing share and parcel compatibility.

## 3. Complete Day 6 behavior and evidence

### Release window and privacy veil

- Show a recipient countdown plus the localized absolute close time.
- At zero, hide the decrypted surface, revoke object URLs, and release
  decrypted content/file references where practical.
- State honestly that new releases stopped and this browser hid its copy, but
  previously saved copies cannot be erased.
- Resynchronize after visibility changes, clamp clock skew at zero, and keep
  manual veil re-show local with correct focus restoration.

### Portable parcels

- Tighten SBPX v1 without changing its version: exact policy keys; canonical
  public ID; ISO UTC timestamps; integer/range checks; unique slots `0–4`;
  maximum five attachments; exact envelope/ciphertext bounds; factor
  consistency; and rejection of trailing or unknown data.
- Reject oversized parcel files using `File.size` before `arrayBuffer()`.
- Cover note, Markdown, code, multiple files, password, unlock-only, combined
  factors, tampering, unsupported versions, duplicate slots, and restore after
  the application is fully loaded and network access is blocked.

### Upload recovery

Extend upload-reservation responses to:

```ts
{
  uploadUrl: string | null;
  alreadyUploaded: boolean;
  expiresAt: string;
}
```

- On retry, inspect the existing random path. An exact expected size returns
  `alreadyUploaded=true` and the browser skips PUT.
- A mismatched object atomically rotates the unattached reservation path and
  queues the old path for cleanup.
- Test a successful Storage PUT whose response is lost, partial multi-file
  completion, mismatched-size recovery, and the subsequent create retry.

### Self-hosting and cleanup scheduling

- Use `pnpm exec supabase` and `.venv/bin/python`; remove mutable global/latest
  CLI reliance.
- Generate a dedicated ignored local runtime environment with restrictive
  permissions. Never retain or overwrite production `.env.local` values.
- Require loopback Supabase URLs for local mode.
- Serve a production build with `next start`, not `next dev`.
- Track a validated SecureBin-owned PID instead of killing arbitrary port
  owners.
- Pin manifest dependency ranges to current lockfile versions and enforce the
  exact Node version in `.nvmrc`.
- Make cleanup scheduling reproducible in repository configuration or record
  it as a blocking owner deployment action with evidence.

## 4. Fix composer, feedback, and accessibility defects

### Markdown

- Default desktop to Split. Default mobile to Edit and expose Edit/Preview
  without a stacked Split layout.
- Remove duplicate preview CSS and the nested inner Markdown card.
- Restore explicit unordered/ordered markers and list spacing in composer and
  viewer scopes.
- Give authoring previews and decrypted Markdown truthful, distinct accessible
  labels.

### Code authoring

- Add a scroll-synchronized highlighted layer behind the accessible textarea:
  identical metrics, transparent text, visible caret/selection, `aria-hidden`
  highlight layer, two-axis synchronization, IME-safe input, and `wrap="off"`.
- Run conservative/debounced detection only in Code mode. A manual selection,
  including plaintext, suppresses detection until the draft becomes empty.
- Preserve language IDs `0–8`; append IDs `9–20` for Java, C, C++, C#, Go,
  Rust, Ruby, PHP, Kotlin, YAML, XML, and INI.
- Update lowlight registration, download extensions, payload round trips,
  architecture, and golden vectors. Document that an older client rejects a
  newly added language ID.
- Replace the native selector with an accessible searchable combobox covering
  filtering, active option, arrows, Home/End, Enter, Escape, click-outside,
  no-results, disabled state, and visible focus.

### Immediate UX and accessibility

- Implement roving focus and keyboard behavior for application, content-mode,
  and Markdown tab widgets.
- Confirm local-history remove/clear and revoke actions; distinguish local
  removal from server revocation and announce failures.
- Provide visible clipboard failure and manual-copy fallbacks.
- Add Privacy Receipt print support and readable release-window durations.
- Fail Axe `serious` findings unless an explicit reviewed allowlist exists.
- Remove the green unit test's jsdom navigation warning.

## 5. Documentation and UI-overhaul gate

- Reconcile README, SPEC, architecture, diagrams, threat model, policy state,
  deployment, self-hosting, evidence, roadmap, and HANDOFF with verified
  behavior. Remove premature “complete” claims until the new regressions pass.
- Expand the demo checklist for release windows, veil, parcels, receipt
  download/print, self-hosting, unlock-only shares, cleanup, and failures.
- Record delegated audits and final validation in `info/HANDOFF.md`. Never
  modify `info/plan.md`.
- The historical **full UI overhaul in [`UI-REDESIGN.md`](UI-REDESIGN.md)** is
  complete. Its current contract is dark-first quiet proof: one primary surface plus a
  narrow evidence rail, compact mobile status strip, restrained proofline,
  honest copy, responsive keyboard use, and no regression to security or
  accessibility. This document records the mandatory TODO; its design and
  implementation receive their own plan.

## 6. Exit gate

Implementation status on `dev` (2026-08-24): clean reset and forward replay,
155 pgTAP assertions, 16 integration tests, 191 unit tests, production build,
reproducibility, dependency audit, and source/log audit pass. The browser
matrix, production-build browser run, final Axe review, screenshot review, and
owner-hosted migration/deployment checks are intentionally still marked open
until their exact outputs are recorded. This is not a release-freeze start.

1. Clean local Supabase reset and forward-migration replay.
2. pgTAP, integration, crypto vectors, lint, typecheck, unit tests, and build.
3. Development-server and production-build Playwright suites.
4. Mobile, keyboard, and Axe checks with serious findings reviewed.
5. Fresh-clone `pnpm install --frozen-lockfile` and reproducibility check.
6. Production dependency audit plus secret/log/source scan.
7. Confirm unrelated user changes remain untouched.

Use small Conventional Commits with no Day-number references. Day 7 must not
start until this exit gate and the separate UI-overhaul gate are green.

## 7. Commit-message cleanup after owner merge

Do not rewrite history during remediation on `dev`. After the owner performs
the normal merge:

1. Freeze collaborator pushes and create recoverable backup refs.
2. Curate replacements for every reachable subject/body containing a
   case-insensitive Day-number reference.
3. Perform one message-only rewrite across the release branches.
4. Prove commit count and final tree objects are identical before and after.
5. Update stale SHA references in HANDOFF/evidence.
6. Force-push only with `--force-with-lease` and notify collaborators.
7. Verify no commit message matches `\bday[ _-]*[0-9]+\b`.

Historical document names, migration filenames, and planning references are
unchanged; this cleanup applies only to Git commit messages.

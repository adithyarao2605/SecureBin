# SecureBin feature test checklist

Use this checklist to test the released product with synthetic content only.
Never paste a real password, private key, recovery code, production share URL,
or confidential file into a test. Run destructive checks against disposable
shares and remove their local history entries afterward.

## Test record

- [ ] Record the tested commit SHA.
- [ ] Record the application URL and test timestamp with timezone.
- [ ] Record browser, operating system, viewport, color theme, and reduced-motion setting.
- [ ] Confirm the health endpoint returns success before testing: `GET /api/health`.
- [ ] Use a private browser profile for recipient checks when practical.

## Landing page and navigation

- [ ] The landing page loads without console errors or third-party media/font requests.
- [ ] **Create secure share** opens `/new` on the composer tab.
- [ ] **How it works** opens the in-product documentation.
- [ ] **Open parcel** opens the offline parcel utility.
- [ ] **My shares** opens local Share History.
- [ ] The proofline describes browser → sealed parcel → recipient without claiming a cryptographic result.
- [ ] Light and dark themes apply immediately and remain readable after reload.
- [ ] Keyboard focus is visible on every header control.
- [ ] Navigation remains usable at 320 px and 390 px without horizontal overflow.

## Composer modes

- [ ] **Plain note** presents one plain-text editor and preserves line breaks.
- [ ] **Markdown** starts in Edit mode on mobile.
- [ ] Markdown Edit, Split, and Preview tabs work on desktop.
- [ ] Markdown tabs support Left/Right, Home, and End keyboard navigation.
- [ ] Markdown preview renders headings, lists, links, tables, and fenced code.
- [ ] Raw HTML, scripts, event handlers, iframes, and remote Markdown media do not execute or load.
- [ ] **Code** presents one editable syntax-highlighted IDE surface.
- [ ] First-paste language detection selects a conservative supported language.
- [ ] Later edits do not unexpectedly replace the chosen language.
- [ ] The searchable language picker works with keyboard and pointer input.
- [ ] Byte count updates and an oversized UTF-8 draft is rejected before any network request.
- [ ] **Load safe example** inserts only synthetic demonstration content.

## Protection factors

- [ ] Link-only share creates and reveals successfully.
- [ ] Link + password share rejects mismatched password confirmation before creation.
- [ ] Link + password requires the correct password before local decryption succeeds.
- [ ] Link + unlock share shows one canonical 27-character unlock code once.
- [ ] Link + unlock requires the code in the recipient factor gate.
- [ ] Link + password + unlock requires both factors.
- [ ] The unlock code is not stored in Share History or returned by the server.
- [ ] Passwords and unlock codes never appear in request URLs, bodies, or logs.
- [ ] The share link keeps its complete URL fragment when copied.

## Lifecycle policy

- [ ] Default policy is one release with the documented default expiry.
- [ ] Scheduled availability shows a countdown and blocks early reveal.
- [ ] Past or invalid availability values are rejected.
- [ ] Expiry presets work for 24 hours, 7 days, and 30 days.
- [ ] Custom expiry accepts valid duration/unit combinations and rejects invalid bounds.
- [ ] **Never** expiry remains available until reveal exhaustion or revocation.
- [ ] Reveal presets work for 1, 3, 5, and 10 releases.
- [ ] Custom reveal limits accept 1–100 and reject values outside that range.
- [ ] Unlimited releases remain available until expiry or revocation.
- [ ] The release-window information button explains the policy without crowding the form.
- [ ] Release-window presets and a valid custom window are accepted.
- [ ] The first authorized release starts the server-enforced release window.
- [ ] New request tokens become uniformly unavailable when that window closes.
- [ ] The original request token can retry its existing five-minute lease without another count.
- [ ] Revocation and expiry override an active retry lease immediately.

## Attachments

- [ ] Attach button and drag-and-drop both add files.
- [ ] Up to five files can be attached and individually removed before creation.
- [ ] A sixth file is rejected with a clear message.
- [ ] A file over 10 MB is rejected before upload.
- [ ] Plaintext filenames and MIME types do not appear in API request bodies.
- [ ] Each encrypted file uses a distinct envelope and Storage object path.
- [ ] Image and safe text previews render only after local decryption.
- [ ] SVG, HTML, PDF, executables, and unsupported types remain download-only.
- [ ] Individual downloads restore the original local filename and bytes.
- [ ] **Download all (ZIP)** produces a decrypted ZIP containing every attachment.
- [ ] Object URLs are revoked when previews close or the viewer hides decrypted content.
- [ ] A lost upload response can recover the completed reservation without uploading ciphertext twice.

## Share-ready sender view

- [ ] Visible sections are numbered consecutively with no skipped number.
- [ ] Without an unlock code: Delivery, Evidence, Offline copy, and Transport are 01–04.
- [ ] With an unlock code: Second channel appears as 02 and sections run 01–05.
- [ ] Copy link works, and clipboard denial shows a selectable manual-copy fallback.
- [ ] Open recipient view uses the complete fragment URL.
- [ ] The Privacy Receipt shows content type, factor mask, lifecycle policy, file count, and ciphertext fingerprint.
- [ ] Receipt download and print layouts work without exposing plaintext or capabilities.
- [ ] QR generation happens locally and encodes the complete share URL.
- [ ] Revoke requires confirmation and explains that saved copies cannot be erased.
- [ ] Create another resets transient share material and returns to a clean composer.

## Recipient viewer

- [ ] Missing, expired, exhausted, revoked, and closed-window shares all show **Unavailable**.
- [ ] A limited reveal requires explicit confirmation before authorization is consumed.
- [ ] Successful reveal decrypts and renders only in the browser.
- [ ] Wrong or missing local factors fail closed without exposing content.
- [ ] Network abort, timeout, 503, malformed JSON, and local decryption uncertainty reuse the same reveal token.
- [ ] Successful decryption clears the retry token.
- [ ] Release-window countdown displays the server closing time.
- [ ] When the countdown closes, decrypted content and references are hidden locally.
- [ ] Privacy Veil can hide and reveal content locally before automatic closure.
- [ ] Reduced motion removes non-essential transitions without hiding state changes.
- [ ] Secret routes make no third-party script, analytics, font, embed, or remote-media request.

## Encrypted discussions

- [ ] A share created without discussions exposes no discussion composer.
- [ ] A discussion-enabled share displays its encrypted thread after reveal.
- [ ] Posting a comment sends only encrypted body/nickname envelopes and the capability header.
- [ ] Replying preserves parent/child thread structure.
- [ ] Author edit proof permits editing the matching comment only.
- [ ] Author delete proof removes content while preserving descendants.
- [ ] Invalid capability, parent ID, envelope, nickname, or proof is rejected uniformly.
- [ ] Revoked, expired, exhausted, scheduled, and closed-window shares cannot read or post discussions.
- [ ] Diagnostic output never includes discussion capabilities or ciphertext bodies.

## Share History

- [ ] Newly created shares appear in device-local history.
- [ ] History stores public metadata and management capability locally, not plaintext or factors.
- [ ] Search and Active, Scheduled, Revoked, and Expired filters work.
- [ ] A device-local label can be added and updated.
- [ ] Open uses the stored full fragment URL.
- [ ] Refresh updates status and remaining releases.
- [ ] Revoke requires confirmation and updates the row after server success.
- [ ] Remove local copy does not claim to revoke the server share.
- [ ] Clear history requires confirmation and removes only local records.
- [ ] Clipboard failure and revoke failure are announced accessibly.

## Offline `.securebin` parcels

- [ ] A newly created share exports an SBPX v1 `.securebin` parcel.
- [ ] The parcel contains ciphertext and policy metadata but no link key, password, unlock code, revoke capability, or discussion capability.
- [ ] The parcel utility rejects oversized, malformed, tampered, and future-version parcels.
- [ ] Restore requires the original link fragment and any configured factors.
- [ ] After the utility has loaded, a valid parcel restores with network access blocked.
- [ ] Restored Markdown, code, and attachments use the same safe rendering boundaries as online reveals.

## Security and privacy boundaries

- [ ] URL fragments never appear in HTTP requests, server logs, referrers, or QR service calls.
- [ ] Plaintext, passwords, unlock codes, filenames, MIME types, deletion tokens, and upload capabilities never cross the browser/server boundary.
- [ ] Ciphertext bodies and signed Storage URLs are not written to diagnostics.
- [ ] Anonymous clients cannot read application tables or private Storage objects directly.
- [ ] Reveal counts remain exact under concurrent requests.
- [ ] Missing and unavailable resources return the same recipient-facing state.
- [ ] CSP, no-store, no-referrer, frame denial, MIME-sniffing protection, and Permissions Policy headers are present.
- [ ] The documentation states that runtime compromise and recipient-saved copies remain outside the protection boundary.

## Accessibility and responsive behavior

- [ ] Every page has semantic landmarks and one clear primary heading.
- [ ] All controls have accessible names and visible focus indicators.
- [ ] Tabs, dialogs, confirmations, picker options, details controls, and forms are keyboard-operable.
- [ ] Dialog focus moves inside on open and returns to the trigger on close.
- [ ] Errors and asynchronous status changes are announced without stealing focus.
- [ ] Light and dark themes meet readable contrast requirements.
- [ ] No serious or critical Axe finding appears in landing, composer, factor gate, viewer, discussion, history, parcel, success, loading, error, or empty states.
- [ ] At 320 px and 390 px, content stays within the viewport and the security-flow `+` remains on its summary row.

## Operations and reproducibility

- [ ] `pnpm install --frozen-lockfile` succeeds with Node from `.nvmrc` and pnpm from `packageManager`.
- [ ] `.venv/bin/python scripts/verify-reproducibility.py` passes.
- [ ] Lint, strict typecheck, unit tests, source audit, dependency audit, and production build pass.
- [ ] Clean Supabase start/reset replays every migration in order.
- [ ] pgTAP and integration suites pass against that clean database.
- [ ] Development E2E, production E2E, and accessibility suites pass in Chromium.
- [ ] Local production mode binds to loopback and `pnpm local:stop` stops only SecureBin-owned processes.
- [ ] Cleanup scheduling calls `POST /api/internal/cleanup` with the configured secret and drains expired/orphaned data.
- [ ] Production smoke verifies health, headers, create, reveal, attachment, revoke, and uniform unavailable behavior with synthetic content.

## Completion

- [ ] Remove disposable shares and synthetic files.
- [ ] Clear synthetic Share History entries.
- [ ] Record failures with the exact route, browser, commit, and non-secret reproduction steps.
- [ ] Confirm no screenshot, trace, report, or log contains a real fragment URL or capability.

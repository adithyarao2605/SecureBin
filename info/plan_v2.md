# SecureBin — Day 4 to Day 7 Implementation Plan

## EXECUTION GATE — DO NOT START YET

**Do not start implementing anything in this file until the user explicitly tells you to start.**

Day 3 still has issues being fixed separately. The existence of this file is **not** permission to begin Day 4.

Until the user says something like **“Start Day 4”**, the agent may only read the repo/docs, inspect current state, answer questions, and point out risks. Do not change code, migrations, dependencies, cryptography, UI, deployment, or production state.

When permission is given, first verify Day 3 is stable and the current build/test/deploy baseline is green.

---

# 1. Source of truth

Use these in order:

1. `docs/architecture.md` — crypto, APIs, database rules, trust boundaries, protocol behavior.
2. `AGENTS.md` — repository rules, commands, required validation.
3. This `plan.md` — day-by-day scope and delivery order.

If this plan conflicts with `docs/architecture.md` on security or protocol details, stop and ask instead of guessing.

## Non-negotiable rules

- Plaintext never goes to the server.
- URL-fragment secrets never go to the server.
- Passwords never go to the server.
- Two-channel unlock codes never go to the server.
- Plaintext filenames and MIME metadata stay encrypted.
- Raw deletion/revocation capabilities are not stored server-side.
- Never log plaintext, fragments, passwords, unlock codes, raw capabilities, filenames, ciphertext bodies, or full secret URLs.
- Every AES-GCM encrypted object gets a fresh nonce.
- A reveal means **server-authorized ciphertext release**, not proof a human read/decrypted it.
- Wrong client-only factors may consume a reveal because the server cannot verify them without breaking the privacy model.
- New features must not weaken atomic reveal enforcement, retry safety, storage privacy, CSP, or current tests.
- Secret rendering/highlighting/previews stay local.
- Add important tests with each feature; do not defer all testing to Day 7.
- Never claim screenshots, downloads, clipboard contents, or all RAM copies can be remotely erased.

---

# 2. Day 4 — Protection, viewer fixes, Privacy Receipt, share completion

## Goal

Finish the original protection layer and fix the visible UI/viewer problems before the large Day 5 expansion.

## Entry gate

Before Day 4 work:

- Day 3 issues are fixed.
- Production build passes.
- Unit/integration/E2E baseline passes.
- Migrations are synchronized.
- Existing create/reveal/file flow works in production.
- No unresolved incident blocks new work.

If this gate fails, stabilize first.

## 2.1 Fix the full-screen desktop layout

- Use the full available viewport, preferably `min-height: 100dvh`.
- Let the composer/editor grow vertically.
- Increase useful desktop width where needed.
- Keep text at a readable line length.
- Make evidence rail + main workspace feel like one application, not small floating cards.
- No horizontal overflow.
- Verify laptop, 1440p, large desktop, 320px and 390px mobile.

## 2.2 Fix the View Share page

Give `/s/[publicId]` a dedicated cleanup pass.

- Use the available screen properly.
- Give decrypted content enough room.
- Long text wraps correctly.
- Long code lines scroll instead of breaking layout.
- Long filenames do not break layout.
- Markdown/files/discussions fit cleanly.
- Password and two-channel unlock fit naturally.
- Limited-reveal confirmation is clear **before** a reveal is consumed.
- Make loading, scheduled, ready, revealing, opened, wrong-factor, network-error, incomplete-link and unavailable states visually consistent.
- Mobile recipient page must be intentionally designed.
- View Share should look as polished as Create Share.

## 2.3 Fix headers/top navigation and general UI loading

Fix the current problem where the header/UI does not always load/render correctly.

Verify:

- initial `/`;
- hard refresh `/`;
- direct `/s/[publicId]`;
- hard refresh share URL;
- client navigation;
- light/dark/system;
- desktop/mobile;
- slow network.

Fix:

- missing/flashing header;
- overlap/layout jump;
- missing CSS/fonts;
- hydration mismatch;
- wrong-theme flash where practical;
- blank/partial UI;
- lazy-loaded chunk fallback problems.

Provide stable fallbacks for Markdown, code highlighter, QR and previews. Core secret routes must not rely on third-party assets.

## 2.4 Password protection

- Optional password.
- PBKDF2-HMAC-SHA-256, 600,000 iterations for v1.
- Random password salt.
- Bound password input.
- Combine password-derived material with the random link secret.
- Keep the random link secret even when password protection is enabled.
- Password never uploaded.
- Wrong password fails closed.
- Work with text, Markdown, code, files and two-channel mode.

Tests: correct/wrong password, malformed parameters, oversized input, password + file, password + other factor.

## 2.5 Two-channel unlock

- Independent random 128-bit unlock secret.
- Readable Crockford Base32-style code with check symbol.
- Link alone cannot decrypt.
- Code alone cannot decrypt.
- Unlock code never uploaded.
- Factor mask/domain separation.
- Support link + code and link + password + code.
- Tell sender to use separate channels.
- Share-link QR may exist.
- Separate unlock-code QR may exist.
- **Never combine both factors into one QR.**

Tests: each factor alone fails, wrong code fails, combined factors succeed, tampered metadata fails.

## 2.6 Privacy Receipt

After creation show:

- browser-side encryption;
- encrypted files;
- encrypted filename/MIME metadata;
- link secret not uploaded;
- password not uploaded;
- unlock code not uploaded;
- availability;
- expiry;
- reveal limit;
- revocation;
- required factors;
- file count;
- algorithm/KDF;
- envelope version;
- ciphertext fingerprint.

Also clearly state infrastructure may still observe:

- ciphertext size or padded size bucket;
- timestamps;
- network information;
- request timing;
- access patterns;
- policy metadata required for server enforcement.

Do not claim “zero metadata”.

## 2.7 Pre-flight “What will SecureBin see?”

Before creation, add an expandable explanation.

Server receives:

- ciphertext;
- encrypted files;
- availability;
- expiry;
- reveal policy;
- ciphertext size/bucket.

Server does not receive:

- plaintext;
- URL-fragment secret;
- password;
- unlock code;
- plaintext filename;
- plaintext MIME type.

## 2.8 Share actions

Finish:

- copy full link;
- QR;
- native Web Share;
- email-client action;
- raw/download actions where relevant;
- accessible fallbacks.

Do not leak factors into logs/analytics.

## 2.9 Recipient states

Complete:

- loading;
- scheduled;
- ready;
- reveal confirmation;
- revealing;
- opened;
- password required;
- unlock required;
- wrong factor;
- malformed/missing fragment;
- offline/network error;
- retry;
- uniform unavailable.

Uniform unavailable must not reveal whether a share is missing, expired, exhausted or revoked.

## 2.10 Security hardening

Verify:

- restrictive CSP;
- HSTS;
- `Cache-Control: no-store`;
- `nosniff`;
- frame denial;
- referrer policy;
- permissions policy;
- strict schemas;
- rejection of unknown/plaintext-shaped API fields;
- private Storage;
- RLS/grants;
- no sensitive logging;
- no third-party script required on reveal routes.

## 2.11 Day 4 tests

Add/run:

- password;
- two-channel;
- combined factors;
- viewer states;
- hard refresh/direct share navigation;
- header/theme rendering;
- Privacy Receipt;
- share actions;
- security headers;
- secret-leakage checks;
- mobile;
- existing reveal concurrency;
- existing file flow.

## Day 4 exit gate

Do not start Day 5 until:

- View Share fixed;
- header/UI load issue fixed;
- no known blank-screen bug;
- password works;
- two-channel works;
- receipt works;
- share actions work;
- Day 3 functionality still works;
- production build/tests green.

---

# 3. Day 5 — Markdown, code, multi-file, custom policies, landing, discussions

## Goal

Turn SecureBin into a complete modern sharing product.

## 3.1 Markdown Edit / Split / Preview

Implement:

- Edit;
- Split;
- Preview;
- sanitized rendering;
- headings;
- lists;
- task lists;
- tables;
- blockquotes;
- links;
- fenced code;
- inline code.

Security:

- no arbitrary HTML execution;
- no unsafe embeds;
- no silent remote-resource leaks.

Mobile: Edit/Preview toggle instead of cramped split.

Lazy-load heavy dependencies.

Tests: normal Markdown, XSS, links, fenced code, mobile.

## 3.2 Code mode

Implement:

- syntax highlighting;
- automatic language detection;
- manual language override;
- `Auto` default;
- detected-language label;
- line numbers;
- preserve whitespace;
- horizontal scrolling;
- copy;
- raw;
- source download;
- reuse viewer for uploaded source-code files.

Privacy:

- detection is local;
- do not send language as plaintext server metadata.

Performance: lazy-load highlighter/languages.

Tests: common/unknown languages, override, long code, Unicode, copy/download, mobile overflow.

## 3.3 Multiple encrypted attachments

Replace/generalize the single-file flow.

Composer:

- multi-file;
- drag-and-drop region;
- click-to-browse;
- multi-select;
- keyboard access;
- file list;
- per-file size/status;
- remove;
- clear all;
- total size;
- bounded file count;
- bounded aggregate size.

Security/storage:

- encrypt each file locally;
- encrypt filename;
- encrypt MIME metadata;
- fresh nonce per object;
- random private Storage path;
- staged reservation;
- no overwrite;
- validate uploaded encrypted size;
- orphan cleanup;
- retry-safe create/upload.

## 3.4 Rich safe file previews

Inline local preview:

- raster images;
- plain text;
- highlighted code files;
- audio;
- video.

PDF:

- inline only if safely sandboxed/local.

Download-only by default:

- HTML;
- SVG;
- unknown binary;
- risky active-content formats.

Flow must be:

> decrypt locally → local Blob/object URL → local preview.

No remote plaintext preview service.

Add:

- individual download;
- **Download All**, preferably local ZIP after decryption.

## 3.5 Custom reveal count

Keep:

- 1;
- 3;
- 5;
- 10;
- Unlimited.

Add:

- Custom exact count.

Use one bounded integer range and enforce it in UI, API and database.

Tests: min/max/invalid and concurrent custom-limit behavior.

## 3.6 Custom expiry + Never

Add:

- expiry presets;
- custom duration;
- exact date/time where useful;
- **Never / no expiry**.

Important:

- Unlimited reveals != Never expiry.
- Never shares remain revocable.
- cleanup/status/reveal logic must handle no expiry timestamp safely.

Tests: custom, boundary, Never, Never + revoke, cleanup.

## 3.7 Policy presets

Implement:

### Quick Share
- now;
- 24h;
- unlimited reveals.

### One-Time Secret
- now;
- 24h;
- 1 reveal.

### Controlled Share
- 7 days;
- 3 reveals.

### Timed Handoff
- available later;
- user-defined expiry.

### Ephemeral
- 1 reveal;
- short reveal window after Day 6 support lands.

Add `Customize`.

Presets must map to the same underlying policy model.

## 3.8 Policy summary before creation

Show plain English:

- availability;
- expiry;
- reveal limit;
- password required;
- second-channel required;
- attachment count;
- discussion enabled;
- reveal window once available.

## 3.9 Landing/product explanation

Improve `/` without adding a marketing gate.

Suggested order:

1. SecureBin name/headline.
2. Browser → Sealed parcel → Recipient proofline.
3. Composer immediately visible.
4. Why SecureBin?
5. How it works.
6. What server can still see.
7. Self-host/open-source.
8. Security/threat-model link.

Suggested copy:

> Share something private. Control when it can be released.

> Encrypted in your browser. Programmable access. No account required.

Keep this time-bounded.

## 3.10 Encrypted discussions — required

Creation:

- `Enable discussion`.

Recipient thread:

- encrypted comments;
- optional encrypted nickname;
- nested replies;
- Markdown;
- code blocks;
- syntax highlighting;
- timestamps;
- reply;
- copy comment;
- mobile-friendly thread;
- lightweight polling/refresh;
- rate limiting.

Crypto:

- separate discussion key with distinct HKDF domain/info;
- fresh nonce per comment;
- encrypt body;
- encrypt nickname;
- encrypt format;
- encrypt parent/thread metadata if practical.

### Discussion capability

Public ID alone must not be enough to scrape the thread.

Preferred design:

1. generate random discussion capability;
2. store only digest server-side;
3. place raw capability inside encrypted main share;
4. recipient gets it after reveal/decrypt;
5. require it to fetch/post encrypted comments.

### Lifecycle

Discussion follows parent:

- expired → disabled;
- revoked → disabled;
- unavailable → disabled.

### Explicitly not in v1 discussion

- editing comments;
- deleting individual comments;
- moderation;
- bans;
- admin moderation;
- WebSockets;
- presence;
- typing indicators;
- persistent commenter identity.

Append-only is enough.

If one-reveal/burn semantics make persistent discussion confusing, it is acceptable to disable discussion for that policy in T1.

## 3.11 Day 5 tests

Markdown:

- sanitization/XSS;
- split/preview;
- mobile.

Code:

- detection;
- override;
- highlighting;
- copy/download.

Files:

- multi-select;
- drag/drop;
- size/count limits;
- upload failure/retry;
- orphan cleanup;
- previews;
- downloads;
- Download All.

Policy:

- custom reveals;
- custom expiry;
- Never;
- presets.

Discussion:

- encryption;
- wrong capability;
- nested reply;
- Markdown XSS;
- rate limit;
- parent expiry/revoke;
- no policy bypass.

## Day 5 exit gate

Do not start Day 6 until:

- Markdown complete;
- Code complete;
- multi-file complete;
- safe previews complete;
- custom reveal complete;
- custom expiry/Never complete;
- presets complete;
- landing/product layer usable;
- discussions functionally complete;
- no Day 4 regressions;
- production build/tests green.

---

# 4. Day 6 — Reveal window, privacy veil, self-hosting, portable parcels, local manager, padding

## Goal

Finish advanced lifecycle/privacy and make SecureBin useful beyond the hosted-link flow.

## 4.1 Finish discussions first

If any required discussion work is incomplete, finish it before starting new Day 6 features. Fix lifecycle/capability/mobile issues and complete tests.

## 4.2 Reveal window / post-first-reveal timer

Options:

- None;
- 10 seconds;
- 30 seconds;
- 1 minute;
- 5 minutes;
- Custom.

Server:

- record first reveal time;
- compute/store reveal-window end;
- stop new ciphertext releases after the window;
- preserve retry-lease semantics.

Browser:

- start local timer after decrypt;
- show remaining time where useful;
- hide decrypted UI at end;
- drop application references where practical.

Correct copy:

> New ciphertext releases stop when the reveal window closes. This browser also hides its decrypted copy. SecureBin cannot erase copies a recipient has already saved.

Tests: first reveal starts window, inside/outside window, retry token, max reveals + window, expiry + window, revoke + window.

## 4.3 Privacy veil

Implement:

- Hide content button;
- Esc hides;
- optional auto-hide on tab visibility/focus loss;
- clear hidden state;
- local re-show when allowed without another server reveal.

Do not call it screenshot prevention.

## 4.4 Local/self-hosted deployment

Target:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm local:setup
pnpm local
pnpm local:stop
```

Use the existing Supabase local stack.

Requirements:

- local migrations;
- local Storage;
- correct RLS/grants;
- `.env.example`;
- no production credentials;
- clean/reset path;
- fresh-clone docs.

Optional if simple/stable:

```bash
docker compose up --build
```

Do not add Kubernetes/Helm/Terraform.

Smoke locally: create, reveal, file, discussion, revoke.

## 4.5 Encrypted portable `.securebin` parcel

Export:

- `Download encrypted parcel`;
- versioned encrypted format;
- no plaintext;
- no link secret;
- no password;
- no unlock code;
- no raw revocation capability.

Import:

- `Open encrypted parcel`;
- drag/drop;
- validate version/schema;
- ask for required factors;
- decrypt locally;
- wrong factors fail;
- tampering fails.

## 4.6 Offline parcel decrypt

Once the user has the parcel + factors, decryption should work without SecureBin/network.

Demo:

1. download parcel;
2. disconnect network;
3. import;
4. enter factors;
5. decrypt locally.

Tests: offline, wrong factor, tampered parcel, unsupported version, text/Markdown/code/files.

## 4.7 Local-only sender share manager

No account.

Show:

- optional local label;
- public ID;
- creation time;
- availability;
- expiry;
- reveal policy;
- remaining reveals if safe;
- open/copy;
- revoke.

Do not store plaintext content. Protect local management capabilities where practical.

Goal:

> Find and revoke an old share without an account.

## 4.8 Expand Privacy Receipt

Include:

- content type;
- file count;
- discussion state;
- availability;
- expiry/Never;
- reveal count;
- reveal window;
- password;
- two-channel;
- padding state;
- algorithms;
- protocol/envelope version;
- fingerprint;
- what stayed local;
- what infrastructure can observe.

Add safe download/print receipt and JSON/text if useful. Never include secrets.

## 4.9 Ciphertext-size padding — implement only if stable

Goal: reduce exact ciphertext-size leakage.

Possible buckets:

- 64 KiB;
- 256 KiB;
- 1 MiB;
- 4 MiB;
- larger sensible buckets.

Requirements:

- authenticated padding;
- unambiguous removal;
- no padded/unpadded confusion;
- explain storage/bandwidth cost;
- receipt reports padded bucket honestly.

If this requires rushed/unclear protocol changes, defer it rather than weakening the protocol.

Tests: bucket boundaries, tamper, wrong key, files/content, version compatibility.

---

# 5. Day 6 stretch features

**Only start stretch work after every required Day 4–6 feature is green in production/local mode.**

## Stretch 1 — Secure Drop / Request a Secret

Strongest stretch feature.

Goal: create a request link so another person can securely send text/files back to the requester.

Possible flow:

1. requester generates encryption keypair;
2. requester private key stays under requester control;
3. request contains public key;
4. contributor opens request;
5. contributor writes/adds files;
6. contributor encrypts to requester public key;
7. server stores ciphertext;
8. requester decrypts locally.

Use standard reviewed/browser-supported asymmetric crypto. No home-grown crypto.

## Stretch 2 — Recipient acknowledgment

Optional button:

> Acknowledge receipt

Sender manager may show ciphertext release time and explicit acknowledgment time.

Never call it a guaranteed/automatic read receipt.

## Stretch 3 — Safe built-in short links

Only if very cheap.

- fragment must stay client-side;
- no external service receives secret fragment;
- no YOURLS/Shlink integration.

## Stretch 4 — Local password-strength meter

- fully local;
- real estimator if practical;
- no network calls;
- lazy-load if large.

## Stretch 5 — Inline PDF preview

Only if clearly safe. Otherwise keep PDF download-only.

## Stretch 6 — QR-based portable transfer

Only after `.securebin` import/export is stable. Never compromise two-channel separation.

## Stretch 7 — Additional size-padding controls

Only after base padding is stable. Keep default UX simple.

## Day 6 exit gate

Before Day 7:

- all required Day 4 work green;
- all required Day 5 work green;
- discussions complete;
- reveal window complete;
- privacy veil complete;
- self-host complete;
- parcel export/import complete;
- offline decrypt complete;
- local share manager complete;
- expanded receipt complete;
- padding either tested or explicitly deferred for safety;
- production/local builds green;
- critical tests green.

Stretch features are not required.

---

# 6. Day 7 — Feature freeze, validation, cleanup, evidence, demo, submission

## Rule

**No major new features on Day 7.**

If required work is unfinished, finish/stabilize it first. Do not begin a new product area.

## 6.1 Freeze

- freeze scope;
- stop speculative dependencies;
- stop UI experiments;
- stop architecture rewrites;
- stop unmeasured optimizations.

## 6.2 Fresh-clone verification

Verify:

```bash
git clone ...
corepack enable
pnpm install --frozen-lockfile
pnpm validate
```

Also test local/self-host instructions from a clean state.

## 6.3 Production smoke matrix

Test real production for:

- plain text;
- Markdown;
- code;
- password;
- two-channel;
- password + two-channel;
- scheduled availability;
- custom expiry;
- Never expiry;
- 1 reveal;
- custom reveal count;
- unlimited reveals;
- multi-file;
- safe previews;
- discussions;
- reveal window;
- revoke;
- portable parcel.

Also test direct/hard-refresh share URLs and confirm header/UI assets always load.

## 6.4 Hero concurrency/fault evidence

Run and save real results.

### 1 reveal

- 100 concurrent requests;
- exactly 1 authorized.

### 3 reveals

- 100 concurrent requests;
- exactly 3 authorized.

### Lost response retry

- first authorization commits;
- simulate lost response;
- retry same token;
- no second reveal consumed.

Also test reveal vs expiry, reveal vs revoke, file signed-URL retry and important discussion lifecycle edges.

## 6.5 Security audit

Review:

- CSP;
- HSTS;
- no-store;
- nosniff;
- frame denial;
- referrer/permissions policies;
- RLS;
- Storage privacy;
- service-role exposure;
- strict schemas;
- oversized/malformed fields;
- XSS;
- Markdown XSS;
- filename XSS;
- discussion XSS;
- unsafe preview formats;
- log leakage;
- analytics leakage;
- cache behavior;
- local/session storage;
- `.securebin` parser validation.

## 6.6 Browser/mobile

Chromium: full critical flow.

Firefox: smoke.

WebKit/Safari: smoke if practical.

Mobile:

- 320px;
- 390px;
- larger phone;
- View Share;
- Markdown;
- code;
- attachments;
- discussions;
- receipt;
- reveal window.

No horizontal overflow.

## 6.7 Accessibility

Verify:

- keyboard-only create/reveal;
- visible focus;
- labels;
- errors associated with fields;
- screen-reader announcements;
- modal/dialog focus;
- drag/drop keyboard equivalent;
- reveal confirmation accessible;
- timer announcements reasonable;
- reduced motion;
- Axe critical violations = 0 where practical;
- manual screen-reader smoke.

## 6.8 Performance

Measure production.

Target representative mobile LCP under 2.5s where practical.

Check:

- initial bundle;
- Markdown loading;
- code highlighter loading;
- QR loading;
- previews;
- discussions;
- large-file encryption.

Use a Worker only if real measurements show blocking.

## 6.9 Repository cleanup

### PrivateBin reference checkout

Do not leave the full PrivateBin checkout in the judge-facing repo unless genuinely required.

Prefer:

- local/gitignored reference;
- short `REFERENCES.md`;
- state PrivateBin was studied as challenge reference;
- state SecureBin is independently implemented;
- do not copy PrivateBin code, wire format or visual identity.

### Archive development noise

Archive/move old Day 2/3 plans, resolved incident notes and temporary debugging docs so judges do not mistake them for current problems.

### Ensure Git does not track

- `node_modules/`;
- generic `test-results/`;
- `tsconfig.tsbuildinfo`;
- local Supabase state;
- secrets/credentials;
- decrypted fixtures;
- temp build output.

Curated evidence may live in `docs/evidence/`.

## 6.10 Code cleanup

Do not allow `composer.tsx` or `viewer.tsx` to become giant mixed-responsibility files.

Split real responsibilities where useful:

- Markdown editor/preview;
- code viewer;
- drop zone;
- attachment list;
- file preview;
- password control;
- unlock control;
- policy controls;
- Privacy Receipt;
- share-result actions;
- discussion thread;
- recipient renderer;
- local share manager.

Do not split files only to increase file count.

## 6.11 Judge-first README

Near the top answer:

1. What is SecureBin?
2. What problem does it solve?
3. What makes it different?
4. Live demo?
5. Security model?
6. What can the server still see?
7. How are reveal limits enforced?
8. How to run locally?
9. What evidence/tests exist?
10. Known limitations?

Include product screenshot, architecture diagram, proofline, differentiators, concurrency evidence, self-host setup, threat model and demo steps.

## 6.12 Rubric evidence table

Point judges to evidence for:

- Core: text, Markdown, code, files, password, lifecycle, discussions.
- Innovation: programmable policies, custom reveal limits, atomic enforcement, retry leases, scheduling, reveal window, two-channel, receipt, portable parcels, offline decrypt.
- Architecture: browser crypto, versioned envelope, key separation, private Storage, transactional enforcement, strict schemas, local deployment.
- UX: presets, Markdown preview, code detection/highlighting, drag/drop, View Share, mobile, keyboard/accessibility.
- Reliability: concurrency, retry, E2E, production smoke, browser/failure handling.
- Documentation: README, architecture, threat model, deployment, policy docs, evidence.

## 6.13 Recommended demo

1. Open polished full-screen SecureBin.
2. Create Markdown/code share.
3. Add multiple files.
4. Enable discussion.
5. Configure availability, expiry, custom reveals, password, two-channel and reveal window.
6. Show policy summary.
7. Create share.
8. Show Privacy Receipt.
9. Show what server sees/does not see.
10. Optionally show ciphertext-only DB/storage evidence.
11. Prove link alone cannot decrypt in two-channel mode.
12. Enter unlock code.
13. Reveal.
14. Show Markdown/code/file previews.
15. Add encrypted discussion reply.
16. Show privacy veil/timer.
17. Export `.securebin`.
18. Turn network off.
19. Import/decrypt parcel offline.
20. Briefly show local/self-host flow.
21. Show 100-request concurrency evidence.
22. Show lost-response retry correctness.
23. Revoke another share.
24. Show uniform unavailable.
25. End with green CI/tests + architecture.

Keep demo short enough that the main story stays clear.

## 6.14 Submission

Before submit:

- production URL works;
- repo works;
- README finished;
- no secrets committed;
- no unnecessary PrivateBin checkout;
- environment snapshot redacted;
- submission notes concise;
- screenshots/video current;
- demo rehearsed;
- every claimed feature actually exists.

Submit early and keep remaining time as emergency buffer.

---

# 7. Full required feature checklist

## Content

- [ ] Anonymous sharing
- [ ] Plain text
- [ ] Markdown Edit/Split/Preview
- [ ] Sanitized Markdown
- [ ] Code mode
- [ ] Syntax highlighting
- [ ] Auto language detection
- [ ] Manual language override
- [ ] Line numbers
- [ ] Raw/copy/download
- [ ] Multiple encrypted files
- [ ] Drag/drop
- [ ] File picker
- [ ] Image preview
- [ ] Text preview
- [ ] Code-file preview
- [ ] Audio preview
- [ ] Video preview
- [ ] Safe PDF behavior
- [ ] Individual download
- [ ] Download All

## Protection

- [ ] URL-fragment secret
- [ ] Password
- [ ] Two-channel unlock
- [ ] Separate-factor QR behavior
- [ ] Revocation
- [ ] Privacy veil
- [ ] Ciphertext-size padding if stable

## Policy

- [ ] Available now
- [ ] Scheduled availability
- [ ] Expiry presets
- [ ] Custom expiry
- [ ] Never expiry
- [ ] 1/3/5/10 reveal presets
- [ ] Custom reveal count
- [ ] Unlimited reveals
- [ ] Atomic enforcement
- [ ] Retry-safe reveal leases
- [ ] Reveal window
- [ ] Policy presets
- [ ] Policy summary

## Discussions

- [ ] Enable discussion
- [ ] Encrypted comments
- [ ] Encrypted nickname
- [ ] Nested replies
- [ ] Markdown comments
- [ ] Highlighted code blocks
- [ ] Discussion capability
- [ ] Parent lifecycle inheritance
- [ ] Rate limiting
- [ ] Mobile thread

## Transparency

- [ ] Privacy Receipt
- [ ] Pre-flight server visibility
- [ ] Technical details
- [ ] Ciphertext fingerprint
- [ ] Known metadata exposure
- [ ] Download/print receipt

## Sharing/transport

- [ ] Copy
- [ ] QR
- [ ] Native share
- [ ] Email
- [ ] Raw/download
- [ ] `.securebin` export
- [ ] `.securebin` import
- [ ] Offline parcel decrypt

## Deployment/management

- [ ] Hosted production
- [ ] Local/self-host
- [ ] `pnpm local:setup`
- [ ] `pnpm local`
- [ ] `pnpm local:stop`
- [ ] Docker if simple/stable
- [ ] Local sender manager
- [ ] Revoke from local manager

## UI fixes

- [ ] Full-screen desktop
- [ ] View Share fixed
- [ ] Header consistently loads
- [ ] General UI load fixed
- [ ] No hydration errors
- [ ] Stable theme loading
- [ ] Mobile responsive
- [ ] No horizontal overflow
- [ ] Stable lazy-load fallbacks
- [ ] Landing/product explanation

## Testing/evidence

- [ ] Crypto tests
- [ ] Policy tests
- [ ] Concurrency tests
- [ ] Idempotency tests
- [ ] File tests
- [ ] Discussion tests
- [ ] Security/XSS tests
- [ ] RLS/grant tests
- [ ] Browser tests
- [ ] Mobile tests
- [ ] Accessibility tests
- [ ] Production smoke
- [ ] Local smoke
- [ ] No sensitive logs
- [ ] Real judge evidence

## Documentation

- [ ] Judge-first README
- [ ] Architecture
- [ ] Diagrams
- [ ] Threat model
- [ ] Deployment
- [ ] Self-host guide
- [ ] Policy-state docs
- [ ] Rubric evidence table
- [ ] Concurrency evidence
- [ ] Known limitations
- [ ] Demo script
- [ ] Repo cleanup
- [ ] Submission notes

---

# 8. Stretch checklist

Only after required work is green:

- [ ] Secure Drop / Request a Secret
- [ ] Recipient acknowledgment
- [ ] Safe built-in short links
- [ ] Local password-strength meter
- [ ] Inline PDF preview if safe
- [ ] QR-based portable transfer
- [ ] Extra size-padding controls

---

# 9. Explicitly not implementing for T1

Do not start these unless the user explicitly changes scope.

## Accounts/identity

- Magic-link accounts
- Google login
- General login system
- Passkeys
- Persistent sender/recipient identity
- User profiles

## Recipient device system

- Long-lived device keypairs
- Public device-key directory
- Recipient-bound shares
- ECDH per-recipient wrapping
- Device fingerprints
- Trusted-device approval/removal/recovery
- Multi-device identity sync

## Secure Rooms/realtime

- Secure Rooms
- Persistent encrypted group rooms
- Realtime encrypted chat
- WebSocket discussions
- Presence
- Typing indicators
- Room invitations/membership
- Room-key rotation
- Multi-device room recovery
- Collaborative editing/CRDTs

## Extra discussion systems

- Edit comments
- Delete individual comments
- Moderation/bans/admin moderation
- Persistent commenter accounts

## Crypto/platform systems

- Argon2id/WASM for T1
- Multiple selectable/pluggable KDFs
- Key transparency
- Sender identity signatures
- Advanced traffic-analysis protection beyond optional size padding
- Guaranteed RAM zeroization
- Home-grown crypto
- Formal proof work
- Shamir K-of-N threshold unlock

## Infrastructure breadth

- S3/GCS/filesystem storage adapters
- MySQL/SQLite/multiple DB engines
- Kubernetes
- Helm
- Terraform
- Heavy multi-node infrastructure

## Enterprise

- Organization policies
- Enterprise accounts
- Large admin platform
- User administration
- Enterprise identity

## Platform expansion

- CLI
- Browser extension
- Android/iOS apps
- Full public SDK
- Full external API product
- Full OS integration beyond Web Share

## Full PWA

- Service-worker offline product
- Complex offline sync
- Decrypted-content caching

Offline `.securebin` decryption is enough.

## Localization/themes

- Full i18n
- Dozens of translations
- Large language selector
- Large theme/template system

## PrivateBin compatibility

- PrivateBin wire-format compatibility
- PrivateBin importer
- Full operational/configuration parity

## External shorteners

- YOURLS
- Shlink
- Generic third-party shortening

## AI

- Cloud AI summarization
- Cloud AI code explanation
- External LLM processing of decrypted content
- AI security assistant

## Secret-generator toolbox

- Password generator
- Token generator
- UUID generator
- Hex-secret generator

## Clipboard claims

- Guaranteed clipboard auto-clear
- Clipboard monitoring
- Claims clipboard can always be erased

## File extras

- Required plaintext SHA-256 display
- Unsafe HTML/SVG preview
- Remote plaintext preview/rendering services

## Share mutation

- Editing published plaintext
- Replacing published content
- Full version history

## Read receipts

- Automatic read receipt
- Tracking pixels
- Claim that ciphertext release proves reading

## Screenshot/DRM

- Screenshot-prevention claims
- DRM
- Remote-copy erasure claims

## Two-channel anti-pattern

- One QR containing both URL secret and unlock code

## Blockchain

- Blockchain audit logs
- Smart contracts
- NFTs
- Decentralization gimmicks

---

# 10. Product positioning

Do not call SecureBin:

> PrivateBin but Next.js.

Do not claim:

> SecureBin is more secure than PrivateBin in every way.

Use a defensible description:

> **SecureBin is a browser-encrypted sharing platform for text, Markdown, code, files, and encrypted discussions, built around programmable release policies. Shares can be scheduled, limited to an exact number of ciphertext releases, protected by password and separate-channel factors, restricted by a post-reveal window, revoked, exported as portable encrypted parcels, or operated on self-hosted infrastructure.**

Main differentiators:

- programmable access policies;
- custom exact reveal limits;
- atomic concurrent enforcement;
- retry-safe reveal leases;
- scheduled availability;
- post-first-reveal window;
- two-channel unlock;
- Privacy Receipt;
- pre-flight server-visibility explanation;
- portable encrypted parcels;
- offline parcel decryption;
- self-hosting;
- encrypted discussions;
- modern Markdown/code/file UX.

---

# 11. Final instruction to the agent

**Do not execute this plan until the user explicitly says to start.**

When permission is given:

1. Read the current repository.
2. Read `AGENTS.md`.
3. Read `docs/architecture.md`.
4. Run the Day 4 entry gate.
5. Report blockers/conflicts.
6. Start only the requested day.
7. Keep tests green while implementing.
8. Never silently promote stretch work into required scope.
9. Do not implement deferred features without direct user approval.
10. Treat Day 7 as feature freeze/stabilization, not another feature day.

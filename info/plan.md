# SecureBin — Challenge 1 Implementation and Roadmap Plan

## Summary

SecureBin will be a modern zero-knowledge sharing platform centered on:

- Fast browser-encrypted sharing of text, Markdown, code, and files.
- Programmable access policies: expiry, scheduled availability, revocation, password protection, burn-after-opening, and configurable reveal limits.
- Atomic policy enforcement that remains correct under concurrent requests.
- Two-channel unlock, splitting the decryption material between a link and a separately shared code.
- A clear Privacy Receipt explaining what was protected and what metadata remains visible.

The judged release will prioritize a polished, reliable core with a strong point-per-feature ratio. Every valuable additional feature—including recipient-bound sharing, passkeys, encrypted rooms, discussions, localization, richer previews, padding, and device management—remains in the documented roadmap instead of being discarded.

## Judged Release

### Secure sharing

- Anonymous sharing of text, sanitized Markdown, and syntax-highlighted code.
- One encrypted file per share, up to 10 MiB of plaintext; encrypt file contents, filename, and MIME metadata.
- Text content is limited to 512 KiB of UTF-8 data.
- Preview images and plain-text files; securely download other formats.
- Browser-side AES-256-GCM encryption with a fresh nonce and versioned authenticated envelope.
- Random 256-bit link secret stored only in the URL fragment.
- Optional password protection using browser-native PBKDF2-SHA-256 combined with the link secret through HKDF-SHA-256.
- Owner revocation through a random deletion capability whose digest alone is stored.
- QR code, copy-link, native-share, email-client, raw-text, and download actions.

### Programmable access policy

- Optional `available_at`; expiry defaults to 24 hours and is capped at 30 days for the judged release.
- Maximum ciphertext reveals: 1, 3, 5, 10, or unlimited.
- Burn-after-opening as the one-reveal preset.
- Atomic database enforcement so concurrent requests cannot exceed the configured limit.
- Non-consuming status request followed by explicit confirmation before a limited reveal.
- Uniform unavailable response for missing, expired, consumed, and revoked shares.
- Idempotent creation and deletion.
- Scheduled cleanup of expired records and encrypted objects.

### Two-channel unlock

- Generate an independent random 128-bit unlock secret and encode it as a readable Crockford Base32 code with a check symbol.
- Derive object keys from input containing both the URL-fragment secret and unlock secret.
- Never upload the unlock code or its verifier.
- Clearly instruct the sender to transmit the link and code through separate channels.
- Demonstrate that neither component decrypts the content independently.

### Privacy Receipt

After creation, show:

- Content was encrypted in the browser.
- The content key, password, unlock code, filename, and plaintext were not uploaded.
- The exact availability, expiry, revocation, and reveal policy.
- The remaining metadata visible to infrastructure: ciphertext size, timestamps, network information, and access patterns.
- Expandable technical details containing algorithms, envelope version, and ciphertext fingerprint.

## Architecture and Interfaces

- Next.js App Router, strict TypeScript, Tailwind CSS, accessible UI primitives, and lazily loaded editor/preview dependencies.
- Vercel deployment with Supabase Postgres and private Storage.
- Root modules for `crypto`, `shares`, `policies`, `attachments`, `api`, `database`, and reusable UI.
- Tables:
  - `shares`
  - `upload_reservations`
  - `reveal_leases`
  - `rate_limit_buckets`
  - encrypted Storage objects
- Versioned APIs:
  - `POST /api/uploads`
  - `POST /api/shares`
  - `GET /api/shares/:publicId/status`
  - `POST /api/shares/:publicId/reveal`
  - `DELETE /api/shares/:publicId`
  - short-lived signed encrypted-file operations
- Server schemas must reject unexpected or plaintext-bearing fields.
- Apply rate limits, restrictive CSP, HSTS, `no-store`, `nosniff`, frame denial, referrer policy, and permissions policy.
- Logs may contain request IDs, status, latency, and coarse size buckets only—not plaintext, fragments, passwords, unlock codes, tokens, filenames, ciphertext bodies, or full secret URLs.

## Experience and Design

- Make the landing page a focused composer without mandatory signup.
- Use protection presets with progressively disclosed advanced settings.
- Use the “sealed evidence envelope” identity:
  - Deep navy `#101827`
  - Paper white `#F7F8F5`
  - Slate `#647083`
  - Cyan seal `#22C7D6`
  - Amber warning `#F4B942`
- Make the seal/encryption transition the single signature interaction.
- Support light, dark, and system appearance.
- Meet WCAG AA, keyboard navigation, visible focus, semantic structure, screen-reader announcements, reduced motion, and mobile responsiveness.
- Implement complete loading, retry, offline, malformed-link, wrong-key, wrong-password, scheduled, and uniform unavailable states. Do not reveal whether an unavailable share is missing, expired, consumed, or revoked.
- Never claim the server counts successful decryptions; it counts successful ciphertext releases.

## Cryptographic Design

- Generate a random 128-bit public ID and 256-bit link secret with `crypto.getRandomValues` before encryption. The client-selected public ID lets authenticated data bind ciphertext to its final URL without waiting for a server response.
- Use a versioned envelope containing:
  - format version
  - AES-256-GCM algorithm identifier
  - fresh random 96-bit nonce
  - separate HKDF salt, optional password salt, and KDF parameters
  - canonical authenticated context containing public ID, object type, format version, KDF parameters, and factor mask
  - ciphertext
- Keep the link secret exclusively in the URL fragment: `/s/{publicId}#secret`.
- Build fixed-order input key material and derive object keys using browser-native Web Crypto:
  - Without a password: use the link secret as input key material.
  - With a password: PBKDF2-HMAC-SHA-256 derives 32 bytes using a random 128-bit password salt and 600,000 iterations; append that fixed-length output to the link secret.
  - Limit password input to 1,024 UTF-8 bytes and accept only the supported v1 iteration count to prevent malicious-envelope resource exhaustion.
  - Use a separate random 128-bit HKDF salt and derive independent content and file keys directly from the combined input using distinct versioned HKDF `info` labels.
  - Give every encrypted object its own random 96-bit AES-GCM nonce; never reuse a nonce with the same derived key.
- In two-channel mode, generate an independent random 128-bit unlock secret, formatted with Crockford Base32 in readable groups plus a check symbol.
- Append the decoded unlock secret to the HKDF input key material; neither the fragment nor unlock code can derive object keys independently.
- Include a factor mask in HKDF domain separation so password, two-channel, and combined modes cannot be confused.
- Encrypt content, mode, filename, MIME type, and file bytes. Only lifecycle fields required for server enforcement remain plaintext.
- Use established Markdown parsing and strict sanitization; decrypted HTML is never trusted.
- Document residual risks:
  - Malicious application JavaScript can capture plaintext or keys.
  - Compromised recipient devices can capture decrypted content.
  - Hosting/network providers may observe IPs, timestamps, ciphertext sizes, and access patterns.
  - Password strength still matters if an attacker obtains both ciphertext and link secret.
  - Revocation cannot erase content already decrypted or downloaded.

## Data Model and Server Behavior

### `shares`

- `id` and opaque `public_id`
- `content_envelope` containing versioned metadata and ciphertext
- `created_at`, `available_at`, `expires_at`, and `revoked_at`
- `max_reveals` and `reveal_count`
- `delete_token_hash`
- `password_required` and `unlock_required` prompting flags
- `file_object_path`, `file_envelope`, and `file_ciphertext_size`
- `idempotency_key_hash`

The public ID and idempotency key are generated client-side. Store only the deletion-capability digest and idempotency-key digest.

### `upload_reservations`

- Random Storage object path and reservation identifier.
- Creation and expiry timestamps.
- Ciphertext size and attachment state.
- Optional attached share ID.

### `reveal_leases`

- Share ID and hash of a client-generated reveal request token.
- Five-minute retry expiry.
- Unique constraint on share ID plus request-token hash.
- A retry with the same active token returns authorization without incrementing `reveal_count` again.

### `rate_limit_buckets`

- Hashed request discriminator.
- Action type.
- Bucket start time.
- Request count.

### Storage

- Use a private bucket containing encrypted file objects only.
- Object paths are random and never contain filenames.
- Use short-lived signed operations and validate declared ciphertext size.

### API behavior

- `POST /api/uploads`
  - Reserve a random private object path and return a raw reservation capability plus a short-lived signed upload operation with overwrite disabled.
  - Accept only declared ciphertext size and envelope metadata; never accept a filename or plaintext MIME type.
- `POST /api/shares`
  - Accept content envelope, policy, encrypted file reference, raw upload-reservation capability, deletion-token digest, and idempotency-key digest.
  - Hash and validate the reservation capability without logging it and verify the uploaded object's actual size before attachment.
  - Reject plaintext-shaped, unknown, or oversized fields.
  - Return the public ID; the client retains the raw deletion capability.
- `GET /api/shares/:publicId/status`
  - Return `active`, `scheduled`, or uniform `unavailable` plus display-safe policy information.
  - Do not increment reveal counts or return ciphertext.
- `POST /api/shares/:publicId/reveal`
  - Accept a random client-generated reveal request token.
  - Atomically validate availability, expiry, revocation, remaining reveals, and any existing retry lease.
  - Increment `reveal_count`, create a five-minute lease, and return ciphertext in one database transaction.
  - Retry with the same active token without consuming another reveal.
  - Allow exactly one concurrent request to consume the final reveal.
  - Generate a 60-second encrypted-file download URL only after transaction success; the same lease can regenerate it after a failed response.
- `DELETE /api/shares/:publicId`
  - Hash the supplied deletion capability and atomically revoke the share.
  - Make repeated valid deletion idempotent.
- Scheduled cleanup removes expired/revoked objects and abandoned uploads.
- Apply rate limits separately to upload, create, status, reveal, and delete operations. Store only a server-HMACed network discriminator, never a raw IP address.
- Return the same outward unavailable response for missing, expired, consumed, and revoked shares where revealing the distinction would aid enumeration.

## Reliability Rules

- A reveal is consumed when a new transactional authorization lease is committed. A lost response can be retried with the same token without consuming another reveal.
- Reveal limits control server-authorized ciphertext releases; they cannot prevent copying, screenshots, or reuse after decryption.
- Passwords and two-channel codes are unknown to the server. A wrong factor can consume a reveal because it cannot be verified without retrieving ciphertext.
- Viewer confirmation occurs before calling the reveal endpoint for limited shares.
- Creation is idempotent across double-clicks, retries, and lost responses.
- File upload uses a staged state:
  1. Upload encrypted object.
  2. Create the share referencing it.
  3. Mark the upload attached.
  4. Clean up stale unattached objects asynchronously.
- Preserve an unsent local draft in memory during recoverable network failures; never persist decrypted content to server logs, analytics, or browser caches.
- Disable action buttons while requests are pending and handle repeat submissions safely at the API layer.
- Use UTC in storage and display localized absolute and relative times.
- Never rely solely on scheduled cleanup: every reveal checks lifecycle state transactionally.
- Run hourly cleanup for expired shares, revoked attachments, abandoned upload reservations, stale leases, and rate-limit buckets.

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only
- `RATE_LIMIT_HMAC_KEY` — server-only
- `CRON_SECRET` — server-only
- `NEXT_PUBLIC_APP_URL`

## Complete Future Roadmap

### PrivateBin capability expansion

- Multiple encrypted attachments.
- Image, audio, video, and sandboxed PDF previews.
- Encrypted nested discussions with optional nicknames.
- Expanded expiration presets and administrative configuration.
- Built-in safe short links that never disclose URL fragments.
- Full localization and automatic locale selection.
- Additional themes and templates.
- Optional encrypted export/import and QR-based device transfer.
- Interoperability importer for compatible PrivateBin exports where legally and technically appropriate.

### Recipient-bound sharing

- Magic-link accounts with optional passkey enrollment.
- Browser-generated device encryption keypairs.
- Public device-key registration.
- Per-recipient content-key wrapping with ECDH and HKDF.
- Human-verifiable key fingerprints.
- Shares that require possession of an authorized recipient device in addition to the URL.
- Trusted-device approval, removal, recovery, and cross-device transfer.
- Treat Supabase passkeys as experimental until its API is stable; keep magic-link authentication as the fallback.

### Secure Rooms

- Authenticated encrypted rooms.
- Recipient-specific wrapped room keys.
- Realtime encrypted messages.
- Shared encrypted Markdown/code notes.
- Encrypted room attachments.
- Presence indicators that reveal the minimum metadata necessary.
- Event ordering, reconnection, deduplication, and offline-draft recovery.
- Membership invitations and removal.
- Room-key rotation for future messages after membership changes.
- Multi-device access and recovery.
- Optional richer collaborative editing after the append-only room model is stable.

### Security hardening

- Argon2id password derivation through an audited Worker/WASM integration.
- Ciphertext size-bucket padding.
- Pluggable KDF and envelope-version migration.
- Key transparency or signed device-directory records.
- Optional sender signatures and authenticity verification.
- Encrypted local drafts guarded by a device-held key.
- Abuse controls that do not require access to plaintext.
- Formal protocol documentation and independent cryptographic review.
- More advanced traffic-analysis mitigations.
- Self-hosted deployment option and alternate encrypted storage adapters.

### Platform expansion

- Service worker for static assets while continuing to prohibit decrypted-content caching.
- Richer privacy-preserving operational telemetry.
- Administrative encrypted-object lifecycle tools.
- Organization policies and managed deployments.
- CLI and browser extension.
- Mobile share-sheet integration.
- API/SDK for client-side encrypted integrations.
- Full browser and platform compatibility matrix.

Future work must be clearly labeled in documentation and screenshots so judges never mistake roadmap items for implemented functionality.

## Repository Artifacts

- Create a concise root `AGENTS.md` containing:
  - Product objective and rubric priorities.
  - Architecture and module boundaries.
  - Development, test, build, and migration commands.
  - Mandatory cryptographic and zero-knowledge invariants.
  - Prohibited server and log data.
  - Transactional lifecycle rules.
  - Required validation before merge and submission.
  - Instruction to treat the remaining `/info` material and nested PrivateBin checkout as read-only references.
  - Prohibition against copying PrivateBin code or visual identity.
- Add:
  - `.env.example`
  - Supabase migrations and development seed
  - CI workflow
  - threat model
  - security policy
  - architecture and policy-state diagrams
  - demo/smoke script
  - judge-oriented README
  - dependency update configuration

## Verification

### Crypto

- Round-trip text, Unicode, Markdown, code, and binary files.
- Wrong key, password, and unlock code fail closed.
- Modified ciphertext, nonce, authenticated metadata, or envelope fails closed.
- Two-channel components cannot decrypt independently.
- Test nonce uniqueness across a large generated sample.
- Maintain golden v1 vectors for content, file, password, two-channel, and combined-factor envelopes.
- Prove content and file keys differ for identical input key material and salts.

### Policy and database

- Scheduled shares remain unavailable before `available_at`.
- Expiry, revocation, deletion capability, and cleanup work correctly.
- Idempotent retries create one logical share.
- Retrying an active reveal lease returns authorization without incrementing the counter.
- Twenty concurrent requests to a one-reveal share produce exactly one success.
- Twenty concurrent requests to a three-reveal share produce exactly three successes.
- Reveal racing against expiry or revocation cannot violate policy.
- Incorrect deletion capabilities fail without disclosing sensitive state.
- Orphaned encrypted uploads are removed without affecting active shares.

### Browser and security

- Main create/reveal flow.
- Password, burn, view-limit, scheduled, revoke, and two-channel flows.
- Markdown XSS payload rejection.
- File validation, preview, and download.
- Copy, QR, email-client, and native-share fallbacks.
- Mobile and keyboard-only workflows.
- Malformed URLs, offline behavior, slow requests, retries, refreshes, double-clicks, and unavailable states.
- Complete critical flow in Chromium and smoke coverage in Firefox.
- Axe checks plus manual keyboard and screen-reader review.

### Performance

- LCP below 2.5 seconds under a representative deployed mobile profile.
- Lazy-load editors, highlighting, Markdown preview, QR, and file-preview modules.
- Avoid large render-blocking bundles.
- Move expensive file encryption to a Web Worker if measurements show visible blocking.
- Verify the documented maximum file size against the actual Vercel/Supabase deployment.

## Delivery Order

1. Initialize the application, migrations, CI, `AGENTS.md`, design tokens, and production deployment.
2. Complete compose → encrypt → store → reveal → decrypt for text on production.
3. Implement expiry, availability, atomic reveal limits, burn, revocation, idempotency, rate limiting, and concurrency tests.
4. Add password protection, Markdown/code, encrypted file handling, safe previews, QR/share actions, and Privacy Receipt.
5. Add two-channel unlock and access-policy presets.
6. Finish error states, mobile/accessibility, security headers, cleanup, browser tests, and performance verification.
7. Freeze features; run fresh-clone and production smoke tests, finish README/video/screenshots, rehearse the demo, and submit early.
8. Begin roadmap capabilities only after every judged-release acceptance criterion passes.

If time becomes constrained, defer roadmap work and trim optional preview polish before touching encryption correctness, policy atomicity, accessibility, failure handling, tests, deployment, or documentation.

## Judge Story

> SecureBin rethinks encrypted sharing around programmable access policies. Content is encrypted inside the browser while the server atomically controls when and how many times ciphertext may be revealed. Advanced shares split their decryption material across two communication channels, and every share includes a transparent receipt describing both its protections and unavoidable metadata exposure.

### Recommended demonstration

1. Create a Markdown share with an encrypted file.
2. Configure three reveals, expiry, and two-channel unlock.
3. Show the Privacy Receipt and ciphertext-only database record.
4. Prove the link alone cannot decrypt.
5. Reveal using the separately shared unlock code.
6. Run the concurrency test and show the reveal count is never exceeded.
7. Revoke another share and demonstrate its uniform unavailable state.
8. Finish with passing CI, accessibility evidence, architecture diagram, and future roadmap.

## Rubric Target

- **Problem Understanding — 20/20:** honest zero-knowledge model, controlled sharing, lifecycle handling, safe files, and explicit limitations.
- **Innovation — 20/20:** programmable policies, atomic concurrency enforcement, two-channel unlock, and Privacy Receipt.
- **Architecture — 15/15:** versioned cryptography, transactional state changes, private encrypted storage, strict schemas, and maintainable boundaries.
- **UX and Accessibility — 15/15:** immediate anonymous workflow, presets, progressive disclosure, responsive design, and complete accessible states.
- **Reliability and Demo — 20/20:** early deployment, idempotency, concurrency proof, automated browser tests, and polished failure recovery.
- **Documentation — 10/10:** judge-first README, reproducible setup, diagrams, threat model, evidence table, limitations, roadmap, and rehearsed demo.

## Assumptions

- Vercel and Supabase Postgres/Storage are available.
- Reveal limits count successful server releases of ciphertext, not client decryption.
- PBKDF2/HKDF is the judged-release default because it is browser-native; Argon2id remains planned hardening.
- The Challenge 1 objective is meaningful modernization and core capability coverage rather than copying every reference feature into the initial release.
- All valuable deferred capabilities remain documented here as future work and are implemented only after the judged release is complete and stable.
- `architecture.md` is the technical source of truth for protocol, schema, trust boundaries, and API contracts; this plan remains the product and delivery source of truth.

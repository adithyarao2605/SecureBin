# SecureBin Handoff

Updated: 2026-08-22 (Asia/Kolkata)

## Completed

- **UI Copy & Quiet Proof Polish Audit**:
  * Inspected all 10 screens in Stitch MCP project (`SecureBin Quiet Proof Design System v1`).
  * Removed AI marketing tropes ("military-grade encryption", "self-destruct", "sensitive data", "Destroy Now").
  * Standardized proofline node nomenclature (`Browser` → `Sealed parcel` → `Recipient`) across all viewports.
  * Standardized policy controls, clean trust line descriptions (`Your browser encrypts this before it leaves the page.`), and action button labels (`Copy link`, `Create share`, `Reveal once`).
  * Synced newly generated clean UI screens into owned Stitch project `projects/5041201174043254098` ("SecureBin Quiet Proof V2").
  * Validated that local codebase components (`composer.tsx`, `proofline.tsx`, `evidence-rail.tsx`, `policy-controls.tsx`, `viewer.tsx`) strictly conform to the approved copy contract.

- **Day 3: Safe Content and Encrypted Attachments Fully Implemented and Validated**:
  * **Independent Cryptography (Step 1 & 2)**:
    - Implemented binary `SBCT` framing for v2 structured content payloads (`0x53, 0x42, 0x43, 0x54`, version `0x01`, modes `note` / `markdown` / `code`, 8 languages `javascript` / `typescript` / `json` / `python` / `bash` / `sql` / `css` / `html` / `plaintext`).
    - Implemented binary file framing (`uint32` filename length, `uint16` MIME length, filename UTF-8, MIME UTF-8, data) and independent key derivation using `securebin/v2/link/file` (`sealFile` and `openFile`).
    - Verified strict domain separation: content key cannot decrypt file ciphertext, and file key cannot decrypt content ciphertext.
    - Verified unique random nonces per payload even when sharing the same salt.
    - Locked size limits: plaintext file max 10 MiB (`10_485_760`), max filename 512 bytes, max MIME 128 bytes, header 6 bytes, tag 16 bytes, max file ciphertext `10_486_422` bytes, max content bytes `524_288`, max v2 content ciphertext `524_315` bytes.
  * **Safe Markdown & Code Rendering (Step 3)**:
    - Integrated browser-only `react-markdown@10.1.0` and `remark-gfm@4.0.1` with `skipHtml={true}`, conservative `allowedElements` allowlist, image stripping component override to prevent tracking/remote requests, and tightened URL protocol filtering (`https:`, `http:`, `mailto:` only).
    - Integrated browser-only `lowlight@3.3.0` registered with only the 8 fixed languages (no auto-detection). Converted HAST directly to React with allowlisted `hljs-*` classes and fallback to plain text on any unexpected AST property or markup.
    - Created accessible `<CodeView>` with copy button and `<MarkdownView>`.
  * **Storage & Upload Boundary Audit (Step 4)**:
    - Audited `POST /api/uploads` and `lib/shares/contracts.ts` against locked `10_486_422` file ciphertext limit and v2 file envelope schema.
    - Enforced zero-knowledge invariants: server never receives plaintext filenames, MIME types, or plaintext bodies.
  * **Encrypted Upload Flow in Composer (Step 5)**:
    - Updated `app/components/composer.tsx` with mode tabs (**Plain note**, **Markdown**, **Code** with language selector) and single-file encrypted attachment selector.
    - Implemented staged creation: local validation -> single `ShareCryptoContext` generation -> binary framing -> file sealing -> upload reservation -> PUT ciphertext to signed storage URL -> create share RPC -> fragment URL construction.
    - In-flight error preservation (`preparedRef.current`) preserves idempotency context and prevents nonce reuse or orphaned uploads.
  * **Database Attachment Contracts (Step 6)**:
    - Created forward migration `supabase/migrations/20260823000000_day3_safe_content_and_attachments.sql`.
    - Updated `securebin_valid_envelope` to support v1 content, v2 content, and v2 file (strictly rejecting v1 file).
    - Updated `create_upload_reservation` with `10_486_422` size bounds and v2 file validation.
    - Updated `create_share` with v2 content limit (`524_315`), v2 file envelope validation, and actual storage object size verification.
    - Added pgTAP test suite `supabase/tests/04_day3_attachments.sql`.
  * **Authorized Reveal of Encrypted Downloads (Step 7)**:
    - Updated `lib/server/share-service.ts` and `lib/server/share-routes.ts` to generate 60-second signed download URLs on reveal for shares with attached files.
    - Maintained zero-knowledge guarantee: storage paths and credentials are never exposed directly to clients; only temporary signed download URLs are returned.
  * **Safe Local Attachment Previews (Step 8)**:
    - Created `lib/render/file-safety.ts` with magic byte detection for PNG, JPEG, GIF, WebP, fatal UTF-8 text validation, executable/HTML header rejection, and filename sanitization.
    - Created `app/components/file-preview.tsx` managing browser Blob URL lifecycle with automatic `URL.revokeObjectURL` cleanup on unmount.
    - Updated `app/s/[publicId]/viewer.tsx` to handle reveal with attached file download, decryption, and multi-mode rendering.
  * **Orphaned File Cleanup (Step 9)**:
    - Verified and extended `lib/server/cleanup-service.ts` to sweep storage objects for expired/exhausted shares, unattached upload reservations, and rotated uploads.
  * **Full Verification and Validation (Step 10)**:
    - Full test suite passed across 101 unit tests (including crypto golden vectors, framing, sanitization, XSS vectors, upload boundary, and retry mechanics).
    - Production build (`next build`), strict typecheck (`tsc --noEmit`), lint (`eslint`), and reproducibility check (`verify-reproducibility.py`) all passed with zero errors.

## Recent Hardening & Production Rollout

- **Production Storage URL Normalization & Diagnostic Logging (`af90c97`)**:
  * Fixed relative signed upload URLs returned by `@supabase/storage-js` by implementing `normalizeStorageUrl` in `lib/server/storage.ts`. Guarantees all signed upload and download URLs are fully qualified absolute URLs pointing directly to hosted Supabase Storage.
  * Added structured error logging across `app/components/composer.tsx`, `lib/server/upload-routes.ts`, and `lib/server/share-routes.ts` for safe observability in browser consoles and Vercel logs.

- **Accessibility Gate Pass (`a99b254`)**:
  * Added explicit `<label htmlFor="file-attachment-input" className="sr-only">` and `aria-label="Attach file (max 10 MB)"` to the file input in `app/components/composer.tsx`, eliminating axe `id: "label"` critical violation.

- **E2E Test Assertion Alignment (`45c3e66`)**:
  * Updated `tests/e2e/secure-share.spec.ts` to expect Day 3 `version: 2` content envelopes with `SBCT` binary framing.

- **Hermetic Test Isolation & CI URL Protection (`4b8e396`)**:
  * Reverted dummy fallback in `tests/setup.ts` to prevent overriding CI's `NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321`.
  * Injected hermetic `fakeStorage` into `tests/integration/share-service.test.ts` so unit/RPC tests run purely in memory without external dependencies.

- **Remote Database Migration Rollout**:
  * Executed `20260823000000_day3_safe_content_and_attachments.sql` on remote production Supabase (`db-muxxcejnohhrcgdmdnmh`).
  * Updated `securebin_valid_envelope` to validate v1 and v2 envelopes, expanded ciphertext limits to 10 MiB (`10_486_422`), and updated `create_share` / `create_upload_reservation` RPCs.

## Validation Status

- `pnpm validate` passed: ESLint (0 errors), strict TypeScript (`tsc --noEmit`), 101/101 unit tests, and production build (`next build`).
- `pnpm test` passed: 15/15 test files, 101/101 unit tests.
- `pnpm test:integration` passed: 4/4 integration tests.
- `pnpm test:e2e` passed: 8/8 Playwright tests.
- `pnpm test:a11y` passed: 2/2 Axe accessibility tests (0 critical violations).
- `.venv/bin/python scripts/verify-reproducibility.py` passed: status `OK: reproducibility and documentation contract is valid`.
- Production verification: `GET /api/health` (200), `POST /api/uploads` (201), `PUT <storageUrl>` (200), `POST /api/shares` (201), `GET /api/shares/[id]/status` (200), and `POST /api/shares/[id]/reveal` (200).

## Next Steps for Session (Day 4 Scope)

1. **Password Factors (PBKDF2 / Argon2id)**:
   - Support optional client-side passphrase entry with 600,000 PBKDF2 iterations or Argon2id.
   - Set `factorMask: "link+password"` and derive independent object keys (`securebin/v2/link+password/content` and `/file`).
   - Store `password_required: true` metadata on `public.shares` without storing passwords or password hashes.

2. **Two-Channel Unlock Codes**:
   - Generate independent 16-byte Crockford Base32 unlock codes with check symbols.
   - Set `factorMask: "link+unlock"` / `"link+password+unlock"` and derive independent object keys.
   - Require both URL fragment secret and manually entered unlock code in viewer to decrypt.

3. **Privacy Receipt & QR Generation**:
   - Generate offline SVG/canvas QR code containing the full fragment share link.
   - Render the Privacy Receipt breaking down protected ciphertext vs visible server metadata.

4. **Edge Cases & Failure Hardening**:
   - Malformed fragment recovery, wrong password/unlock retry limits, and offline indicators.

## Recent Commits

- `af90c97 fix(storage): normalize signed upload URLs and add safe error diagnostics`
- `a99b254 fix(a11y): add accessible label to file attachment input`
- `45c3e66 test(e2e): update content envelope version assertion for Day 3`
- `4b8e396 test(integration): isolate share-service rpc test and revert env override`
- `755fd93 test(integration): include file metadata in reveal test expectation`
- `221546d test(db): include file envelope and size on direct share insert`
- `5124908 feat(cleanup): remove orphaned encrypted files`
- `7c7c774 feat(ui): add safe local attachment previews`
- `4639c61 feat(attachments): reveal encrypted downloads safely`
- `46c2895 fix(db): enforce encrypted attachment contracts`
- `eceb804 feat(attachments): add encrypted upload flow`
- `43c0be0 feat(content): render markdown and code safely`
- `017c8a5 feat(crypto): add independent file encryption`


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

## Validation

- `pnpm validate` passed: lint, strict typecheck, 101/101 unit tests, and production build.
- `pnpm test` passed: 15/15 test files, 101/101 tests passed.
- `.venv/bin/python scripts/verify-reproducibility.py` passed with status `OK: reproducibility and documentation contract is valid`.
- `pnpm audit` passed with zero advisories.

## Remaining / Blockers

- Day 3 is fully completed and validated locally.
- Day 4 roadmap: passwords (Argon2id/PBKDF2), two-channel unlock code, QR code generation, and Privacy Receipt.

## Deployment Instructions (Owner-Operated)

To deploy or update production:
1. Ensure the following environment variables are set in your hosting platform (e.g. Vercel):
   - `NEXT_PUBLIC_APP_URL`: Production origin (e.g. `https://your-domain.com`)
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL (`https://<project-ref>.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase project anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role secret key (server-only)
   - `RATE_LIMIT_HMAC_KEY`: 32+ byte random secret for rate limit IP discriminator hashing
   - `CRON_SECRET`: Random secret for authenticating `POST /api/internal/cleanup`
2. Push database migrations to remote Supabase:
   ```bash
   pnpm supabase db push
   ```
3. Set up recurring cron (e.g. every 10–30 mins) to call `POST https://<your-domain>/api/internal/cleanup` with header `Authorization: Bearer <CRON_SECRET>`.

## Recent Commits

- `5124908 feat(cleanup): remove orphaned encrypted files`
- `7c7c774 feat(ui): add safe local attachment previews`
- `4639c61 feat(attachments): reveal encrypted downloads safely`
- `46c2895 fix(db): enforce encrypted attachment contracts`
- `eceb804 feat(attachments): add encrypted upload flow`
- `6d4ba2f test(storage): audit Day 2 upload boundary`
- `43c0be0 feat(content): render markdown and code safely`
- `017c8a5 feat(crypto): add independent file encryption`
- `7f06515 docs(crypto): lock Day 3 envelope contracts`

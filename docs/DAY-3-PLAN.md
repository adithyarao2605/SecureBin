# Day 3 implementation plan: safe content and encrypted attachments

Status: **approved only after all Day 2 gates are green**

Audience: low-context implementation agents; locked formats must not be improvised

This plan also requires the production blocker in
[`PRODUCTION-INCIDENT.md`](PRODUCTION-INCIDENT.md) to be closed.

## Outcome and non-goals

Add locally decrypted plain text, Markdown, code, and one encrypted attachment without weakening the zero-knowledge boundary.

Do not add passwords, two-channel unlock, QR, Privacy Receipts, analytics, multiple files, public Storage, rich HTML, SVG/PDF preview, or server-side decrypted rendering.

## 1. Entry gate

Require documented Day 2 evidence: clean reset/pgTAP; exact 1/20 and 3/20 races; idempotent conflict handling; private upload reservation; reveal retry; recoverable cleanup; production create/status/reveal; full validation/a11y/reproducibility. Inspect `git status`; never edit `info/plan.md`.

## 2. Locked crypto context

One browser-only context per share:

```ts
type ShareCryptoContext = {
  publicId: string;
  linkSecret: string;
  deleteCapability: string;
  idempotencyKey: string;
  hkdfSalt: Uint8Array;
  factorMask: "link";
};
```

Content and file share public ID, salt, and factor mask but use independent keys and fresh random 12-byte nonces. Exact HKDF labels:

```text
securebin/v2/link/content
securebin/v2/link/file
```

Use Web Crypto HKDF and AES-256-GCM. AAD binds the exact version, public ID, object type, algorithm, KDF parameters, and factor mask from architecture. The content key must not decrypt the file and vice versa.

## 3. Locked payload formats

Envelope version 1 remains the legacy Day 1 plain-note format. Every newly created Day 3 payload, including Note, uses **content envelope version 2** and these exact plaintext bytes:

```text
4 bytes  ASCII magic `SBCT`
1 byte   payload version `0x01`
1 byte   mode: `0x00` note, `0x01` markdown, `0x02` code
1 byte   language ID
4 bytes  unsigned big-endian UTF-8 text length
N bytes  UTF-8 text, with no trailing bytes
```

Language ID must be `0` for note/Markdown. For code it is: `0` plaintext, `1` javascript, `2` typescript, `3` json, `4` python, `5` bash, `6` sql, `7` css, `8` html. Reject other version/mode/language values, length mismatch, trailing bytes, and invalid UTF-8.

Legacy detection uses the authenticated envelope version, never plaintext guessing. Version 1 decodes its entire plaintext as a legacy note even when it starts with `SBCT`; version 2 requires valid `SBCT` framing. Reject unknown versions before crypto. Record this version decision and v1/v2 golden vectors in architecture before code.

```ts
type ContentPayload =
  | { mode: "note"; text: string }
  | { mode: "markdown"; text: string }
  | { mode: "code"; text: string; language: CodeLanguage };
```

Mode/language never cross the server boundary. Envelope v2 plus the marker removes legacy ambiguity. Use only the fixed language IDs above and bound UTF-8 bytes.

File plaintext framing:

```text
uint32 big-endian filename UTF-8 length
uint16 big-endian MIME UTF-8 length
filename UTF-8
MIME UTF-8
original bytes
```

Locked limits (10 MiB refers to original file bytes, not the framed payload):

```text
MAX_FILE_PLAINTEXT_BYTES = 10_485_760
MAX_FILENAME_BYTES = 512
MAX_MIME_BYTES = 128
FILE_HEADER_BYTES = 6
GCM_TAG_BYTES = 16
MAX_FILE_CIPHERTEXT_SIZE = 10_486_422
```

Use fatal UTF-8 metadata decoding. Reject impossible/truncated lengths, invalid UTF-8, and exceeded bounds. Change TypeScript, SQL, bucket, tests, and docs together. Filename, MIME, mode, language, plaintext, and file bytes never reach the server plaintext.

The existing `10_485_776` TypeScript/SQL limit is intentionally replaced by `10_486_422` in a new migration and the matching implementation commit. Until all layers use the new value, exact-10-MiB original files are not accepted and Day 3 is not complete.

Version 2 content framing adds 11 plaintext bytes. Preserve the 512-KiB text limit by setting v2 authenticated ciphertext maximum to `524_315` bytes and its unpadded-base64url maximum to `699_087` characters. Keep v1 limits exactly `524_304` bytes and `699_072` characters. Update browser constants, `lib/shares/contracts.ts`, API body tests, and a new SQL validator migration together.

## 4. Architecture and vectors first

Update `docs/architecture.md`, `docs/threat-model.md`, and `docs/SECURITY.md` with canonical framing/legacy detection, HKDF/AAD/nonce rules, upload-create-reveal-cleanup sequence, visible/hidden metadata, renderer boundary, retries, and signed URL lifetimes.

Add deterministic test-only content and file golden vectors. Never use vector nonce generation in production.

Commit: `docs(crypto): lock Day 3 envelope contracts`

## 5. Shared crypto and codecs

Targets:

```text
lib/crypto/share-context.ts
lib/crypto/payload.ts
lib/crypto/file.ts
lib/crypto/content.ts
lib/crypto/envelope.ts
tests/unit/crypto.test.ts
```

Order:

1. extract context generation without breaking `sealContent/openContent`;
2. encode/decode structured content canonically;
3. encode/decode file frame with big-endian `DataView`;
4. derive keys by exact object type;
5. encrypt with distinct keys/nonces;
6. validate envelope before expensive crypto;
7. clear temporary mutable bytes where practical;
8. never use Node `Buffer` in browser modules.

Version-validation matrix:

| Envelope | Accept | Key label / payload |
| --- | --- | --- |
| v1 content | yes | existing v1 label and legacy whole-note plaintext |
| v1 file | no | files were not a shipped v1 browser format |
| v2 content | yes | v2 content label and required `SBCT` framing |
| v2 file | yes | v2 file label and required binary file framing |
| any other version | no | reject before crypto |

Update `lib/crypto/envelope.ts`, `lib/shares/contracts.ts`, reveal/viewer parsers, and a new replacement `securebin_valid_envelope` SQL function. Each version has an exact allowed field set, AAD, size bound, and HKDF label; never run v2 through the old v1 SQL branch.

Staged file transition:

1. Day 2 reservation tests deliberately use metadata-only v1 file fixtures because browser file encryption is not shipped yet.
2. Before any Day 3 upload, the Day 3 migration replaces reservation/share validators so newly reservable/attachable files are v2-only.
3. Assert no attached v1 file rows exist on the Day 2 release path; fail the migration with a clear precondition if they do. Delete expired unattached v1 test/reservation rows during the migration rather than converting cryptographic metadata.
4. Drop/revoke the Day 2 v1 file-validator function overloads and recreate the exact tuple-bound `create_upload_reservation(text, bytea, jsonb, bigint)` and 11-argument `create_share` definitions against v2 validation.
5. pgTAP proves v1 file rejection, v2 file acceptance, v1 content compatibility, v2 content acceptance, and absence of old overloads.

Tests: legacy, plain/Unicode/Markdown/code, invalid marker, arbitrary binary, Unicode filename, exact limits and +1 rejection, malformed lengths, invalid UTF-8, tamper, wrong secret, key separation, shared salt, distinct nonce, both golden vectors.

```bash
corepack pnpm test -- tests/unit/crypto.test.ts
corepack pnpm typecheck
```

Commit: `feat(crypto): add independent file encryption`

## 6. Safe Markdown and code

Candidate files:

```text
lib/render/markdown.ts
lib/render/code.ts
app/components/markdown-view.tsx
app/components/code-view.tsx
tests/unit/rendering.test.ts
```

Locked dependencies at the 2026-08-21 review are `react-markdown@10.1.0`, `remark-gfm@4.0.1`, and `lowlight@3.3.0`. Re-check official advisories before installation; if affected, stop instead of substituting silently. `react-markdown` creates React elements without raw HTML, `remark-gfm` supplies bounded GFM, and `lowlight` provides a local syntax AST. All run browser-side after decryption and load no CDN assets.

Markdown: parse after decrypt with `react-markdown`, `skipHtml`, a conservative `allowedElements` list, and a component override that drops `img`. Use its safe URL transform tightened to `https`, `http`, and `mailto`; external links use `noopener noreferrer`. Do not add `rehype-raw` and do not use `dangerouslySetInnerHTML`. Forbid SVG, style, iframe, object, embed, forms, handlers, and remote fetch.

Code: register only the eight fixed languages with `lowlight`; never auto-detect. Recursively convert its HAST to React. Accept only root, text, and `span` nodes whose only property is `className` and whose classes match `^hljs-[a-z0-9_-]+$`; any other node/property causes plaintext fallback. Never serialize the tree to HTML or use `dangerouslySetInnerHTML`.

Test scripts, handlers, javascript/data links, raw HTML, images, SVG, active embeds, malformed markup, and malicious highlighter output.

Commit: `feat(content): render markdown and code safely`

## 7. Audit the completed Day 2 upload boundary

Day 2 owns the reservation endpoint, Storage abstraction, signed upload operation, overwrite protection, and tuple-bound reservation. Day 3 uses that contract without recreating the route. Modify it only for a demonstrated bug or synchronized `10_486_422` limit. Locked request:

```json
{
  "publicId": "<future share ID>",
  "idempotencyKeyHash": "<future create digest>",
  "fileEnvelope": { "objectType": "file", "ciphertext": "<absent>", "...": "..." },
  "expectedCiphertextSize": 12345
}
```

Never accept filename, MIME, plaintext/ciphertext body, link/deletion secret, or attachment capability. Response contains only the short-lived signed Storage operation and expiry. The create request matches the stored public-ID/idempotency/envelope/size tuple and sends no reservation credential. Use private `securebin-files`, octet-stream, random content-free path, overwrite disabled, and secret-free logs.

Test exact keys, size/type bounds, explicit metadata rejection, upload rate limit, idempotency, expiry, overwrite disabled, octet-stream, redacted upstream failure, and logs.

Commit: `test(storage): audit Day 2 upload boundary`

## 8. Browser create flow

Update composer, contracts, share service, and share route. Exact order:

1. validate content/file/metadata UTF-8 and byte limits;
2. generate one context;
3. encode/encrypt content;
4. frame/encrypt file bytes and metadata;
5. calculate exact ciphertext size;
6. reserve using the future public ID, idempotency digest, metadata-only envelope, and size;
7. upload ciphertext as octet-stream without overwrite;
8. create share with content envelope, metadata-only file envelope, size, idempotency digest, and policy;
9. build fragment URL only after success.

On uncertainty retain the same context, idempotency key, envelopes, and ciphertext. User edit invalidates the prepared attempt. Never silently duplicate or upload plaintext fallback.

E2E request inspection must prove absence of draft text, filename/type, original bytes, link secret, deletion capability, and upload-reservation capability.

Commit: `feat(attachments): add encrypted upload flow`

## 9. Database attachment enforcement

Add a new migration; never modify deployed ones. Synchronize ciphertext bounds, bucket limit, metadata-only file envelope, object types, matching factor masks/salts, reservation existence/expiry/unattached state/size, actual `storage.objects.metadata.size`, and explicit grants.

Never trust declared size alone. Test expiry/reuse, missing object, mismatch, salt/mask mismatch, unknown fields, and concurrent single-reservation attachment.

```bash
corepack pnpm supabase:reset
corepack pnpm supabase:test
```

Commit: `fix(db): enforce encrypted attachment contracts`

## 10. Reveal and signed download

Strict authorized result:

```ts
type AuthorizedReveal = {
  status: "authorized";
  contentEnvelope: ContentEnvelope;
  file: null | { envelope: FileEnvelope; ciphertextSize: number; downloadUrl: string };
  retryExpiresAt: string;
};
```

Unavailable has no file metadata. Never return object paths.

Server: atomic reveal; uniform unavailable or validate fields; generate exactly 60-second download URL; return encrypted envelope/size/URL/retry expiry; same-token retry regenerates URL without increment.

Browser: retain token; strict JSON parse; fetch no-store; verify exact length; decrypt locally; parse frame; clear token only at a definite state. Any URL/download/parse/decrypt uncertainty retries with the same token.

Commit: `feat(attachments): reveal encrypted downloads safely`

## 11. Safe preview/download

Create `file-preview.tsx`, `file-safety.ts`, and tests.

Preview only PNG, JPEG, GIF, WebP after magic bytes, and plain text after fatal UTF-8. Never trust decrypted MIME alone. For an allowed image, create the local Blob with the safe type determined from verified magic bytes, not the supplied MIME. Everything else uses an `<a download>`/programmatic local-Blob download without navigating the current page. Never preview SVG, HTML, PDF, XML, Office, or unknown active content; never iframe/object/embed or navigate to Storage URL.

Use local Blob URLs and revoke them on replacement/unmount. Render text in `<pre>` text nodes. Sanitize decrypted filename by removing controls/path separators; fallback `download.bin`. Decide preview from verified bytes plus conservative local metadata, never infrastructure MIME.

Test signatures, MIME mismatch, disguised HTML/SVG, invalid UTF-8, filename traversal, and URL revocation.

Commit: `feat(ui): add safe local attachment previews`

## 12. Cleanup and recovery

Extend Day 2 cleanup: authenticate; list; validate paths; delete objects; treat missing as deleted; finalize only successes; preserve rows on failure; remain idempotent; protect active/attached objects. Deployment remains owner-operated.

Test failed upload, abandoned reservation, expired/revoked/active file, missing object, deletion failure, concurrent cleanup, and repeat runs.

Commit: `feat(cleanup): remove orphaned encrypted files`

## 13. Failure matrix

| Failure | Required behavior |
| --- | --- |
| Upload uncertain | retain prepared attempt; retry same reservation |
| Create uncertain after upload | retry same idempotency/reservation |
| Object size mismatch | reject attachment; cleanup later |
| Lost reveal response | retry same token |
| Signed URL expired | regenerate with same token |
| Download byte mismatch | do not decrypt/render; same-token retry |
| Auth/decrypt failure | render nothing; safe error |
| Markdown sanitizer failure | plaintext-safe fallback or error, never raw HTML |
| Preview mismatch | download fallback |
| Storage cleanup failure | retain DB row |

## 14. Evidence and final validation

Browser evidence: all content modes, binary attachment, image/text preview, download fallback, XSS corpus, masquerade rejection, request inspection, limits, upload recovery, same-token retry, mobile/keyboard/dark/reduced-motion/axe.

Crypto evidence: vectors, tamper, wrong secret, separation, nonce distinction, bounds, legacy. Database evidence: private access, actual size, reservation semantics, matching salt/mask, safe cleanup.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:integration
corepack pnpm supabase:reset
corepack pnpm supabase:test
corepack pnpm test:e2e
corepack pnpm test:a11y
corepack pnpm build
corepack pnpm validate
.venv/bin/python scripts/verify-reproducibility.py
git diff --check
```

Update architecture, threat model, security, README, deployment, SPEC links, and `info/HANDOFF.md`. Record dependency rationale, commits, migrations, evidence, owner actions, and deferred Day 4. Never edit `info/plan.md`.

## 15. Stop conditions

Stop if work would change envelope format without architecture/vectors, use different salts or nonce reuse, expose plaintext metadata/bytes/capability, add a reservation bearer credential, change size in one layer, use public/direct Storage or overwrite, trust declared size, return object path, discard retry token, render unsanitized HTML, preview active formats, trust MIME alone, import server credentials client-side, delete DB state before Storage, add unpinned dependency/manager, or start Day 4.

## 16. Commit sequence

```text
docs(crypto): lock Day 3 envelope contracts
feat(crypto): add independent file encryption
feat(content): render markdown and code safely
test(storage): audit Day 2 upload boundary
feat(attachments): add encrypted upload flow
fix(db): enforce encrypted attachment contracts
feat(attachments): reveal encrypted downloads safely
feat(ui): add safe local attachment previews
feat(cleanup): remove orphaned encrypted files
test(day3): prove attachment and renderer safety
```

# SecureBin: Implemented History & Capabilities

This document is the single consolidated record of all implemented features, cryptographic protocols, backend architecture, and UI systems in SecureBin.

---

## 1. Zero-Knowledge Cryptography & Key Management

- **Client-Side Web Crypto:** All encryption, decryption, key derivation, parcel packaging, and factor checks happen entirely inside the browser. Plaintext, keys, passwords, unlock codes, and capability tokens never cross the network.
- **Authenticated Ciphertext:** AES-256-GCM authenticated encryption with unique 12-byte nonces generated per object via `crypto.getRandomValues`. Nonces are never reused.
- **Domain-Separated HKDF Labels:** Derives independent sub-keys using HKDF-SHA-256:
  - Content payload key: `securebin/v2/link/content`
  - Attachment file key: `securebin/v2/link/file`
- **Multi-Factor Protection Masks:**
  - `link`: Base 128-bit key in URL fragment.
  - `link+password`: Fragment key combined with user password via PBKDF2-HMAC-SHA-256 (600,000 iterations, 16-byte random salt).
  - `link+unlock`: Fragment key combined with a 27-character base-28 second-channel unlock code (carrying 124 bits of entropy plus checksum).
  - `link+password+unlock`: All three independent factors required to reconstruct the root key.
- **SBPX Parcel Container (v1):** Secure offline container format for exporting and restoring encrypted parcels without revealing keys, passwords, or capabilities.
- **Decrypted Content Isolation:** Strict rendering boundaries:
  - Markdown parsed through DOMPurify with remote scripts, frames, and embeds stripped.
  - Code syntax rendered into isolated read-only views.
  - Attachment safe-previews with CSP protection and object URL revocation on unmount.

---

## 2. Backend & Database Architecture (Supabase PostgreSQL)

- **Atomic Database Functions:** State transitions and reveal counters are managed strictly via PostgreSQL functions with row-level locking (`FOR UPDATE`):
  - `create_share`: Validates envelopes, checks strict idempotency across policy/factors/envelopes, and persists metadata.
  - `reveal_share`: Atomically increments reveal counters, issues 5-minute retry leases, and returns ciphertext. Revocation and expiry immediately override active leases.
  - `revoke_share`: Marks shares revoked when verified against the 32-byte SHA-256 deletion token digest.
  - `get_share_status` & `get_share_status_batch`: Non-leaking metadata status checks returning uniform `unavailable` for expired, revoked, exhausted, or missing shares.
  - `consume_rate_limit`: Sliding-window rate limiter using HMAC-SHA-256 network discriminators (no raw IP storage).
  - `finalize_expired_securebin`: Cleans up expired/revoked shares and orphaned Storage attachments.
- **Upload Recovery & Multi-File Storage:**
  - Supports up to 5 files per share (10 MB each).
  - Upload reservations (`upload_reservations`) map slots 0–4 with SHA-256 idempotency digests.
  - Recovers from lost network responses without redundant file re-uploads.
- **Encrypted Discussions:**
  - Threaded comment system with parent-child hierarchy.
  - Validated by client-held SHA-256 discussion capability digests.
  - Client edit/delete proof tokens allow author edits and orphan-preserving deletions.
- **Calibrated Rate Limiting:**
  - 120 requests/minute for share creation, reveals, uploads, and comment postings.
  - 240 requests/minute for status reads and discussion fetches.

---

## 3. UI/UX & Visual System

- **Unified Quiet-Proof Design:**
  - Linen (`#F4F0E8`), Ink (`#17242D`), Mineral (`#2F7071`), Copper (`#B86848`), and Mist (`#DCE9E3`) token family.
  - Floating pill navigation header (`.site-header`) with monospace tracking.
  - Rounded pill action buttons (`.action-button`) with high-contrast active states.
  - Responsive 320px, 390px, tablet, and desktop layout scaling.
- **Default Dark Mode:** High-contrast OLED dark theme with zero-flash pre-hydration script and instant light/dark toggle.
- **Authoring Experience:**
  - Plain note, Markdown (edit/split/preview modes), and Code editor with automatic language detection.
  - Drag-and-drop attachment dropzone with file list, size badges, and deletion controls.
- **Flexible Access Policies:**
  - Availability: Immediate or Scheduled UTC start date/time.
  - Reveal Limits: Burn-after-reading (1 reveal), 3, 5, 10, custom (1–100), or unlimited.
  - Expiration: 24 hours, 7 days, 30 days, custom duration, or Never (indefinite until revoked).
  - Release Window: Automatic client auto-hide countdown (10s, 30s, 1m, 5m, custom) with Privacy Veil overlay.
- **Sender Tools:**
  - Privacy Receipt displaying cryptographic audit parameters and verification digests.
  - One-time second-channel unlock code display modal.
  - Share History Desk backed by `localStorage` with live status indicators, reveal counters, and manual revocation.

---

## 4. Verification & Testing Evidence

- **Unit Tests:** 191 unit tests passing via `vitest` covering crypto primitives, envelope codecs, policy parsers, and component flows.
- **Database Tests:** 155 pgTAP assertions passing against a clean Supabase migration reset.
- **Integration Tests:** 16 backend API and service-layer integration tests passing.
- **E2E Tests:** 19 Playwright end-to-end browser tests passing in Chromium across all user flows and production builds.
- **Accessibility:** 7 Axe accessibility checks passing with 0 critical or serious violations (WCAG 2.1 AA compliant).
- **Security & Reproducibility Audits:** `verify-reproducibility.py` and `source-audit.mjs` pass cleanly with zero secret diagnostics.

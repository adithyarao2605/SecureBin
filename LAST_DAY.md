# LAST_DAY: Release Freeze, Final Verification & Demo Rehearsal

This document outlines the final remaining tasks, verification gates, and owner actions required for Day 7 release freeze and submission.

---

## 1. Fresh-Clone Verification Gate
- [ ] Perform a clean checkout verification in an isolated temporary directory:
  ```bash
  corepack enable
  corepack install
  pnpm install --frozen-lockfile
  python3 -m venv .venv
  .venv/bin/python scripts/verify-reproducibility.py
  pnpm validate
  pnpm test:integration
  pnpm supabase:test
  pnpm exec playwright install chromium
  pnpm test:e2e
  pnpm test:e2e:prod
  pnpm test:a11y
  ```
- [ ] Prove zero uncommitted files, unrecorded global packages, or broken lockfile hashes.

---

## 2. Production Smoke Matrix (Owner-Operated)
- [ ] Apply remote database migrations (`20260901000000_pre_freeze_lifecycle_uploads.sql`) on hosted Supabase.
- [ ] Verify production deployment across all permutations:
  - Plain note, Markdown (edit/split/preview), and Code sharing.
  - Password protection, Two-channel unlock code, and Combined factors.
  - Scheduled start time, Custom expiry, and Never expiry.
  - Reveal limits: 1 (burn), 3, 5, 10, custom, and unlimited.
  - Multi-file attachments (up to 5 files) & encrypted ZIP download.
  - Encrypted threaded discussion comments, edits, and deletions.
  - Release window countdown and automatic Privacy Veil auto-hide.
  - Manual deletion / share revocation with local deletion tokens.
  - SBPX parcel v1 export and offline restore.
  - Direct and hard-refreshed share URLs (`/s/[publicId]#key`).

---

## 3. Concurrency & Fault Tolerance Evidence
- [ ] Run 100 concurrent reveal attempts against a 1-reveal share (record proof of exactly 1 authorized lease in `docs/evidence.md`).
- [ ] Run 100 concurrent reveal attempts against a 3-reveal share (record proof of exactly 3 authorized leases).
- [ ] Verify lost-response retry token reuse without consuming additional reveal limits.
- [ ] Verify race conditions: reveal vs. expiry, reveal vs. revoke, attachment cleanup retry.

---

## 4. Judge-First README & Rubric Mapping Table
- [ ] Enhance [`README.md`](README.md) with an explicit CloneFest 2.0 Rubric Evidence Table mapping each judging criterion directly to:
  - Cryptographic design & Web Crypto implementation files.
  - Atomic database functions & PostgreSQL migrations.
  - Unit, integration, E2E, accessibility, and pgTAP test suites.
  - Architecture, deployment, and security specification documents.

---

## 5. Demo Video Script & Rehearsal (60–90 Seconds)
- [ ] Rehearse and record the judge presentation flow:
  1. **Composer (0–20s):** Draft a sensitive note, attach a file, add password + second-channel unlock, set a 30s release window, and click "Create share".
  2. **Receipt & Proof (20–35s):** Inspect the Privacy Receipt, show that the link alone cannot unlock the share without the second channel.
  3. **Reveal & Decrypt (35–55s):** Provide both factors, demonstrate browser-side decryption, view the attached file preview, and watch the release-window countdown trigger the Privacy Veil.
  4. **Revoke & Failure States (55–75s):** Revoke the share from the History Desk, attempt a fresh reveal, and show the uniform `unavailable` error state.
  5. **Integrity & Honest Boundaries (75–90s):** Highlight non-negotiable zero-knowledge invariants, atomic database guarantees, and honest threat-model boundaries.

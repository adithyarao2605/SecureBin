# Delivery History & Completed Capabilities

The detailed implemented-feature record is in **[`implemented-history.md`](implemented-history.md)**. Current validation evidence lives in [`../evidence.md`](../evidence.md), not in this historical archive.

- **Cryptography & Security:** Zero-knowledge Web Crypto, AES-256-GCM, HKDF key derivation, PBKDF2 password hashing, 27-character base-28 second-channel unlock codes, SBPX parcel v1 container, and sanitized render boundaries.
- **Backend & Database:** Atomic PostgreSQL RPCs (`create_share`, `reveal_share`, `revoke_share`), 5-minute retry leases, multi-file attachments (slots 0–4), encrypted threaded discussions, and calibrated rate limiting.
- **UI & Experience:** Unified quiet-proof design system, default OLED dark theme with light theme toggle, plain/markdown/code editors, scheduled start, custom/never expiry, release-window countdown with privacy veil auto-hide, Privacy Receipt, and Share History Desk.
- **Production Incident Record:** The resolved 2026-08-21 create failure investigation is recorded in [`PRODUCTION-INCIDENT.md`](PRODUCTION-INCIDENT.md).

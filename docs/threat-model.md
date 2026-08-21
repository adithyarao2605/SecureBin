# SecureBin threat model

This document turns the protocol in [`architecture.md`](architecture.md)
into an operational security boundary. It describes what the judged release
protects, what it intentionally exposes, and what it cannot protect.

The implemented evidence currently covers the Day 1 encrypted plain-text
slice. Later factors, files, richer renderers, cleanup scheduling, and a live
production host remain unverified scope even where this threat model defines
their required controls.

The active failure is tracked in
[`PRODUCTION-INCIDENT.md`](PRODUCTION-INCIDENT.md). Temporary diagnostics may
record envelope shape and lengths only—never values, ciphertext, plaintext,
capabilities, or credentials.

## Security objectives

1. Infrastructure must not learn plaintext content, filenames, plaintext MIME
   types, passwords, unlock codes, URL-fragment secrets, or raw deletion
   capabilities.
2. Only the browser performs key generation, derivation, encryption,
   decryption, QR generation, and decrypted rendering.
3. Availability, expiry, revocation, and reveal limits are enforced atomically
   by the server over ciphertext.
4. Decrypted text and Markdown cross an explicit safe rendering boundary.
5. Recipient-facing failures do not reveal whether a share is missing, expired,
   exhausted, or revoked.

## UX as a security boundary

The interface uses the quiet-proof direction documented in
[`docs/SPEC.md`](SPEC.md#experience-direction--quiet-proof) to make the real
boundary understandable without security theatre. Its proofline and receipt
are explanatory browser UI, never cryptographic evidence. A “sealed” label is
shown only after the local operation reports success; a visual accent cannot
authorize a reveal or claim deletion.

Security-relevant states use plain text and semantic structure in addition to
color, shape, or motion. The recipient-facing `Unavailable` copy remains
uniform across missing, expired, exhausted, and revoked records. Secret routes
use only bundled/self-hosted assets so an aesthetic dependency cannot add a
third-party observation channel.

## Actors and trust assumptions

| Actor | Trust assumption | Security consequence |
| --- | --- | --- |
| Sender browser | Trusted for the session, with a supported Web Crypto implementation | It can encrypt and display secrets, but malicious extensions or a compromised device can read them. |
| Recipient browser | Trusted for the session | It can decrypt and render, but cannot make plaintext remain secret after display. |
| Application server | Honest-but-curious for content; trusted to enforce policy | It may enforce lifecycle rules but must never receive client-only factors. |
| Database and Storage | Honest-but-curious infrastructure | Records are ciphertext plus bounded policy/operational metadata. |
| Network/hosting logs | Outside the content trust boundary | IPs, timing, sizes, and access patterns may remain visible. |
| Attacker | Can send malformed requests, enumerate IDs, race reveals, or inspect public artifacts | Strict schemas, rate limits, atomic RPCs, and uniform failures reduce impact. |

## Protected assets and residual metadata

Protected assets include plaintext, content/file keys, passwords, unlock codes,
fragment secrets, deletion capabilities, plaintext filenames and MIME types,
and unreleased client drafts. Infrastructure may retain ciphertext, opaque
public IDs, reveal/policy fields needed for enforcement, ciphertext sizes,
timestamps, request IDs, coarse size buckets, and network/access metadata.

The threat model does not promise traffic-analysis resistance, sender/recipient
anonymity, or deletion of content that was already decrypted or downloaded.

## Threats and controls

| Threat | Control | Remaining risk |
| --- | --- | --- |
| Server or database reads content | Browser AES-256-GCM; keys/factors never cross the API boundary | A malicious application deployment can exfiltrate browser secrets. |
| Nonce reuse or envelope confusion | Random per-object 96-bit nonces, versioned envelopes, fixed HKDF labels, strict pre-crypto validation, golden vectors | Correctness depends on Web Crypto and reviewed wrappers. |
| Link alone decrypts a two-channel share | Independent unlock secret is included in HKDF input and never uploaded | An attacker with both channels can decrypt; this is a two-channel workflow, not threshold cryptography. |
| Password brute force | Browser PBKDF2 with fixed bounded parameters and optional password factor | Password strength still matters if ciphertext and link secret are obtained. |
| Reveal-limit race | Database transaction locks and updates the share plus lease atomically | A successful release can still be copied after authorization. |
| Lost reveal response | Client-generated request token and five-minute idempotent lease | A token lost before the request cannot be recovered. |
| ID enumeration | Opaque random public IDs, rate limits, and uniform unavailable state | Timing and aggregate access patterns may still leak information. |
| XSS through decrypted Markdown or files | Strict sanitizer/plain-text boundary; no inline SVG/HTML/active documents; no remote media on secret routes | Browser extensions and compromised devices remain out of scope. |
| Secret leakage in logs | Structured redacted logs; no fragments, tokens, plaintext, filenames, MIME types, or ciphertext bodies | Provider-level operational metadata remains visible. |
| Unauthorized Storage access | Private bucket, random paths, signed short-lived operations, server-side size checks, RLS | A signed URL is usable until its short expiry. |
| Credential exposure | Server-only environment variables; public variables explicitly prefixed; no secrets in client imports | Misconfigured hosting or dependency supply-chain compromise can bypass boundaries. |

## Out of scope for the judged release

SecureBin does not provide endpoint malware protection, trusted hardware,
perfect sender anonymity, DRM, deniable storage, traffic-analysis resistance,
or recovery after a recipient has copied plaintext. Recipient-bound identities,
passkeys, encrypted rooms, padding, and independent cryptographic review are
roadmap work and must not be presented as implemented.

## Verification evidence

Security-sensitive changes require the smallest applicable regression suite and
then the full validation gate before handoff: crypto tamper/wrong-factor and
nonce tests; database RLS, idempotency, expiry, revocation, cleanup, and
concurrency tests; browser keyboard/accessibility and safe-rendering checks;
and a fresh-clone smoke test. See the required verification section of
[`architecture.md`](architecture.md).

For a maintainer or friend handoff, use provider team access and the procedure
in [`deployment.md`](deployment.md). Do not transmit environment files,
service-role credentials, secret share URLs, passwords, unlock codes, or
deletion capabilities as part of review evidence.

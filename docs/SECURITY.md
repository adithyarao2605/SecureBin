# Security policy

SecureBin is designed as a zero-knowledge sharing service: content and key
material are handled in the browser, while the service enforces lifecycle
policy over ciphertext. This is a security design target, not a claim that an
unreviewed deployment is production-safe.

## Reporting a vulnerability

Please do not open a public issue containing an exploit, secret URL, password,
unlock code, deletion capability, token, or user data. Use a private GitHub
Security Advisory when that feature is enabled for the repository. If it is not
available, contact the repository maintainers privately through the account
that owns the repository and include “SecureBin security report” in the subject.

Reports should include the affected commit or deployment, reproduction steps,
impact, and a minimal proof of concept. Redact all real secrets and personal
data. We will acknowledge a report when reviewed, coordinate a fix, and credit
the reporter when they want attribution.

## Security boundaries

- The URL fragment, passwords, unlock codes, raw deletion capabilities, and
  plaintext remain client-side secrets.
- The server may see opaque IDs, ciphertext, policy metadata, sizes, timing,
  access patterns, and network metadata.
- A compromised deployment can ship JavaScript that reads plaintext or keys;
  zero-knowledge storage cannot defend against that browser-runtime attack.
- A recipient can copy decrypted content, screenshot it, or retain ciphertext
  already released. Reveal limits are server authorization limits, not DRM.

The complete threat model and mitigations are in
[`docs/threat-model.md`](docs/threat-model.md). The protocol and data contracts
are in [`architecture.md`](architecture.md).

## Supported security expectations

Changes that affect cryptography, envelope fields, lifecycle counters, RLS,
Storage access, logging, or decrypted rendering require regression tests and a
documentation update. Never add plaintext or secret material to telemetry,
error messages, fixtures, screenshots, or CI output.

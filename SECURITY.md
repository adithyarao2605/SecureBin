# Security policy

SecureBin is a browser-encrypted sharing project. Security reports are
welcome, especially reports involving plaintext crossing the browser/server
boundary, lifecycle authorization, cryptographic envelope validation, unsafe
rendering, or direct anonymous access to private data.

## Reporting a vulnerability

Please do not publish an exploit, secret URL, password, unlock code, deletion
capability, or private fixture in a public issue. Use GitHub's private
vulnerability reporting channel for this repository when it is available. If
that channel is unavailable, open a minimal public issue asking the
maintainers for a private reporting path without including sensitive details.

Include, when safe:

- the affected commit, route, or deployment;
- clear reproduction steps using synthetic content only;
- the security impact and any likely prerequisites; and
- a suggested mitigation or regression test, if known.

The maintainers will acknowledge valid reports as soon as practical and will
coordinate disclosure after a fix or mitigation is available. Do not expect
the hosted competition deployment to provide a guaranteed response time.

## Scope and honest limits

The project is designed so that encryption, decryption, and decrypted
rendering happen in the browser. That design does not protect a device with
malware or a compromised browser extension, and it cannot erase plaintext or
encrypted files that a recipient has already copied or downloaded.

Self-hosted deployments, infrastructure configuration, dependencies, and
third-party integrations may introduce risks outside this repository. The
MIT-licensed software is provided without warranty; operators are responsible
for reviewing and securing their own deployment.

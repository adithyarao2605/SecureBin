# SecureBin architecture diagrams

These diagrams are intentionally standalone so a judge can understand the
trust boundaries without reading implementation code. They describe the
versioned protocol in [`architecture.md`](architecture.md); a diagram is not
evidence that an unimplemented component has shipped.

## Current implementation coverage

The Day 1–3 surface is implemented and tested: browser-encrypted text plus
Markdown/code modes with SBCT v2 framing, single-file encrypted attachments
through private Storage (reservation, signed upload, size verification, signed
60-second reveal download, safe local preview), scheduled cleanup of expired
shares, abandoned reservations, and rotated upload paths. The production host
has the forward migrations applied and live create/status/reveal were verified;
see [`PRODUCTION-INCIDENT.md`](PRODUCTION-INCIDENT.md) for the closed incident
record.

## System context and data boundary

```mermaid
flowchart LR
  S[Sender browser\nplaintext + factors] -->|encrypted envelope + policy| A[Next.js API]
  R[Recipient browser\nfragment + optional code] -->|status / reveal token| A
  S -->|encrypted file bytes| ST[(Private Storage)]
  A -->|atomic lifecycle RPC| DB[(Supabase Postgres)]
  A -->|signed operation| ST
  C[Hourly cleanup] --> DB
  C --> ST
  S -. never sends keys/plaintext .-> A
  R -. decrypts and renders locally .-> R
```

The fragment secret never becomes an HTTP request field. The API sees only the
public ID, ciphertext/envelope data, and the minimum policy metadata required
to enforce availability and reveal authorization.

The UI explains this boundary with a restrained proofline: browser → sealed
parcel → recipient. In the diagrams below that visual language is explanatory
only; it is not a protocol message, a cryptographic proof, or evidence that a
reveal was successfully decrypted. The actual boundary remains the one shown
by the solid and dotted data-flow arrows.

## Create and reveal sequence

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as API
  participant D as Atomic database function
  participant S as Private Storage
  B->>B: Generate ID, link secret, factors, nonce, envelope
  opt Encrypted attachment
    B->>A: Reserve random object path
    A->>D: Store reservation digest and size
    A-->>B: Signed upload operation
    B->>S: Upload encrypted bytes
  end
  B->>A: Create share with ciphertext and policy
  A->>D: Validate and insert idempotently
  A-->>B: Public ID and normalized policy
  B->>A: Status, then explicit reveal confirmation
  A->>D: Lock, validate lifecycle, create/reuse reveal lease
  D-->>A: Ciphertext and optional object path
  A-->>B: Ciphertext and short-lived file operation
  B->>B: Derive, authenticate, decrypt, sanitize/render
```

## Trust boundaries

```mermaid
flowchart TB
  subgraph Browser[Browser trust boundary]
    P[Plaintext]
    K[Link/password/unlock factors]
    W[Web Crypto + safe renderer]
    P --> W
    K --> W
  end
  subgraph Service[Infrastructure boundary]
    API[Strict API schemas]
    DB[Policy metadata + ciphertext]
    API --> DB
  end
  W -->|ciphertext and redacted policy only| API
  API -. no plaintext/factors .- W
```

The rendered product keeps this boundary legible with plain status copy and
accessible structure. It uses a light-first, warm evidence-desk visual system
with bundled fonts and no remote assets on secret routes; it does not use
terminal, matrix, neon, or shield/lock motifs as a substitute for security
evidence.

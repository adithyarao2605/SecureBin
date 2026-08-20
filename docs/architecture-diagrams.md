# SecureBin architecture diagrams

These diagrams are intentionally standalone so a judge can understand the
trust boundaries without reading implementation code. They describe the
versioned protocol in [`architecture.md`](architecture.md); a diagram is not
evidence that an unimplemented component has shipped.

## System context and data boundary

```mermaid
flowchart LR
  S[Sender browser\nplaintext + factors] -->|encrypted envelope + policy| A[Next.js API]
  R[Recipient browser\nfragment + optional code] -->|status / reveal token| A
  S -->|encrypted file bytes| ST[(Private Storage)]
  A -->|atomic lifecycle RPC| DB[(Supabase Postgres)]
  A -->|short-lived signed operation| ST
  C[Hourly cleanup] --> DB
  C --> ST
  S -. never sends keys/plaintext .-> A
  R -. decrypts and renders locally .-> R
```

The fragment secret never becomes an HTTP request field. The API sees only the
public ID, ciphertext/envelope data, and the minimum policy metadata required
to enforce availability and reveal authorization.

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

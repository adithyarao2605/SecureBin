# SecureBin policy state

The lifecycle state is enforced server-side in a transaction. The public
recipient API deliberately collapses missing, expired, exhausted, and revoked
records into `unavailable`. `reveal_count` changes only through the atomic
reveal function; a retry with the same active request token reuses its lease.

```mermaid
stateDiagram-v2
  [*] --> Scheduled: available_at is in the future
  [*] --> Active: available_at is absent or reached
  Scheduled --> Active: availability time reached
  Scheduled --> Unavailable: expiry or revocation
  Active --> Active: authorized reveal below limit
  Active --> Unavailable: final reveal authorized
  Active --> Unavailable: expiry or revocation
  Unavailable --> Unavailable: all recipient-facing requests
```

## Transition rules

| Transition | Authoritative check | Observable recipient state |
| --- | --- | --- |
| create → scheduled/active | Valid envelope, policy, timestamps, capability digests, and idempotency key | Share URL and safe policy summary |
| scheduled → active | Current UTC time is at or after `available_at` | `active` |
| active → active | Reveal lease exists, or remaining count is positive/unlimited | Ciphertext release (after confirmation for limited shares) |
| active → unavailable | Expired, revoked, or final reveal lease committed | `unavailable` |
| any lookup → unavailable | Missing, expired, exhausted, or revoked | Same `unavailable` response |
| delete → unavailable | Valid deletion capability atomically sets `revoked_at` | Same `unavailable` response |

The server authorizes a ciphertext release, not successful decryption or human
viewing. A response that is lost can be retried with its same request token
within the lease window without consuming another reveal.

## Current evidence boundary

The Day 2 concurrency matrix and lifecycle policies are **fully verified**:
- 20 concurrent requests on a `max_reveals = 1` share: exactly 1 authorized (winner lease), 19 uniform `unavailable`.
- 20 concurrent requests on a `max_reveals = 3` share: exactly 3 authorized, 17 uniform `unavailable`.
- Same-token retry within the 5-minute lease window successfully re-authorizes without incrementing the reveal counter.
- Concurrent reveal vs. revoke settled safely with subsequent requests returning uniform `unavailable`.
- Real `anon` and `authenticated` PostgreSQL roles confirmed denied direct access to all tables, Storage bucket objects, and lifecycle RPCs via 54 pgTAP tests.
- Custom expiration (between 1 hour and 30 days) is validated across client, API schemas, and Postgres constraints.

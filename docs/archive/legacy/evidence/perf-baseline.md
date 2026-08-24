# Performance baseline

Recorded: 2026-08-24, local dev server (`next dev`), Chromium via
`scripts/measure-perf.mjs`, mobile viewport 390×844. Re-run the script to
refresh these numbers; treat significant regressions as a gate failure.

## Mobile LCP

| Route | LCP (cold compile) | LCP (warm) |
|-------|--------------------|------------|
| `/`   | 1348 ms            | 168 ms     |
| `/new`| 3100 ms            | 528 ms     |

Cold numbers include one-time Next.js dev compilation and are not
representative of production. Warm numbers are the meaningful signal: both
routes are far under the 2.5 s "good" LCP threshold.

## Bundle size (`pnpm build` output)

- Shared first-load JS: ~102 kB.
- `/new`: 11.7 kB route + 166 kB total first load.
- `/s/[publicId]`: 55.2 kB route + 210 kB total first load (viewer carries the
  crypto + rendering boundary).
- Middleware: 34.6 kB.

## Large-file encryption: Worker decision

Measured AES-256-GCM encryption throughput in the target browser:
**~188 MiB/s** using exactly the primitive our wrappers call
(`crypto.subtle.encrypt`).

Largest permitted attachment plaintext is 10 MB ⇒ worst case ≈ 55 ms per file,
≈ 275 ms for a full five-file share, all on the main thread. That is below
human-perceptible latency for this interaction, so **the Worker offload is
deferred**. Revisit only if attachment limits grow by an order of magnitude or
real-device profiles show long-task jank during create.

# Day 7 implementation plan: freeze, validation, evidence, demo, submission

Status: **gated — do not start until the Day 6 exit gate is green**

Audience: low-context implementation agents. Scope source: `info/plan_v2.md`
§6. Day 7 adds **no new product capability**; unfinished required work is
stabilized first.

## Outcome and non-goals

A frozen, judge-ready release: verified from a fresh clone, production smoke
matrix complete, hero reliability evidence captured, security audit passed,
repository cleaned, judge-first README and rubric evidence table finished, demo
rehearsed.

Do not start new features, dependencies, UI experiments, architecture
rewrites, or unmeasured optimizations. Stretch work only if everything
required is already green.

## 1. Fresh-clone verification

From a clean checkout: `corepack enable` → `pnpm install --frozen-lockfile` →
`pnpm validate` → self-host commands from `docs/DAY-6-PLAN.md` → smoke create/
reveal/file/discussion/revoke locally.

## 2. Production smoke matrix

Real deployment, recorded in `info/HANDOFF.md`: plain text; Markdown; code;
password; two-channel; combined factors; scheduled; custom expiry; Never;
1/3/5/10/custom/unlimited reveals; multi-file; previews; discussions; reveal
window; revoke; parcel export/import; direct and hard-refreshed share URLs;
header/UI assets on cold load.

## 3. Hero concurrency/fault evidence (saved to `docs/evidence/`)

- 100 concurrent reveals on a 1-reveal share → exactly 1 authorized.
- 100 concurrent on a 3-reveal share → exactly 3.
- Lost-response retry with same token → no second consumption.
- Reveal-vs-expiry and reveal-vs-revoke races; signed-URL retry; discussion
  lifecycle edges.

## 4. Security audit checklist

CSP; HSTS; no-store; nosniff; frame denial; referrer/permissions policies;
RLS; Storage privacy; service-role exposure; strict schemas; oversized/
malformed fields; Markdown/filename/discussion XSS; unsafe preview formats;
log leakage; analytics leakage; cache behavior; local/session storage; parcel
parser validation. Findings fixed or explicitly accepted in HANDOFF.

## 5. Browser/mobile/accessibility/performance

Chromium full flow; Firefox smoke; WebKit if practical. Mobile 320/390px on
View Share, Markdown, code, attachments, discussions, receipt, reveal window —
no horizontal overflow. Keyboard-only create/reveal; visible focus; labels;
error association; confirm dialogs announce and move focus; Axe critical = 0
(serious reviewed); reduced motion. Production LCP target <2.5s mobile where
practical; bundle/Markdown/highlighter/QR loading measured; Worker only if
measurements demand it.

## 6. Repository cleanup

- PrivateBin reference checkout out of the judge-facing tree (gitignored +
  short `REFERENCES.md` note on independence).
- Archive stale planning/incident docs under `docs/archive/` so judges cannot
  mistake history for open problems.
- Git tracks no `node_modules/`, `test-results/`, `*.tsbuildinfo`, local
  Supabase state, secrets, decrypted fixtures, or temp build output.
- Curated evidence under `docs/evidence/`.

## 7. Code cleanup

Split real responsibilities only where files became mixed-concern (composer,
viewer, drop zone, attachment list, receipt, discussion thread, local
manager). No splits for file-count optics.

## 8. Judge-first README + rubric evidence table

README answers, in order: what/why/different/demo/security model/what server
sees/reveal enforcement/local run/evidence/limitations. Add the rubric evidence
table mapping every criterion to docs, tests, and evidence files.

## 9. Demo script + submission

Rehearse the 60–90s flow from `info/plan_v2.md` §6.13 (trim to fit time).
Before submit: live URL green; repo clean; no secrets; screenshots current;
every claimed feature exists; submit with deadline buffer.

## Stop conditions

Stop for review if anything would unfreeze scope, weaken a security control to
pass a check, or represent unimplemented work as shipped.

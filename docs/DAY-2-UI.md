# Day 2 UI specification: quiet proof

Status: **approved Day 2 design contract**

Design Source: **Stitch MCP Project: `SecureBin Quiet Proof Design System v1`** (`projects/12991627127209989717`)

Implementation plan: [`DAY-2-PLAN.md`](DAY-2-PLAN.md)

## Product idea

SecureBin is a calm evidence desk, not a security dashboard. Use one writing/reveal surface and one narrow evidence rail. The signature is a restrained proofline:

```text
Browser  ─────────  Sealed parcel  ─────────  Recipient
local                 policy                    link
```

It explains the path; it never proves encryption, authorization, deletion, recipient identity, delivery, or reading.

## 1. Visual system

Light tokens:

```css
--linen: #F4F0E8;
--ink: #17242D;
--deep-slate: #2D4148;
--mineral: #2F7071;
--copper: #B86848;
--mist: #DCE9E3;
--line: color-mix(in srgb, var(--ink) 18%, transparent);
--muted-ink: color-mix(in srgb, var(--ink) 64%, transparent);
```

Dark tokens:

```css
--linen: #11242A;
--ink: #ECF1EB;
--deep-slate: #D4E0DB;
--mineral: #79B8B0;
--copper: #D58A6B;
--mist: #244047;
--line: color-mix(in srgb, var(--ink) 22%, transparent);
```

Status always combines shape and words: Mineral circle + Local draft; Copper square + Scheduled; Mineral square + Ready; outlined square + pending text; Copper outline + Unavailable/error. Never rely on color.

Forbidden: neon, matrix effects, terminal panels, cyberpunk grids, threat meters, shields, locks, glowing borders, or safety scores.

Typography roles:

- display: local Bricolage Grotesque or `ui-rounded, "Arial Rounded MT Bold", sans-serif`;
- body/control: local Atkinson Hyperlegible or `ui-sans-serif, system-ui, sans-serif`;
- receipt/data: local IBM Plex Mono or `ui-monospace, "SFMono-Regular", Consolas, monospace`.

Never fetch fonts remotely. If licensed local assets are absent, use fallbacks. Avoid the current italic serif hero.

Geometry: `1180px` maximum, rail `minmax(240px,.72fr)`, surface `minmax(0,1.8fr)`, `20–56px` gap, `24px` surface radius (`16px` mobile), `44px` minimum controls, one-pixel lines, one restrained surface shadow, no nested card grid.

## 2. Layouts

Desktop:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ SecureBin / private by design                How it works    Theme  │
│ Browser ───────── parcel ───────── recipient                        │
│ ┌── EVIDENCE RAIL ───────────┐  ┌── PRIMARY SURFACE ─────────────┐ │
│ │ Access policy              │  │ Create a private share         │ │
│ │ Available now              │  │ browser-boundary sentence      │ │
│ │ Expires in 24 hours        │  │ [Note][unavailable modes]      │ │
│ │ Unlimited reveals          │  │ textarea                       │ │
│ │ Browser boundary           │  │ policy controls                │ │
│ │ browser encrypts first     │  │                 [Create share]│ │
│ └────────────────────────────┘  └───────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

Mobile:

```text
┌──────────────────────────────┐
│ SecureBin              Theme │
│ Browser ─ parcel ─ recipient │
│ ● Local draft                │
├──────────────────────────────┤
│ Create a private share       │
│ trust-boundary sentence      │
│ mode / textarea              │
│ availability / expiry        │
│ reveal limit                 │
│ [Create share]               │
└──────────────────────────────┘
```

At 900px collapse the rail into a status strip. At 640px stack controls and make the primary action full width. DOM order must match keyboard/reading order.

## 3. Component plan

```text
app/components/proofline.tsx
app/components/evidence-rail.tsx
app/components/policy-controls.tsx
app/components/composer.tsx
app/s/[publicId]/viewer.tsx
lib/shares/policy-ui.ts
```

`policy-ui.ts` is pure/browser-safe and owns preset mapping, local-to-UTC conversion, validation, and summaries.

```ts
type ProoflinePhase = "draft" | "creating" | "created" | "scheduled" |
  "ready" | "revealing" | "opened" | "unavailable";

type PolicyDraft = {
  availability: "now" | "scheduled";
  availableLocalDate: string;
  availableLocalTime: string;
  expiryPreset: "24h" | "7d" | "30d" | "custom";
  customExpiryValue?: number;
  customExpiryUnit?: "hours" | "days";
  maxReveals: 1 | 3 | 5 | 10 | null;
};
```

Proofline shapes/rules are decorative and `aria-hidden`; phase copy is real text.

## 4. Composer

Exact copy:

| Element | Copy |
| --- | --- |
| Heading | `Create a private share` |
| Trust line | `Your browser encrypts this before it leaves the page.` |
| Empty | `Write a note before creating a share.` |
| Pending | `Creating share…` |
| Action | `Create share` |
| Success | `Share created` |
| Failure | `This share could not be created. Your draft is still only on this device.` |

Replace “Seal this draft” and meta words such as artifacts/handoffs.

Only Note is active on Day 2. Markdown and Code remain truly disabled/unfocusable. Use a native radio group or correct tab/tabpanel semantics; do not retain an incomplete tablist.

Draft rules: enforce UTF-8 bytes, keep plaintext only in component memory, never local/session storage or URL/logs, retain after recoverable failure, prevent duplicate pending submit, and do not imply JS characters equal bytes.

Keep a `PreparedCreateAttempt` in component state/ref after encryption: envelope, public ID, link secret, deletion capability, idempotency material, and exact payload. Timeout, lost response, `503`, and malformed success reuse it unchanged. Definite success clears it after link construction. User content/policy edits invalidate it. Never rerun `sealContent()` merely because Retry was pressed.

### Availability

Legend: `When can this share be opened?`

- `Available now` default;
- `Schedule availability` reveals `Available on` date and `Available at` time;
- hint: `Shown in your local time; stored as UTC.`;
- prevent selection of a clearly past value and reject availability at/after expiry; the server accepts a timestamp that becomes past in transit and treats it as active;
- never show a countdown.

### Expiry

Label `Expires after`: `24 hours` default, `7 days`, `30 days`. No never-expire. Convert to UTC on submit and show final localized times in the policy preview. Expiry is calculated from creation time unless architecture explicitly changes it.

### Reveal limit

Legend: `How many times can the ciphertext be released?`

```text
Once — burn after opening -> 1
3 reveals -> 3
5 reveals -> 5
10 reveals -> 10
Unlimited -> null
```

Helper: `A reveal authorizes one ciphertext release. It does not know whether the recipient read it.` Never say self-destruct after reading.

### Result and revoke

```text
Share created
<wrapped full link>
[Copy link] [Revoke share]
The key stays in the link fragment. Keep the full link.
```

Implement Copy link only if tested; otherwise keep an accessible selectable link. The raw deletion capability stays in component memory and never appears in DOM, URL, automatic clipboard, logs, or errors. Refresh/navigation intentionally loses the revoke action because Day 2 does not persist owner secrets.

Confirmation: `Stop future reveals? This cannot remove content already opened or downloaded.` Actions: `Cancel`, `Revoke share`. Success: `Share revoked. Future reveals are unavailable.` Failure: `The share could not be revoked. Try again.` Focus result/confirmation headings.

## 5. Evidence rail

Order: proofline, `Access policy`, `Browser boundary`.

```text
Access policy
Available now
Expires tomorrow at 14:30
One reveal

Browser boundary
Your browser encrypts this before it leaves the page.
The service stores a sealed parcel and limited policy metadata.
```

Before creation this is a preview, not authority. Never say Verified, Guaranteed, Unhackable, or use a score.

## 6. Viewer state machine

| State | Copy | Action |
| --- | --- | --- |
| Checking | `Checking this share…` | none |
| Incomplete fragment | `This link is incomplete. Ask the sender for the full link.` | none |
| Network failure | `We could not check this share.` | `Try again` |
| Scheduled | `This share becomes available <localized time>.` | none |
| Ready unlimited | `Ready to reveal` | `Reveal` |
| Ready limited | `This authorizes one ciphertext release.` | `Reveal once` |
| Confirming | `Continue? This cannot restore the consumed authorization.` | `Cancel`, `Continue` |
| Pending | `Authorizing one reveal…` | disabled |
| Opened | `Opened locally. The server released ciphertext; this browser did the decryption.` | none |
| Unavailable | `This share is no longer available. Ask the sender for a new link.` | none |

Status lookup is non-consuming. Retain the same request token after uncertain responses and clear it only after a definite unavailable/expired result or successful parse/local decryption. Missing, expired, exhausted, and revoked use identical presentation. Incomplete fragment differs because it is local input validation. Render Day 2 notes as text nodes only.

## 7. Interaction and accessibility

- motion 150–220ms only for honest local transitions;
- no loop, shimmer, glow, fake scan/progress;
- `prefers-reduced-motion` removes movement without losing meaning;
- visible 3px focus with at least 2px offset;
- 44×44 minimum targets;
- semantic header/main/form/fieldset/legend/headings;
- associated labels and actionable `aria-describedby` errors;
- one polite progress/status region, not character-by-character announcements;
- keyboard order equals reading order;
- visible theme-toggle label;
- no horizontal scroll at 320/390px;
- no critical/serious axe findings;
- secret routes make no remote font/media/script/embed/analytics request.

## 8. Exact file sequence

1. Add/test pure `policy-ui.ts`.
2. Add `proofline.tsx`.
3. Add `evidence-rail.tsx`.
4. Add native `policy-controls.tsx`.
5. Integrate composer policy/result/revoke.
6. Refactor viewer into explicit states and retry retention.
7. Remove shield/check mark and generic cards from `app/page.tsx`.
8. Make theme toggle visibly labeled.
9. Replace old cyan/amber/navy CSS; add responsive/reduced-motion states.
10. Update E2E and a11y selectors/evidence.

Commit pure policy behavior separately from the visual shell if independently green.

## 9. Test matrix

Unit: preset mappings; 24h/7d/30d; local-to-UTC; DST boundary; invalid schedule order; summary equals payload.

E2E: default payload; all presets; scheduled blocking; limited confirmation; one create on double-click; identical prepared payload after timeout/503/malformed success; capability absent from DOM/URL; uniform unavailable; incomplete link; draft retained on failure; no mobile overflow. Test request IDs and secret-free structured logging server-side rather than claiming the browser can inspect provider logs.

A11y/visual: keyboard traversal, focus movement, live announcements, light/dark axe, 390px/desktop screenshots, reduced motion, and no third-party secret-route requests.

## 10. Acceptance and stop gate

Approve implementation only when quiet-proof tokens replace old colors, shields/locks disappear, one surface plus rail is clear, proofline is the only signature, mappings are exact, later-day controls remain disabled, copy distinguishes authorization from reading, unavailable is uniform, retry tokens survive uncertainty, and keyboard/mobile/dark/reduced-motion/axe gates pass.

Stop if work adds security clichés, treats proofline as proof, exposes deletion capability, enables later-day features, uses raw decrypted HTML, reveals unavailable cause, persists plaintext/keys, clears a retry token early, fetches remote secret-route assets, or replaces accessible native controls with div imitations.

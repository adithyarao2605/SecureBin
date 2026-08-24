You are performing a COMPLETE UI/UX redesign and visual-system unification of the existing SecureBin web application.

Implementation status (2026-08-24, `dev`): the quiet-proof shell, light-first
Linen palette, shared brand treatment, evidence rail/mobile status strip,
proofline, route/state surfaces, Markdown/code authoring, parcel utility,
viewer, receipt, keyboard behavior, and failure/empty/loading states are
implemented in the current application. The Chromium desktop/mobile,
keyboard, reduced-motion, Axe, and nine-screenshot visual review is green.
Owner-hosted verification remains an operational action. This document
describes completed pre-freeze UI work; release-freeze work has not begun.
The public landing route now closely matches the supplied Stitch technical
split screenshot, including its rounded header shell, two-column hero/editor,
proof chips, capability grid, self-host panel, density, and footer. Its copy,
commands, links, colors, and behavior remain SecureBin's verified contracts.

I am providing a ZIP exported from Google Stitch.

Treat the Stitch ZIP as the PRIMARY VISUAL / DESIGN REFERENCE for:
- design language
- typography hierarchy
- spacing
- information density
- technical/editorial composition
- borders
- grid
- documentation layouts
- diagrams
- micro-labels
- code/evidence presentation
- interaction polish
- landing-page visual direction

However:

THE EXISTING SECUREBIN REPOSITORY REMAINS THE SOURCE OF TRUTH FOR:
- functionality
- routes
- cryptography
- APIs
- database behavior
- access-policy semantics
- reveal semantics
- file handling
- discussions
- Privacy Receipt
- parcel format
- security behavior
- deployment
- testing

Do NOT replace the existing application with the Stitch project.

Do NOT scaffold a second application.

Do NOT blindly copy Stitch HTML/CSS into production.

The Stitch export contains reference-only material that must never be copied:

- remote Tailwind, Google Fonts, or Material Symbols requests
- fictional API, bearer-token, developer-console, webhook, vault, latency, or rate-limit content
- the fictional Docker image and setup command
- unsupported “no logging”, “burn after reading”, or security-guarantee copy
- generic shield/lock decoration, scanners, excessive glow, glassmorphism, or oversized rounding

Use bundled assets, existing inline icons, real repository commands, and verified SecureBin behavior only.

Do NOT simplify or remove working SecureBin functionality merely to make the Stitch design easier to implement.

This is a redesign of the EXISTING product.

The route topology remains `/`, `/new`, `/new#history`, `/new#how-it-works`, and `/s/[publicId]`. Parcel restore becomes a distinct utility view inside `/new`; this redesign does not add `/shares`, `/how-it-works`, `/parcel`, `/self-host`, `/security`, or `/docs` routes.

========================================================
0. CRITICAL — DO NOT START BLINDLY
========================================================

Before changing any production code:

1. Extract and inspect EVERY relevant file from the supplied Stitch ZIP.
2. Inspect the existing SecureBin repository.
3. Inspect every currently implemented route and major application state.
4. Inspect existing shared components and design tokens.
5. Inspect the current dark and light themes.
6. Inspect the actual crypto/API/data flow before touching UI around sensitive functionality.
7. Identify visual inconsistencies across:
   - landing
   - New Share
   - My Shares
   - How It Works
   - recipient viewer
   - dialogs
   - success states
   - loading states
   - in-product technical explanations
8. Produce an internal mapping between:
   - Stitch visual language
   - current SecureBin components
   - components that should be reused
   - components that should be refactored
   - components that should be introduced
9. Only then begin implementation.

Do not begin by rewriting pages independently.

The goal is ONE coherent design system.

========================================================
1. NON-NEGOTIABLE COLOR RULE
========================================================

DO NOT CHANGE THE EXISTING SECUREBIN COLOR SCHEME ON EXISTING APPLICATION PAGES.

The current color palette on the application is already approved.

Preserve the current colors on:

- /new
- /new#history
- /new#how-it-works
- /s/[publicId]
- application dialogs
- modals
- policy controls
- evidence rail
- forms
- inputs
- application header
- application footer
- existing status colors
- existing light-theme equivalents
- existing dark-theme equivalents

The Stitch ZIP is NOT permission to recolor the application.

For existing application routes, Stitch should influence:

- layout refinement
- hierarchy
- typography
- spacing
- grid
- component structure
- card treatment
- border discipline
- density
- diagrams
- technical labels
- documentation presentation
- interaction design
- mobile UX
- accessibility
- consistency

It should NOT replace the existing application palette.

DO NOT:
- replace the current mint/teal accent
- make application surfaces more cyan/blue
- introduce purple accents
- replace existing background colors
- replace existing panel colors
- replace existing text hierarchy
- change light-mode colors wholesale
- introduce landing-page glow everywhere
- recolor components simply because Stitch uses another shade

Minor color changes are allowed ONLY when fixing a genuine:
- accessibility issue
- contrast failure
- state legibility problem

========================================================
2. LANDING PAGE THEME DIRECTION
========================================================

The landing page `/` is the only major area where a substantial new visual treatment is allowed, but it remains part of SecureBin's light-first quiet-proof contract.

The landing should use a Stitch-inspired:

“technical-editorial privacy software” aesthetic.

Primary light landing direction:

- Linen `#F4F0E8` dominant canvas
- Ink `#17242D` typography
- Mineral `#2F7071`, Copper `#B86848`, and Mist `#DCE9E3`
- warm technical surfaces rather than plain-white SaaS panels
- strong editorial grid and meaningful negative space
- product UI, protocol diagrams, and evidence as visual material
- tiny mono technical labels used selectively
- large human-readable display typography

Dark landing counterpart:

- near-black or OLED-black canvas with a warm high-contrast character
- near-black technical surfaces
- restrained SecureBin-compatible mint/cyan accents
- high-contrast neutral typography
- subtle atmospheric effects
- extremely restrained glow
- thin borders
- strong editorial grid
- meaningful negative space
- product UI, code, protocol diagrams, and evidence as visual material
- tiny mono technical labels
- large human-readable display typography

The landing may be visually richer than the application. Light mode is the default experience; dark mode may use the Stitch OLED reference selectively.

It must still feel connected to the existing product through:

- SecureBin branding
- typography families
- component geometry
- terminology
- proofline motif
- border language
- navigation concepts
- mint/cyan family
- product UI previews

Do NOT force the landing page's exact background treatment or colors onto application routes.

========================================================
3. PRODUCT DESIGN DIRECTION
========================================================

The final SecureBin product should feel:

- premium
- serious
- technically credible
- privacy-first
- calm
- deliberate
- modern
- precise
- trustworthy
- slightly developer-oriented without excluding ordinary users

The visual language should feel like:

technical editorial design
+
privacy tooling
+
high-quality developer software
+
modern product UI

NOT:

- generic SaaS
- crypto/Web3
- neon hacker aesthetic
- Matrix UI
- security-shield cliché
- glowing cyberpunk dashboard
- glassmorphism showcase
- Tailwind component gallery
- random agent-generated screens
- an admin analytics dashboard

Use the supplied Stitch ZIP heavily as a reference for:

- editorial structure
- technical documentation layout
- strong black negative space
- precise grids
- thin borders
- tiny mono labels
- code/evidence presentation
- layout rhythm
- information hierarchy

========================================================
4. VISUAL CHARACTER
========================================================

The Stitch reference has several important qualities.

Preserve the spirit of:

- disciplined spacing
- hard alignment
- strong column structure
- hairline borders
- restrained rounding
- minimal shadow
- minimal glow
- small technical labels
- large simple headings
- dark negative space
- code/protocol snippets as visuals
- subtle technical diagrams
- coherent documentation
- calm interactions

Do NOT copy individual Stitch screens mechanically.

Translate the design vocabulary into SecureBin.

========================================================
5. EXISTING APPLICATION PALETTE
========================================================

For `/new`, its `#history` and `#how-it-works` views, `/s/[publicId]`, and other existing application surfaces:

KEEP the currently implemented color system.

Preserve:

- current page background
- current panel/surface tones
- current mint/teal accent
- current active-state colors
- current input colors
- current text colors
- current light-theme palette
- current status palette

The redesign of these pages should primarily improve:

- composition
- hierarchy
- spacing
- grouping
- progressive disclosure
- technical/editorial detailing
- component consistency
- responsive design

not their colors.

========================================================
6. LIGHT MODE
========================================================

Preserve the current application light-mode palette unless fixing a genuine design/accessibility bug.

Do not redesign the application's entire light theme from scratch.

For the landing page, light mode may receive a richer interpretation, but it must not become a plain white SaaS website.

Landing light mode may use:

- pearl
- frost
- very pale ivory
- pale blue-gray
- subtle cyan
- faint lavender
- translucent near-white technical surfaces
- subtle atmospheric fields
- fine grain
- restrained luminous depth

A mostly plain-white landing page is considered an unsuccessful design.

========================================================
7. GLOBAL APPLICATION SHELL
========================================================

Create one canonical SecureBin application shell.

Use it consistently across all application routes.

HEADER:

LEFT:
SecureBin | PRIVATE BY DESIGN

CENTER:
segmented navigation:

New share
My shares
How it works

RIGHT:
theme toggle

Clicking the SecureBin brand should return to `/`.

Do not independently redesign navigation on different routes.

Use shared components for:

- Header
- SegmentedNavigation
- ThemeToggle
- Footer
- PageShell
- PageContainer

Desktop outer application width should remain visually consistent.

Target roughly:

1200–1240px maximum outer width

unless existing layout requirements justify a small difference.

The following should align to the same grid:

- header
- application content
- landing sections
- docs
- footer

========================================================
8. HEADER REFINEMENT
========================================================

The existing header architecture is fundamentally good.

Do not replace it with a generic marketing navbar.

Preserve:

SecureBin | PRIVATE BY DESIGN

centered application navigation

theme control

However:

tone down overly strong active-state glow/double outlines if necessary.

Preferred active navigation treatment:

- current application colors
- dark/current surface
- one restrained accent border
- minimal glow
- high-contrast text

Do not turn the application navigation into bright glowing pills.

========================================================
9. TYPOGRAPHY SYSTEM
========================================================

Use three typography roles.

1. DISPLAY

Only for:
- landing-page hero
- major editorial marketing statements

Large, confident, readable.

2. PRODUCT

Use for:
- page headings
- cards
- controls
- form labels
- normal body copy
- recipient content
- docs prose

3. TECHNICAL MONO

Use sparingly for:

PRIVATE BY DESIGN
THE BOUNDARY MATTERS
CLIENT BOUNDARY
ENFORCEMENT
TRANSPARENCY
CLIENT PROOF
SEALED PARCEL
RECIPIENT
CIPHERTEXT ONLY
PROTOCOL
THREAT MODEL
LOCAL MANAGEMENT

Do not use monospace for regular paragraphs.

Do not turn every label into uppercase mono.

========================================================
10. COMPONENT SYSTEM
========================================================

Refactor shared UI primitives rather than letting every page own its own visual system.

Establish or cleanly reuse:

- AppShell
- Header
- SegmentedNavigation
- ThemeToggle
- Footer
- PageContainer
- SectionHeader
- TechnicalLabel
- Card
- EvidenceCard
- PrimaryButton
- SecondaryButton
- DestructiveButton
- IconButton
- Tabs
- Input
- Textarea
- Select
- RadioGroup
- Checkbox
- Toggle
- CollapsibleSection
- Dialog
- ConfirmationDialog
- Toast
- Tooltip
- StatusBadge
- TrustChip
- EmptyState
- Skeleton
- ErrorState
- PolicySummary
- ProofLine
- FileDropzone
- FileRow
- FilePreview
- MarkdownEditor
- MarkdownPreview
- CodeEditor
- CodeViewer
- DiscussionThread
- Comment
- ReceiptStatus
- ActivityTimeline
- PrivacyReceipt

Avoid both extremes:

- giant monolithic components
- dozens of pointless one-line wrapper components

Split by real responsibility.

========================================================
11. BORDER / RADIUS DIRECTION
========================================================

The current application uses fairly rounded SaaS-like panels.

Do not radically flatten everything, but move slightly closer to the supplied technical/editorial design.

Suggested direction:

Major application container:
~14–16px radius

Standard cards:
~10–12px

Inputs:
~8px

Buttons:
~8–10px

Chips/navigation:
pill where appropriate

Use existing design tokens where possible.

The goal is:

soft technical

not:

boxy enterprise software

and not:

giant rounded SaaS dashboard

========================================================
12. ROUTE: /
LANDING PAGE
========================================================

Completely redesign the landing page.

This should be the strongest and richest visual page in the product.

PRIMARY LIGHT DESIGN:

- light-first Linen canvas
- warm technical surfaces
- Ink typography
- restrained Mineral/Copper accents
- precise editorial grid
- protocol lines and real product fragments
- strong contrast without plain-white SaaS styling

DARK COUNTERPART:

- near-black/OLED-black canvas
- restrained ambient technical animation
- precise editorial grid
- subtle protocol lines
- technical evidence labels
- product UI fragments
- large typography
- thin borders
- restrained SecureBin mint/cyan
- minimal glow
- minimal visual noise

Do not create a generic:

big headline
+
gradient blob
+
12 identical feature cards

landing page.

========================================================
13. LANDING HERO
========================================================

Use a strong hero.

Preferred headline:

Share sensitive information.
Stay in control.

Supporting copy should explain:

SecureBin encrypts text, code, and files in the browser before transmission. Infrastructure stores a sealed ciphertext parcel and enforces access policy without receiving the URL-fragment secret through the normal client flow.

Keep copy understandable.

PRIMARY CTA:
Create secure share

SECONDARY CTA:
How it works

OPTIONAL TERTIARY:
Self-host SecureBin

Evidence/trust chips may include:

Client-side encryption
Zero-knowledge design
Timed expiry
Reveal limits
Self-hostable

========================================================
14. LANDING HERO PRODUCT VISUAL
========================================================

On the right side or in a split layout:

show a BEAUTIFUL simplified representation of the REAL SecureBin application.

Do not invent a fake composer.

Use the actual visual language of `/new`.

It may include:

Plain note
Markdown
Code

editor

file attachments

availability

expiry

maximum releases

policy summary

Seal/Create share action

The landing visual should preview the actual product.

When the user clicks New Share, the application should feel familiar rather than like an unrelated second product.

========================================================
15. LANDING SIGNATURE MOTIF
========================================================

Make this a repeated SecureBin motif:

BROWSER
→
SEALED PARCEL
→
RECIPIENT

Use it:

- landing
- Create evidence rail
- How It Works
- Privacy Receipt
- Security docs where appropriate

This should become a recognizable SecureBin design element.

========================================================
16. LANDING — WHY SECUREBIN
========================================================

Use three strong editorial/technical sections.

01 CLIENT BOUNDARY

Local first

Encryption, key derivation, and decryption occur in the browser.

02 ENFORCEMENT

Explicit access policy

Availability, expiry, reveal limits, reveal windows, and revocation are enforced server-side.

03 TRANSPARENCY

Plain language

SecureBin clearly distinguishes server-authorized ciphertext release from successful decrypt or human reading.

Do not render these as generic marketing cards if a more interesting editorial arrangement fits the Stitch direction.

========================================================
17. LANDING — POLICY ENGINE SHOWCASE
========================================================

Make the access-policy engine a major differentiator.

Visually present something like:

AVAILABLE
Now

EXPIRES
24 hours

MAXIMUM RELEASES
3

REVEAL WINDOW
5 minutes

PASSWORD
Required

SECOND CHANNEL
Required

Then convert it into readable language.

Example:

Available immediately for up to 24 hours.
At most three ciphertext releases are authorized.
After the first reveal, new releases close after five minutes.
Recipients also need both local protection factors.

This should look like an actual product capability rather than a list of checkboxes.

========================================================
18. LANDING — FEATURE STORY
========================================================

Cover:

- browser encryption
- URL-fragment secret
- Markdown
- code
- multi-file attachment
- password
- second channel
- scheduled availability
- expiry
- custom reveal count
- atomic reveal enforcement
- retry-safe reveal leases
- reveal window
- revocation
- encrypted discussion
- Privacy Receipt
- Privacy Receipt
- portable .securebin parcel
- offline decrypt
- self-hosting

Do NOT create 20 identical cards.

Use:

- editorial split sections
- diagrams
- UI fragments
- code/evidence pieces
- selective cards
- interactive-looking product representations

========================================================
19. LANDING — PORTABLE PARCEL
========================================================

Create a visually strong section for:

.securebin portable encrypted parcels

Explain:

- encrypted bundle
- does not contain plaintext
- factors remain separate
- can be transported through arbitrary channels
- can be opened locally
- can support offline decryption when the parcel and factors are available

Use accurate wording based on implementation.

========================================================
20. LANDING — SELF HOST
========================================================

Use the headline:

Run SecureBin on your terms.

Explain:

- own infrastructure
- own database/storage
- same browser-first protocol
- no dependency on the hosted SecureBin deployment

CTA:
Explore self-hosting

========================================================
21. LANDING — MOTION
========================================================

Landing may use tasteful animation.

Good:

- extremely slow ambient field movement
- thin protocol/data-line movement
- subtle light drift
- restrained UI movement
- hover responses
- soft section entrance
- tiny parallax where appropriate

Bad:

- huge glowing blobs
- particle explosions
- constant animated backgrounds
- matrix rain
- spinning security icons
- aggressive scroll hijacking
- distracting movement behind text

Respect:

prefers-reduced-motion

Provide a complete static state when motion is disabled.

========================================================
22. ROUTE: /new
CREATE SHARE
========================================================

DO NOT redesign this page from scratch.

The current two-column architecture is approved and should remain the structural source of truth.

DESKTOP:

LEFT:
main composer

RIGHT:
evidence / policy rail

Keep:

- current application colors
- editor hierarchy
- Plain note / Markdown / Code tabs
- file attachment area
- policy controls
- current evidence concept
- current overall application width

Improve organization and hierarchy.

========================================================
23. CREATE — RIGHT EVIDENCE RAIL
========================================================

Retain:

Browser → Sealed Parcel → Recipient

Active Policy Summary

Zero-Knowledge Flow

Make the rail STICKY on desktop where appropriate.

Example:

Browser
→
Sealed Parcel
→
Recipient

ACTIVE POLICY

Available immediately
Expires Aug 25
Maximum 3 releases
5-minute reveal window
Password required
Discussion enabled

ZERO-KNOWLEDGE FLOW

1. Sender Browser
Local encryption and key derivation

2. Sealed Parcel
Ciphertext storage and atomic policy enforcement

3. Recipient Browser
Authorized ciphertext fetched and locally decrypted

Active Policy Summary should update live.

========================================================
24. CREATE — POLICY UX
========================================================

The final policy system is powerful.

Do NOT show every advanced control expanded by default.

Introduce progressive disclosure.

Show a compact summary of the current policy without introducing named policy presets.

Example:

ACCESS POLICY

Available        Immediately
Expires          24 hours
Releases         Unlimited
Reveal window    None

Customize policy ↓

Advanced mode exposes the detailed controls.

Preserve all current policy functionality.

Do not remove advanced capabilities.

========================================================
25. POLICY TERMINOLOGY
========================================================

Normalize all wording.

Prefer:

Reveal
Ciphertext release
Maximum releases
One-time reveal
Reveal window
Expired
Revoked
Unavailable

Avoid:

Burn after reading
Read
Seen
View count

when the system does not know those things.

A reveal means:

one server-authorized ciphertext release.

Keep explanatory language such as:

A reveal authorizes one ciphertext release. SecureBin does not know whether the recipient read it.

Reveal-window copy should describe:

when new ciphertext releases stop

not pretend that SecureBin erases already saved plaintext.

========================================================
26. CREATE — PROTECTION
========================================================

The current:

Add password or second channel

control should become a proper collapsible section.

Example:

PROTECTION

Password & second-channel protection
No additional local factors                         ˅

Expanded state:

Password

[ input ]

Second-channel unlock

[ toggle ]

Provide accurate explanatory copy.

When collapsed, summarize the current protection state.

Examples:

No additional factors

Password required

Password + second channel required

========================================================
27. CREATE — COLLABORATION
========================================================

Do NOT leave:

Enable encrypted discussion

as a raw orphaned checkbox.

Create a proper section:

COLLABORATION

Encrypted discussion

It should have:

- title
- short explanation
- current status
- control
- expanded settings if necessary

Example:

Encrypted discussion
Allow revealed recipients to post encrypted replies.

This same section should later accommodate comment edit/delete behavior cleanly.

========================================================
28. CREATE — PARCEL RESTORE
========================================================

REMOVE:

Restore a .securebin parcel

from the bottom of the Create Share page.

Creating a new share and opening an existing encrypted parcel are different user intents.

Move parcel restore into a dedicated utility view within the existing `/new` application shell, separate from the Create panel. Do not add a new public route solely for this redesign.

Expose:

Open .securebin parcel

through suitable navigation/footer/utility locations.

Do not stack it below the Create workflow.

========================================================
29. CREATE SUCCESS
========================================================

Design a complete polished post-create state.

Show:

Share created

Share link

Actions:

Copy link
QR
Native share
Email

If second-channel unlock is enabled:

show unlock code SEPARATELY.

Never create one QR containing both:

share link secret
+
unlock factor

Provide:

Open
Copy
Revoke
Export .securebin
Download Privacy Receipt

Show:

policy summary
expiry
remaining releases
reveal window
file count
discussion state

This should feel like a technical result/evidence page rather than a generic success toast.

========================================================
30. VIEW: /new#history
MY SHARES
========================================================

Preserve the current color palette and basic structure.

Do NOT turn this into an account dashboard.

This is:

LOCAL, ACCOUNT-FREE SHARE MANAGEMENT.

Add a proper page heading area.

Suggested:

LOCAL MANAGEMENT

My shares

Shares created on this browser can be managed here.
No account is required.

========================================================
31. MY SHARES — EMPTY STATE
========================================================

Keep the existing core empty-state concept.

Example:

LOCAL INDEX · 0 SHARES

No shares created yet

Shares created on this browser will appear here.

Create a share

Do not fill the empty state with:

- fake statistics
- charts
- tutorials
- decorative dashboards
- meaningless widgets

The empty space is acceptable.

========================================================
32. MY SHARES — POPULATED STATE
========================================================

Design the populated state deliberately.

Use restrained technical rows/cards rather than dashboard tiles.

Each share may show:

local label
status
created time
expiry
remaining releases
reveal-window state
discussion state

Actions:

Open
Copy link
Revoke
More

Filters:

Active
Scheduled
Expired
Revoked
All

Optional search.

Do NOT add analytics charts.

States required:

- active
- scheduled
- expired
- revoked
- exhausted
- reveal-window currently active

========================================================
33. OPTIONAL SHARE MANAGEMENT DETAIL
========================================================

Create a detailed local management view/state.

Show:

POLICY
LIFECYCLE
ACTIVITY
DISCUSSION

Activity might include:

Ciphertext released

Ciphertext release authorization recorded by the local manager when that state is available.

========================================================
34. VIEW: /new#how-it-works
========================================================

Preserve the existing application colors.

KEEP the current opening visual direction.

Retain:

THE BOUNDARY MATTERS

A share should reveal as little as possible.

Retain the three opening concepts:

01 CLIENT BOUNDARY
Local first

02 ENFORCEMENT
Explicit access policy

03 TRANSPARENCY
Plain language

However:

THE CURRENT PAGE IS TOO SHORT.

It currently reads like the beginning of a complete page.

Expand it significantly.

========================================================
35. HOW IT WORKS — PROTOCOL
========================================================

After the opening cards add:

THE PROTOCOL

Create a strong visual:

SENDER BROWSER
↓
SEALED PARCEL / SECUREBIN
↓
RECIPIENT BROWSER

Sender side:

plaintext
↓
key derivation
↓
AES-GCM
↓
ciphertext

Server side:

ciphertext
policy
timestamps
release state

Recipient:

ciphertext
+
URL fragment
+
optional password
+
optional second channel
↓
local decrypt

Use the real implementation terminology.

========================================================
36. HOW IT WORKS — OBSERVABILITY
========================================================

Create a technical/editorial comparison.

INFRASTRUCTURE CAN OBSERVE

Examples:

✓ public share identifier
✓ ciphertext
✓ ciphertext size / padding bucket if implemented
✓ access-policy metadata
✓ lifecycle timestamps
✓ authorized release count

OFFICIAL CLIENT KEEPS LOCAL

✕ plaintext
✕ URL-fragment secret
✕ password
✕ second-channel unlock factor

Use careful threat-model wording.

Do NOT claim malicious served JavaScript could never access plaintext.

========================================================
37. HOW IT WORKS — REVEAL ≠ READ
========================================================

Make this a major visual concept.

REVEAL ≠ READ

Explain:

SecureBin can know that the server authorized a ciphertext release.

It cannot prove that a human:

- read
- understood
- copied
- saved

the decrypted plaintext.

The implemented Privacy Receipt is a local technical summary. It is not an activity receipt and does not claim that a recipient read, opened, or acknowledged content.

========================================================
38. HOW IT WORKS — ATOMIC ENFORCEMENT
========================================================

Visual example:

MAXIMUM RELEASES = 3

100 simultaneous requests

↓

ATOMIC POLICY ENFORCEMENT

↓

3 authorized
97 rejected

Explain:

reveal limits are transactionally enforced rather than implemented as a naïve read-counter-update flow.

Use the actual implementation details without exaggerating.

========================================================
39. HOW IT WORKS — RETRY SAFE
========================================================

Visual:

release request
↓
server commits authorization
↓
response disappears
↓
same request token retries
↓
existing authorization recovered
↓
no second release consumed

This should be easy for judges to understand visually.

========================================================
40. HOW IT WORKS — POLICY COMPOSITION
========================================================

Show:

Available
Expires
Maximum releases
Reveal window
Password
Second channel

Then convert the configuration into plain English.

This reinforces the product's “programmable access policy” identity.

========================================================
41. HOW IT WORKS — THREAT MODEL
========================================================

Add a restrained section:

WHAT THIS MODEL DOES NOT PROMISE

Examples:

- malicious served JavaScript cannot be ruled out
- compromised recipient devices
- screenshots
- copied plaintext
- already saved downloads
- complete metadata elimination
- remote erasure of copies a recipient already saved

Do not bury these limitations.

Honest security wording is part of the product identity.

========================================================
42. HOW IT WORKS — FINAL SECTION
========================================================

Finish with:

Portable encrypted parcels

Offline local decryption

Self-hosting

Links:

Open a parcel in the `/new` utility view
Read the security model in How it works
Read the repository deployment documentation

========================================================
43. ROUTE: /s/[publicId]
RECIPIENT VIEWER
========================================================

Preserve existing application colors.

Use the same design system.

Viewer should be calmer and less decorative than landing/Create.

Sensitive content should receive maximum visual priority.

Design ALL important states.

========================================================
44. VIEWER — STATUS
========================================================

Before consuming a reveal, show available policy information.

Possible fields:

Available now / scheduled
Expires
Maximum releases
remaining releases if allowed
reveal window
password required
second channel required
discussion enabled

For limited-release shares:

require deliberate confirmation before requesting ciphertext.

Copy should explain:

This action authorizes one ciphertext release.

========================================================
45. VIEWER — FACTOR STATES
========================================================

Design:

- scheduled
- password required
- second-channel required
- password + second-channel
- confirmation
- authorization/loading
- wrong local factor
- local decryption failure

Accurate failure wording:

Could not decrypt with the supplied local factors.

If applicable explain:

a server-authorized release may already have been consumed.

Do not imply the server verifies the password.

========================================================
46. VIEWER — REVEALED CONTENT
========================================================

Design:

PLAIN TEXT

Large readable content.

MARKDOWN

Beautiful sanitized Markdown rendering.

CODE

Syntax highlighting
language label
line numbers
horizontal scrolling
copy
raw
download

FILES

safe previews
individual download
Download All

Give content enough width.

Do not squeeze content into narrow SaaS cards.

========================================================
47. VIEWER — DISCUSSION
========================================================

Support:

encrypted comments
nested replies
nickname
timestamp
reply

For comments created on the current device with management capability:

Edit
Delete

Edited comments display:

Edited

Deleted comments display:

Comment deleted

Preserve replies beneath deleted parents.

========================================================
48. VIEWER — PRIVACY VEIL
========================================================

Support:

Hide

Esc

optional focus/visibility hiding where already implemented.

State:

Sensitive content hidden

Show content

Do not claim screenshot prevention.

========================================================
49. VIEWER — REVEAL WINDOW
========================================================

If reveal window is active:

show a restrained countdown.

Use accurate copy such as:

New ciphertext releases stop when the reveal window closes. This browser also hides its decrypted copy. SecureBin cannot erase copies a recipient has already saved.

========================================================
50. VIEWER — UNAVAILABLE
========================================================

Provide a consistent unavailable state.

Used for:

- expired
- revoked
- exhausted
- missing

Avoid unnecessary public information leakage.

Do not visually expose backend distinctions unless product behavior intentionally does so.

========================================================
51. PARCEL UTILITY VIEW IN `/new`
========================================================

Create a dedicated portable parcel interface inside the existing application shell, distinct from Create share.

Do not place this at the bottom of Create Share.

Heading:

Open a .securebin parcel

Drag/drop

or:

Choose .securebin file

After parsing show safe metadata such as:

version
content type
file count
policy snapshot if included

Request local factors as necessary.

Support:

- valid
- wrong factors
- tampered
- unsupported version
- malformed
- successful decrypt

Make offline/local operation visually clear where supported.

========================================================
52. PRIVACY RECEIPT
========================================================

Design a strong technical evidence document.

Provide:

- in-application version
- printable/downloadable version

Possible fields:

share fingerprint
envelope version
algorithm
KDF
factor configuration
availability
expiry
maximum releases
reveal window
file count
discussion
padding bucket if enabled

Sections:

WHAT WAS ENCRYPTED

WHAT STAYED LOCAL

WHAT INFRASTRUCTURE CAN OBSERVE

KNOWN LIMITATIONS

It must not look like a fake security certification badge.

Use the Stitch technical-document aesthetic where appropriate while preserving application colors when displayed inside the app.

========================================================
53. ERROR STATES
========================================================

Design consistent states for:

404
500
offline
API unavailable
maintenance/degraded state
share unavailable
creation failure
upload failure
decryption failure

Keep SecureBin tone restrained.

Avoid excessive jokey copy in security-critical states.

========================================================
54. LOADING STATES
========================================================

Design polished loading/skeleton states for:

landing product preview
share status
recipient reveal
Markdown renderer
syntax highlighter
QR generation
file previews
discussion
My Shares

The application must not appear partially broken while lazy-loaded features initialize.

Avoid hydration/layout flashes.

========================================================
55. MOBILE
========================================================

This redesign is NOT complete until mobile is deliberately handled.

Check at least:

320px
390px
tablet
desktop

Do NOT simply shrink desktop.

LANDING:
stack hero cleanly

HEADER:
compact navigation while preserving identity

NEW SHARE:
single column

Evidence rail:
moves below composer or becomes contextual summary

Policy:
touch-friendly controls

Markdown:
Edit / Preview mode instead of impossible split layout

Code:
horizontal scrolling

Files:
full-width list

Viewer:
maximum reading width

Discussion:
nested replies remain usable

My Shares:
stack cleanly

Dialogs:
fit narrow screens

========================================================
56. ACCESSIBILITY
========================================================

Preserve or improve:

- semantic HTML
- keyboard navigation
- visible focus states
- screen-reader labels
- heading hierarchy
- contrast
- non-color-only status communication
- touch targets
- reduced motion
- dialog focus management
- accessible countdowns
- file upload accessibility

Do not reduce contrast solely to achieve the technical aesthetic.

Some current muted text is already near the lower acceptable range.

Long explanatory/security text must remain comfortably readable.

========================================================
57. ANIMATION POLICY
========================================================

LANDING:

animation allowed and encouraged if restrained.

APPLICATION:

much calmer.

Good:

- subtle transitions
- tiny hover response
- smooth collapsibles
- restrained state changes
- low-intensity ambient background where already appropriate

Bad:

- persistent glowing gradients
- heavy parallax
- particle fields behind forms
- moving elements behind revealed sensitive content
- bounce animations
- excessive page transitions

========================================================
58. EXISTING APP COLOR PRESERVATION AUDIT
========================================================

After redesigning the application:

perform a color regression audit.

Compare before/after for:

/new
/new#history
/new#how-it-works
/s/[publicId]

Confirm that the redesign did NOT accidentally replace:

- backgrounds
- panel colors
- accent
- inputs
- text hierarchy
- statuses
- current light theme

Any intentional application color modification must have a documented reason such as accessibility.

The landing page is exempt from this restriction.

========================================================
59. FUNCTIONAL SAFETY
========================================================

THIS IS CRITICAL.

Do NOT alter cryptographic or authorization behavior merely for easier UI implementation.

Do NOT change:

- encryption semantics
- decryption semantics
- URL-fragment behavior
- key derivation
- PBKDF2/HKDF behavior
- envelope format
- file encryption
- reveal counting
- reveal leases
- DB transactions
- revocation
- discussion cryptography
- Privacy Receipt generation and wording
- deletion capabilities
- storage security

unless fixing a confirmed bug.

Never send to server APIs merely because the new UI needs it:

- plaintext
- passwords
- URL-fragment secret
- second-channel factor

Preserve browser/server security boundaries.

========================================================
60. DO NOT REMOVE FEATURES
========================================================

Do not accidentally remove working features while redesigning.

Preserve all implemented functionality including where applicable:

- plain text
- Markdown
- code
- files
- multi-file handling
- safe previews
- password
- second channel
- availability scheduling
- expiry
- Never
- reveal limits
- custom reveal count
- reveal window
- revocation
- discussions
- comment editing/deletion if implemented
- Privacy Receipt
- sender share manager
- portable parcels
- offline parcel decrypt
- self-hosting
- light/dark mode

If a feature is not yet implemented, design the architecture so it can fit without pretending the feature already works.

========================================================
61. REPOSITORY QUALITY
========================================================

Do not leave two design systems in production.

Once migration is complete:

- remove superseded styles
- consolidate tokens
- reuse primitives
- remove dead components
- eliminate page-specific duplicated CSS where inappropriate
- avoid giant components
- maintain clear responsibility boundaries

Do not convert the repo into hundreds of tiny meaningless component files either.

========================================================
62. EXECUTION ORDER
========================================================

Follow this sequence.

PHASE 1 — DISCOVERY

1. Inspect Stitch ZIP.
2. Inspect current SecureBin.
3. Inspect all routes.
4. Inspect themes.
5. Inspect functional/security boundaries.
6. Define component/token mapping.

PHASE 2 — SHARED APPLICATION SYSTEM

7. Clean up shared application primitives.
8. Standardize shell/header/footer/navigation.
9. Preserve application colors.

PHASE 3 — CORE APPLICATION

10. Refine /new.
11. Introduce policy progressive disclosure.
12. Improve Protection.
13. Add Collaboration section.
14. Make evidence rail sticky.
15. Move parcel import into a separate utility view within `/new`.
16. Refine /new#history.
17. Design populated share states.
18. Expand /new#how-it-works.

PHASE 4 — RECIPIENT

19. Redesign/refine every recipient state.
20. Test long plaintext.
21. Test Markdown.
22. Test code.
23. Test files.
24. Test discussion.
25. Test factors.
26. Test unavailable/error states.

PHASE 5 — UTILITY AND EVIDENCE

27. Build/refine the parcel utility view within `/new`.
28. Refine Privacy Receipt.

PHASE 6 — LANDING

29. Once the real product components are stable, build the new Stitch-inspired landing page around them.

This is intentional:

the landing must preview the REAL application rather than a fictional design.

PHASE 7 — QUALITY

30. Mobile pass.
31. Accessibility pass.
32. Loading-state pass.
33. Theme pass.
34. Color-preservation audit.
35. Visual consistency audit.
36. Existing automated tests.
37. Production build.
38. Fix regressions.

========================================================
63. VISUAL CONSISTENCY AUDIT
========================================================

At the end, compare side-by-side:

/
 /new
 /new#history
 /new#how-it-works
 /s/[publicId]
 /new parcel utility view

Audit:

- branding
- header
- navigation
- widths
- spacing
- typography
- borders
- radii
- components
- buttons
- controls
- labels
- diagrams
- terminology
- footers
- loading
- empty states
- mobile behavior

They should visibly belong to one product.

Important nuance:

The landing may be more visually ambitious: light-first quiet proof by default, with the OLED technical-editorial treatment reserved for its dark counterpart.

The APPLICATION keeps its existing approved colors.

Their continuity should come from:

- typography
- geometry
- brand
- components
- proofline
- terminology
- layout discipline

not identical page backgrounds.

========================================================
64. DO NOT INVENT PRODUCT AREAS
========================================================

Do not introduce:

- accounts
- login
- Google authentication
- profiles
- user identities
- enterprise admin
- analytics dashboards
- organizations
- typing indicators
- social messaging
- presence
- AI assistant
- blockchain
- Web3 concepts
- theme marketplace
- unnecessary gamification

SecureBin is anonymous and account-free by design.

========================================================
65. TERMINOLOGY AUDIT
========================================================

Before completion search the entire visible UI for inconsistent terminology.

Normalize:

Reveal
Ciphertext release
Maximum releases
One-time reveal
Reveal window
Expired
Revoked
Unavailable

Inspect and remove misleading phrases such as:

Read
Seen
Burn after reading
View count

when they imply information SecureBin cannot know.

========================================================
66. FINAL ACCEPTANCE CRITERIA
========================================================

The redesign is complete only when:

- the Stitch ZIP's technical/editorial influence is clearly visible
- the application still feels like SecureBin rather than a copied Stitch demo
- existing application colors are preserved
- only the landing page receives a substantial new color/background treatment
- landing defaults to the light-first Linen quiet-proof system
- landing dark mode may use a restrained OLED-black technical-editorial counterpart
- landing light mode is not generic white SaaS
- landing and application still feel related
- /new remains highly usable
- advanced policy controls use progressive disclosure
- protection is a real structured section
- encrypted discussion is grouped under Collaboration without inventing activity receipts
- parcel restore no longer sits below Create
- evidence rail remains and is improved
- My Shares feels local/account-free
- populated My Shares states are thoughtfully designed
- How It Works is a complete technical explanation, not three cards and empty space
- recipient viewer works for every major content/policy state
- sensitive content receives maximum readability
- Privacy Receipt looks like technical evidence
- mobile is deliberately designed
- accessibility is maintained or improved
- loading states do not look broken
- no major visual regressions exist
- no crypto/security semantics are weakened
- no existing feature disappears
- no second design system remains in the codebase
- production build passes
- existing validation/test suite passes

The objective is NOT:

“Apply the Stitch theme.”

The objective is:

Use the supplied Stitch design as a sophisticated visual reference to transform SecureBin into one coherent, production-quality privacy product, while preserving the existing application's approved color palette and security architecture.

The landing page should be the visually impressive front door.

The application should remain calmer, functional, and familiar.

Landing:
new Stitch-inspired technical-editorial visual treatment, light-first with a restrained OLED dark counterpart.

Existing application:
existing SecureBin colors + significantly improved design discipline, hierarchy, consistency, responsiveness, and UX.

Do not declare the redesign complete until the entire product has been reviewed route-by-route and state-by-state.

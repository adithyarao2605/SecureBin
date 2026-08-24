# Demo rehearsal checklist

Run top-to-bottom against the production preview before any judging session.
Every unchecked box means fix or re-rehearse, no improvising on stage.

## Preparation (once per machine)

- [ ] Fresh clone + `pnpm install --frozen-lockfile` succeeds.
- [ ] `pnpm validate`, `pnpm test:integration`, `pnpm test:e2e` all green.
- [ ] `.env.local` present from `.env.example`; local Supabase started via
      `pnpm supabase:start`.
- [ ] Browser profile clean: no stored `securebin_*` localStorage keys, no old
      history desk entries.

## Core story (~3 minutes)

1. [ ] Landing page loads at `/`; hero, proofline, and three-tab header render;
       "Create share" opens `/new`.
2. [ ] Create a note share: type text, press "Create share", copy the link.
       Confirm the Privacy Receipt disclosure opens under Copy link and shows
       algorithm, KDF, and fingerprint.
3. [ ] Open the link in a private window: status appears, "Reveal" decrypts
       locally, note renders.
4. [ ] Back on the sender device: history desk shows the share as revealed;
       batch refresh strip appears once, statuses update.
5. [ ] Revoke from the history desk; reopening the link now shows the uniform
       "no longer available" state.

## Protection factors (~2 minutes)

6. [ ] Create a password + separate-unlock-code share; show the unlock code
       panel and QR actions.
7. [ ] Recipient path: wrong password fails locally without a new server
       authorization; correct factors decrypt.
8. [ ] Show the factor gate blocking before any reveal happens.

## Richer content (~2 minutes)

9. [ ] Markdown mode with Edit/Split/Preview; styled headings/list/code in
       preview.
10. [ ] Code mode: language selector beside Code tab, line numbers, download.
11. [ ] Drag two files onto the attachment zone; create; recipient sees both
      previews plus "Download all (ZIP)".

## Discussions (~1 minute)

12. [ ] On an opened share, post a reply and a nickname; both arrive encrypted.
13. [ ] Edit then delete your comment; orphan replies show "[comment removed]".

## Closing honesty beats

14. [ ] Read the pre-flight "What will SecureBin see?" disclosure aloud once.
15. [ ] Point at the Privacy Receipt line stating saved copies cannot be erased.

## After the demo

- [ ] Revoke/delete all demo shares.
- [ ] Clear localStorage on the demo browser profile.

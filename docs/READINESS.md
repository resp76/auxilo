# Auxilo readiness review

Reviewed September 9, 2026. Ready for local testing; not yet ready for public production or App Store distribution.

## Fixes

- All due reminders are processed, including simultaneous reminders and those following already-alerted tasks.
- Reminder entry rejects past/invalid times and stores ISO instants with local-time editing.
- Saved task records are validated. Unreadable saved data is preserved instead of being overwritten; storage failures are visible.
- Reminder dialog supports keyboard focus and Escape. Mobile navigation exposes all modules and sign-out.
- Task filters, quick-add navigation, sample inbox-to-task actions, and dashboard navigation controls work. Preview-only controls are labeled/disabled.
- Demo authentication type error, invalid Google session expiry handling, duplicate iPhone event validation, and metadata host trust were corrected.
- A complete Xcode project, shared scheme, permission descriptions, app icon, and native UI tests were added.

## Verification

- Production web build, ESLint, TypeScript, and all 11 regression tests passed.
- Isolated browser checks covered task creation, reminder save/edit/remove/reload, rejecting past reminders, multiple due reminders, Upcoming filtering, mobile menu, contact search/follow-ups, and iPhone snapshot import/removal.
- Browser QA used a demo account with mocked absent auth configuration. Actual Google sign-in was verified earlier in this project session, but was not repeated in this review. Email delivery and account recovery require live-account testing.
- iOS simulator Debug build and unsigned iOS device Release build succeeded with Xcode 26.6/iOS 26.5. All 3 simulator UI tests passed.

## Added after the September 9 review

- GitHub, Linear, Notion, and Slack are live paste-a-key connectors that load real
  items into Tasks. GitHub and Linear are called directly from the browser;
  Notion and Slack are forwarded by an allowlisted worker route because they
  refuse browser calls. See [connectors](CONNECTORS.md).
- `GOOGLE_CLIENT_ID` is now readable from `.dev.vars` locally, so Google
  Calendar/Contacts goes live once a public client ID is supplied.
- Command palette (⌘K) with fuzzy matching, and reminder snooze (10 min, 1 hour,
  tomorrow 9am).
- Verified live: the proxy allowlist rejects unknown providers and off-origin
  paths, and real 401s from api.notion.com and slack.com are forwarded intact.
  Connector keys are never persisted; only pasted keys in tab memory are used.
- Still unverified against live provider data: no real GitHub/Linear/Notion/Slack
  token was used in testing, so mapping was exercised against mocked payloads
  and the transport against real (unauthenticated) API responses.

## Domain

`auxilo.app` was registered at Porkbun on 2026-09-10 and renews 2027-09-10
(confirm auto-renew is on; losing a brand domain to expiry is unpleasant).

**It is live.** As of 2026-09-10 `auxilo.app` resolves through Cloudflare, serves
the app over HTTPS with a valid certificate, and returns the OpenGraph image at
`/og.png`. `metadataBase` in `app/layout.tsx` matches the real host, so social
cards resolve correctly.

`.app` is on the HSTS preload list, so browsers refuse plain HTTP for it — any
future host change must present a valid certificate on the first request; there
is no HTTP-then-upgrade path.

## Work before release

- Configure Apple signing/team and App Store Connect; test on a physical iPhone before TestFlight. The native app is a Contacts/Calendar export companion, not a complete native dashboard.
- Verify calendar permission denial/revocation, event creation/editing, recurring/all-day events, and multiple calendar accounts on a real device. Automated native tests currently cover contacts and opening export only.
- Move Google OAuth beyond its current testing configuration for broader users, and verify the production redirect URLs and email delivery settings. Google Calendar/People authorization is separate from Supabase sign-in.
- Implement task cloud storage and background notification delivery if users need cross-device data and reminders while Auxilo is closed. Current tasks stay in browser storage per account; tab timers are not guaranteed in the background.
- Replace sample inbox/projects/spaces and connector previews with real persistence/provider sync before describing them as production features. iPhone imports are read-only and session-only.
- Complete a production security, accessibility, and privacy review after the real data flows and release configuration are finalized. This scoped review cannot guarantee absence of defects.

No deployment, signed archive, App Store submission, or Git push was performed during this review.

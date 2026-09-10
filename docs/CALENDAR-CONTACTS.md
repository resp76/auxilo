# Auxilo calendars and contacts — implementation and setup

Updated September 8, 2026. This records implemented behavior, not a promise of unattended background synchronization.

## Delivery status

| Capability | Current implementation | Remaining activation or limitation |
| --- | --- | --- |
| People workspace | Search name, email, phone, company, account; filter source; inspect records; suggest duplicates; create local follow-up tasks | Session-only records. No automatic contact merging or contact edits |
| Google Contacts | Google Identity Services authorization; People API paginated contact reads; account labels and multiple accounts | Needs OAuth web client ID, enabled People API, and user authorization |
| Google Calendar | Calendar selection; paginated next-30-day reads; personal event creation and edits; ETag conflict protection | Needs OAuth configuration. Refresh is manual; recurring, guest, and all-day edits belong in Google Calendar |
| iPhone Calendar | EventKit permission and selection source; native event editor; selected-event JSON export | Requires Xcode 15+ / iOS 17+, signing and device testing; web import is a read-only snapshot |
| iPhone Contacts | System contact picker, local search of selected contacts, explicit export | No full address-book scan; import is a snapshot, not live sync |
| Apple Notes | Labelled sample search | Notes bridge has not been built and is not included in this companion |

The Today dashboard, email, Slack, Linear, Notion and GitHub workflows remain demonstrations. Those controls now explicitly say Demo. A checked demo control does not mean that an account is authorized.

## Set up Google for Auxilo

The project owner confirmed that no Google OAuth web client ID exists yet. No client secret is required for this browser-based flow.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select the project that will own Auxilo's integration.
2. Enable **Google Calendar API** and **People API**.
3. Configure Google Auth Platform branding, audience and consent. Set the support email and required app information. While in testing, add the Google accounts that will test Auxilo. Public distribution may require Google's verification for the requested scopes.
4. Create an OAuth client with application type **Web application**.
5. Register authorized JavaScript origins (origins only, no trailing paths):
   - `https://auxilo.app`
   - `http://localhost:3000` for local development, if needed.
6. Copy the public client ID ending in `.apps.googleusercontent.com`. Never paste a client secret into Auxilo.
7. Set the hosted non-secret variable `GOOGLE_CLIENT_ID`, then redeploy. For a one-session test, the owner may instead enter it in Integrations → Google setup. The client ID is returned by `/api/google/config`; no other environment values are exposed.
8. Choose Calendar and/or Contacts access, load Google's sign-in library, then choose the Google account and grant the requested scopes.
9. Check the calendars Auxilo may read and press **Refresh contacts & selected calendars**. No calendars are chosen automatically.
10. Repeat account selection to add another account. Reauthorizing the same Google identity replaces its session instead of duplicating it.

Scopes: `openid`, `email`, `contacts.readonly` for contact reads, and `calendar.events` plus `calendar.calendarlist.readonly` for calendars. Users can enable only Contacts or only Calendar before authorization. Partial grants are respected.

## Data and authorization lifecycle

- Google uses the official browser token model: a popup returns a short-lived token and the browser calls Google's REST APIs directly over HTTPS.
- Tokens, imported records, and client-ID overrides stay in React memory, never localStorage or a server token vault. Reloading the page ends this session.
- New access after expiry requires an explicit Google sign-in action. There is no automatic refresh token or server background worker in this slice.
- Disconnect removes the account's records and token from Auxilo memory. It does not revoke Google's authorization; the UI links to Google Account connections for that action.
- iPhone snapshots replace previous iPhone records only. Google records remain separate. No automatic cross-provider merging occurs.
- iPhone exports are ordinary JSON files with personal data, not encrypted cloud backups. The companion's export screen explains this. Choose a trusted location and remove the file when no longer needed.

## Calendar writes and failure handling

- New personal events are saved directly to the selected writable Google calendar. No attendee list is sent and no invitation feature is enabled.
- Edits preserve other event fields by patching only title/start/end. `If-Match` uses the previously read ETag. A 412 conflict asks for refresh instead of overwriting the source.
- Shared, recurring, and all-day edits are excluded from the web editor to avoid silently changing recurrence or invitations.
- Reads include every provider page for the selected next-30-day window. A repeated cursor fails with a clear message.
- Expired access, denied permissions, rate limits and version conflicts produce actionable errors. API requests have a 20-second timeout.
- No automatic retry is performed on writes whose outcome is uncertain; refresh Google Calendar before retrying.
- Refresh replaces Google lists only after the complete fetch succeeds. A failed read preserves the previous snapshot and shows an error.

## iPhone companion

Download the source through Integrations or [the companion ZIP](https://auxilo.app/auxilo-iphone-companion.zip). Full build instructions are included in `ios/AuxiloCompanion/README.md` and the ZIP.

The companion is a standalone SwiftUI source file, not an installed iOS app or signed release. Create an iOS 17+ SwiftUI application in Xcode, add the file, configure the Calendar and Contacts usage descriptions, select a signing team, and run on a device. The EventKit system event editor writes to the source calendar. Selected contacts are read through the system picker.

Export protocol: JSON with `version: 1`, ISO `exportedAt`, `contacts`, and `events`. See the companion README for exact fields. Imports reject invalid shapes/dates, duplicate contact IDs, more than 10,000 records per collection, and files over 5 MB. React renders imported strings as text. Imported source identity is forced to iPhone rather than trusted from the file.

Web edits are not pushed back to the companion. Automatic pairing, persistent encrypted storage, background delivery, full contact editing, and iCloud CalDAV/CardDAV are not implemented. iOS Calendar is an app that can contain Google, iCloud and other calendars; avoid importing the same underlying Google calendar through both paths unless you intentionally want separate snapshots.

## Files and verification

- `app/connected-workspace.tsx`: Google authorization/session state, source setup, People UI, connected calendar UI.
- `app/people-calendar.ts`: Google API requests, pagination, normalization, event validation, conflict-safe saves, import validation, contact search and duplicate matching.
- `worker/index.ts`: public client-ID configuration endpoint.
- `ios/AuxiloCompanion/`: native source and setup.
- `tests/people-calendar.test.mjs`: fixtures/mock requests for import validation, account provenance, pagination, token expiry, allowed destinations, invalid dates, duplicate suggestions, and ETag conflicts.

Run `pnpm test`, `pnpm exec tsc --noEmit`, and ESLint for the changed TypeScript. Tests do not exercise live Google consent or real Apple frameworks. Live Google testing awaits a client ID and test account. The authoring Mac has no iOS SDK or simulator, so native compilation/signing and on-device permission/export tests remain required.

## Next steps to reach the original always-synced product

1. Provision Google OAuth and verify real account read/write behavior.
2. Build and test the companion on an iPhone.
3. Add per-user persistence, a protected backend refresh-token flow and conflict/audit records for continuous Google sync.
4. Add explicit device pairing and authenticated delivery before calling iPhone imports a live connection.
5. Integrate live source records into Today and build the email/GitHub/Slack/Linear/Notion adapters before displaying related messages and projects for contacts.

References: [Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [People API contacts](https://developers.google.com/people/v1/contacts), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), [Calendar ETags](https://developers.google.com/workspace/calendar/api/guides/version-resources), [Apple EventKit permissions](https://developer.apple.com/documentation/eventkit/accessing-the-event-store), [Apple ContactsUI](https://developer.apple.com/documentation/contactsui).

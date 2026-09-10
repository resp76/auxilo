# Auxilo iPhone Calendar and Contacts companion

Source for an iOS 17+ SwiftUI companion. This is not a signed app or an App Store/TestFlight release. It uses native EventKit and ContactsUI, with no third-party dependencies. It does not access Apple Notes.

## Build on a Mac with Xcode

1. Open `AuxiloCompanion.xcodeproj` in Xcode 26.6 or later.
2. Select the shared **AuxiloCompanion** scheme and an iPhone simulator, then **Product → Run**.
3. To run on your iPhone, choose your Apple development team in **Signing & Capabilities**, change the bundle identifier if needed, and select your connected phone. Signing credentials are not included.
4. Run **Product → Test** for the UI tests. The contact-selection test uses the standard simulator contact John Appleseed; run it on a fresh simulator with the sample contacts.

From the repository root:

```sh
xcodebuild -project ios/AuxiloCompanion/AuxiloCompanion.xcodeproj \
  -scheme AuxiloCompanion -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath /tmp/auxilo-xcode-build CODE_SIGNING_ALLOWED=NO test

xcodebuild -project ios/AuxiloCompanion/AuxiloCompanion.xcodeproj \
  -scheme AuxiloCompanion -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/auxilo-xcode-device CODE_SIGNING_ALLOWED=NO build
```

The second command produces an unsigned device build, not an installable distribution. Xcode's Archive/Distribute workflow requires your Apple team, provisioning, and App Store Connect setup.

## What works in the source

- An intro screen on first launch explaining what the companion does and that no
  account is needed. Contacts are not requested until you tap Get started; the
  choice is remembered, so later launches open directly on the form.
- Explicit selection of contacts through the iOS picker, local contact search, and clearing that selection.
- Calendar full-access permission request, then per-calendar selection (none selected by default).
- Read selected events for the next 30 days; native event editor for creation and edits. Saving through EventKit updates the calendar provider subject to iOS/account permissions and connectivity.
- Permission rechecks and event refresh on app activation and EventKit changes.
- JSON export to Files of the selected contacts and calendar snapshots, and matching import in the Auxilo web app.

The web import is read only and held in the current tab's memory. Re-export and re-import to update it. The companion does not receive edits from Auxilo web and has no background cloud sync, device pairing, or push service. Selection is session-only. The export is a regular unencrypted file containing personal data; save it somewhere appropriate and delete it after import if no longer needed.

## Validation status and device checklist

Validated September 9, 2026 using Xcode 26.6 and the iOS 26.5 SDK: simulator Debug build, unsigned device Release build, and three passing simulator UI tests (contact picker dismissal, contact selection/search/clear, and export file picker). No physical-device or distribution signing validation has been performed. Before distribution:

- Build in Xcode and test picker cancellation, selected contacts, empty selection, and calendar permission denied/revoked.
- Select calendars from more than one account and check that unselected events are excluded.
- Test all-day events, recurring occurrences, timezone changes, read-only calendars, and the native event editor's Save/Cancel paths.
- Export and import on iPhone Safari and desktop; verify event dates and that a new snapshot replaces old iPhone records without affecting Google records.
- Disconnect/remove imports and reload the browser; no imported records should remain.

## Export format (version 1)

`version: 1`, `exportedAt: ISO-8601`, `contacts: []`, `events: []`.

Each contact: `id`, `name`, `email`, `phone`, `organization` (strings).
Each event: `id`, `title`, `start`, `end`, `calendarId`, `calendarName` (strings), `allDay` (boolean). All-day dates use YYYY-MM-DD with an exclusive end date. Timed events use ISO-8601 instants. Maximum 5 MB and 10,000 records in each collection.

References: [EventKit permissions](https://developer.apple.com/documentation/eventkit/accessing-the-event-store), [ContactsUI](https://developer.apple.com/documentation/contactsui).
